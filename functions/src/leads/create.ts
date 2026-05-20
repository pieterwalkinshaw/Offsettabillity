/**
 * Lead Capture Cloud Function — Public HTTP Endpoint
 *
 * POST /api/leads — No authentication required.
 * - Rate limited: 5 requests per IP per 60-second sliding window
 * - Honeypot field detection: silently discards bot submissions
 * - Validates input with LeadCreateSchema (Zod)
 * - Stores lead with status="new", all fields, UTM params, timestamp
 * - Triggers async admin notification (deferred to background)
 * - Returns success within 200ms target
 * - Creates duplicate leads for same email+type (no deduplication)
 */

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { LeadCreateSchema } from '../../../shared/schemas';
import { logger } from '../utils/logger';

const LEADS_COLLECTION = 'leads';
const RATE_LIMIT_COLLECTION = 'rateLimits';
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds

/**
 * Extract the client IP from the request.
 * Supports X-Forwarded-For header (common in Cloud Functions behind load balancers).
 */
function getClientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

/**
 * Check rate limit for the given IP address.
 * Uses Firestore to track submissions within the sliding window.
 * Returns true if the request should be rate-limited (rejected).
 */
async function isRateLimited(ip: string): Promise<boolean> {
  const db = getFirestore();
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const rateLimitRef = db.collection(RATE_LIMIT_COLLECTION);

  // Query for submissions from this IP within the sliding window
  const recentSubmissions = await rateLimitRef
    .where('ip', '==', ip)
    .where('timestamp', '>', windowStart)
    .get();

  if (recentSubmissions.size >= RATE_LIMIT_MAX) {
    return true;
  }

  // Record this submission for rate limiting
  await rateLimitRef.add({
    ip,
    timestamp: now,
  });

  return false;
}

/**
 * Trigger async admin notification for a new lead.
 * Deferred to background processing to keep response time under 200ms.
 */
function triggerAdminNotification(leadId: string, type: string): void {
  // Fire-and-forget: log for now, actual email/notification deferred to background task
  // In production, this would publish to a Pub/Sub topic or write to a notifications queue
  logger.info('[Lead Notification] New lead captured', { leadId, type });
}

/**
 * Public lead capture endpoint.
 * POST /api/leads
 */
export const leads_create = onRequest(
  { cors: true },
  async (req, res) => {
    // Only accept POST method
    if (req.method !== 'POST') {
      res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Only POST method is accepted.',
        },
      });
      return;
    }

    const clientIp = getClientIp(req);

    // Rate limiting check
    try {
      const limited = await isRateLimited(clientIp);
      if (limited) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
          },
        });
        return;
      }
    } catch (err) {
      // If rate limit check fails, allow the request through (fail open)
      logger.error('[Rate Limit] Error checking rate limit', { ip: clientIp, error: err });
    }

    // Honeypot field detection — silently discard bot submissions
    const body = req.body || {};
    if (body.website || body._hp) {
      // Bot detected — return fake success to avoid revealing detection
      res.status(200).json({
        success: true,
        data: { leadId: 'received' },
      });
      return;
    }

    // Validate input with Zod schema
    const parseResult = LeadCreateSchema.safeParse(body);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = issue.message;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed.',
          fields: fieldErrors,
        },
      });
      return;
    }

    const input = parseResult.data;
    const db = getFirestore();

    // Auto-generate lead ID
    const leadRef = db.collection(LEADS_COLLECTION).doc();
    const leadId = leadRef.id;

    // Build the lead document
    const leadData: Record<string, unknown> = {
      leadId,
      email: input.email,
      type: input.type,
      source: input.source,
      marketingConsent: input.marketingConsent,
      utm: input.utm,
      status: 'new',
      createdAt: FieldValue.serverTimestamp(),
    };

    // Optional fields
    if (input.name !== undefined) leadData.name = input.name;
    if (input.company !== undefined) leadData.company = input.company;
    if (input.phone !== undefined) leadData.phone = input.phone;
    if (input.projectId !== undefined) leadData.projectId = input.projectId;
    if (input.message !== undefined) leadData.message = input.message;
    if (input.industry !== undefined) leadData.industry = input.industry;
    if (input.budget !== undefined) leadData.budget = input.budget;

    // Write to Firestore
    try {
      await leadRef.set(leadData);
    } catch (err) {
      logger.error('[Lead Create] Firestore write failed', { leadId, error: err });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL',
          message: 'Failed to store lead. Please try again.',
        },
      });
      return;
    }

    // Trigger async admin notification (fire-and-forget)
    triggerAdminNotification(leadId, input.type);

    // Return success
    res.status(200).json({
      success: true,
      data: { leadId },
    });
  }
);
