// shared/creditUtils.ts — Price calculation, formatting, and certificate ID utilities
// Used by both frontend (Next.js) and backend (Cloud Functions)

import { randomBytes } from 'crypto';

/**
 * Calculate the total purchase price in ZAR integer cents.
 * Applies an optional package discount percentage.
 *
 * @param quantity - Number of metric tons to purchase
 * @param unitPriceCents - Price per ton in ZAR integer cents
 * @param packageDiscount - Optional discount percentage (e.g. 10 for 10%)
 * @returns Total price in ZAR integer cents (always an integer)
 */
export function calculatePurchasePrice(
  quantity: number,
  unitPriceCents: number,
  packageDiscount?: number
): number {
  const basePrice = quantity * unitPriceCents;
  if (packageDiscount && packageDiscount > 0) {
    return Math.round(basePrice * (1 - packageDiscount / 100));
  }
  return Math.round(basePrice);
}

/**
 * Format a value in ZAR cents as a display string.
 * Example: 1500000 → "R 15 000,00" (en-ZA locale)
 *
 * @param cents - Amount in ZAR integer cents
 * @returns Formatted ZAR string for display
 */
export function formatZAR(cents: number): string {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

/**
 * Build the Cloud Storage path for a certificate PDF.
 * Follows the convention: certificates/{funderId}/{transactionId}.pdf
 *
 * @param funderId - The funder's user ID
 * @param transactionId - The purchase transaction ID
 * @returns The Cloud Storage path string
 */
export function buildStoragePath(funderId: string, transactionId: string): string {
  return `certificates/${funderId}/${transactionId}.pdf`;
}

/**
 * Generate a unique 16-character alphanumeric certificate ID.
 * Uses crypto.randomBytes for cryptographic randomness.
 *
 * @returns A 16-character string containing only [a-zA-Z0-9]
 */
export function generateCertificateId(): string {
  // Generate enough random bytes to ensure we get at least 16 alphanumeric chars
  // after filtering. Base64url gives ~4/3 chars per byte; filtering removes
  // non-alphanumeric chars (-, _). 24 bytes → 32 base64url chars → plenty after filtering.
  let id = '';
  while (id.length < 16) {
    const bytes = randomBytes(24);
    id += bytes.toString('base64url').replace(/[^a-zA-Z0-9]/g, '');
  }
  return id.slice(0, 16);
}
