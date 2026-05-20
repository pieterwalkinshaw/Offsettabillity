/**
 * PII-Safe Logger Utility
 *
 * Sanitizes log output by replacing PII fields (email, name, phone)
 * with placeholders before writing to Cloud Functions logs.
 *
 * Per the Data Dictionary, fields marked as PII (🔒) are:
 * - email
 * - name
 * - phone
 *
 * These must NEVER appear in Cloud Functions log output (Requirement 12.3).
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.info('Lead created', { leadId, email, type });
 *   // Output: Lead created { leadId: "abc123", email: "[REDACTED]", type: "calculator" }
 */

/** Fields that are considered PII and must be redacted from logs */
const PII_FIELDS: ReadonlySet<string> = new Set([
  'email',
  'name',
  'phone',
  'displayName',
  'fullName',
  'firstName',
  'lastName',
  'phoneNumber',
]);

/** Placeholder used to replace PII values in log output */
const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Recursively sanitize an object by replacing PII field values with placeholders.
 * Returns a new object — does not mutate the original.
 */
export function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item));
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (PII_FIELDS.has(key.toLowerCase()) || PII_FIELDS.has(key)) {
        sanitized[key] = REDACTED_PLACEHOLDER;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Format a log message with optional sanitized data context.
 */
function formatMessage(message: string, data?: unknown): string {
  if (data === undefined) {
    return message;
  }
  const sanitized = sanitize(data);
  try {
    return `${message} ${JSON.stringify(sanitized)}`;
  } catch {
    return `${message} [unserializable data]`;
  }
}

/**
 * PII-safe logger that wraps console methods.
 * All structured data passed to these methods is automatically sanitized
 * to remove PII fields before output.
 */
export const logger = {
  /**
   * Log an informational message. PII fields in data are redacted.
   */
  info(message: string, data?: unknown): void {
    console.log(formatMessage(message, data));
  },

  /**
   * Log a warning message. PII fields in data are redacted.
   */
  warn(message: string, data?: unknown): void {
    console.warn(formatMessage(message, data));
  },

  /**
   * Log an error message. PII fields in data are redacted.
   */
  error(message: string, data?: unknown): void {
    console.error(formatMessage(message, data));
  },

  /**
   * Log a debug message. PII fields in data are redacted.
   */
  debug(message: string, data?: unknown): void {
    console.debug(formatMessage(message, data));
  },
};

export default logger;
