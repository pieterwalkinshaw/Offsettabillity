/**
 * Property Test: Token validation on callable endpoints (Property 39)
 *
 * Validates: Requirements 13.4, 13.5
 *
 * For any request to a Cloud Function callable endpoint with an expired or
 * malformed Firebase ID token, the system SHALL reject the request with an
 * UNAUTHENTICATED error without processing the request body.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Token Validation Logic ──────────────────────────────────────────────────

interface DecodedToken {
  uid: string;
  email?: string;
  role?: string;
  iat: number;
  exp: number;
}

interface TokenValidationSuccess {
  success: true;
  data: DecodedToken;
}

interface TokenValidationError {
  success: false;
  error: {
    code: 'UNAUTHENTICATED';
    message: string;
  };
}

type TokenValidationResult = TokenValidationSuccess | TokenValidationError;

/**
 * Simulates Firebase token validation logic for callable endpoints.
 * - null/undefined → UNAUTHENTICATED
 * - empty string → UNAUTHENTICATED
 * - malformed (not a valid JWT structure) → UNAUTHENTICATED
 * - expired (exp < now) → UNAUTHENTICATED
 * - valid → returns decoded token with uid
 */
function validateToken(token: string | null | undefined): TokenValidationResult {
  // Null or undefined token
  if (token == null) {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'No token provided' },
    };
  }

  // Empty string token
  if (token.trim() === '') {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'No token provided' },
    };
  }

  // JWT structure check: must have exactly 3 base64url-encoded parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Malformed token' },
    };
  }

  // Each part must be non-empty and valid base64url characters
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  for (const part of parts) {
    if (part.length === 0 || !base64urlRegex.test(part)) {
      return {
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Malformed token' },
      };
    }
  }

  // Attempt to decode the payload (second part)
  let payload: Record<string, unknown>;
  try {
    const decoded = Buffer.from(parts[1], 'base64url').toString('utf-8');
    payload = JSON.parse(decoded);
  } catch {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Malformed token' },
    };
  }

  // Must have uid
  if (typeof payload.uid !== 'string' || payload.uid.length === 0) {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Malformed token' },
    };
  }

  // Must have exp as a number
  if (typeof payload.exp !== 'number') {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Malformed token' },
    };
  }

  // Check expiration (exp is in seconds since epoch)
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSeconds) {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Token expired' },
    };
  }

  // Valid token
  return {
    success: true,
    data: {
      uid: payload.uid as string,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      iat: typeof payload.iat === 'number' ? payload.iat : nowSeconds,
      exp: payload.exp,
    },
  };
}

// ─── Helper: Create a JWT-like token from a payload ──────────────────────────

function createJwtToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from('fake-signature-for-testing').toString('base64url');
  return `${header}.${body}.${signature}`;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid uid */
const validUid = fc.stringMatching(/^[a-zA-Z0-9]{8,28}$/);

/** Generate a valid email */
const validEmail = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/),
  fc.stringMatching(/^[a-z]{2,6}$/),
  fc.constantFrom('com', 'org', 'co.za')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Generate a valid role */
const validRole = fc.constantFrom('funder', 'owner', 'auditor', 'admin');

/** Generate a future expiration time (valid token) */
const futureExp = fc.integer({ min: 1, max: 86400 * 365 }).map(
  (offset) => Math.floor(Date.now() / 1000) + offset
);

/** Generate a past expiration time (expired token) */
const pastExp = fc.integer({ min: 1, max: 86400 * 365 }).map(
  (offset) => Math.floor(Date.now() / 1000) - offset
);

/** Generate a valid token payload */
const validTokenPayload = fc.record({
  uid: validUid,
  email: validEmail,
  role: validRole,
  iat: fc.constant(Math.floor(Date.now() / 1000) - 300),
  exp: futureExp,
});

/** Generate a valid JWT token string */
const validTokenString = validTokenPayload.map((payload) => createJwtToken(payload));

/** Generate an expired token payload */
const expiredTokenPayload = fc.record({
  uid: validUid,
  email: validEmail,
  role: validRole,
  iat: fc.constant(Math.floor(Date.now() / 1000) - 7200),
  exp: pastExp,
});

/** Generate an expired JWT token string */
const expiredTokenString = expiredTokenPayload.map((payload) => createJwtToken(payload));

/** Generate a malformed token string (not valid JWT structure) */
const malformedToken = fc.oneof(
  // No dots at all
  fc.stringMatching(/^[a-zA-Z0-9_-]{5,50}$/),
  // Only one dot (two parts)
  fc.tuple(
    fc.stringMatching(/^[a-zA-Z0-9_-]{3,20}$/),
    fc.stringMatching(/^[a-zA-Z0-9_-]{3,20}$/)
  ).map(([a, b]) => `${a}.${b}`),
  // Four or more dots
  fc.tuple(
    fc.stringMatching(/^[a-zA-Z0-9_-]{3,10}$/),
    fc.stringMatching(/^[a-zA-Z0-9_-]{3,10}$/),
    fc.stringMatching(/^[a-zA-Z0-9_-]{3,10}$/),
    fc.stringMatching(/^[a-zA-Z0-9_-]{3,10}$/)
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
  // Three parts but payload is not valid base64url JSON
  fc.tuple(
    fc.stringMatching(/^[a-zA-Z0-9_-]{3,20}$/),
    fc.stringMatching(/^[a-zA-Z0-9_-]{3,20}$/),
    fc.stringMatching(/^[a-zA-Z0-9_-]{3,20}$/)
  ).map(([a, b, c]) => `${a}.${b}.${c}`),
  // Empty parts
  fc.constantFrom('..', 'abc..def', '.payload.sig', 'header..sig'),
  // Contains invalid characters for base64url
  fc.constant('hea der.pay load.sig nature')
);

/** Generate null or undefined */
const nullOrUndefined = fc.constantFrom(null, undefined);

/** Generate empty or whitespace-only strings */
const emptyOrWhitespace = fc.constantFrom('', ' ', '  ', '\t', '\n', '  \t\n  ');

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 39: Token validation on callable endpoints', () => {
  /**
   * **Validates: Requirements 13.4, 13.5**
   * For any null/undefined/empty token, validation returns UNAUTHENTICATED.
   */
  it('null, undefined, or empty tokens are rejected with UNAUTHENTICATED', () => {
    fc.assert(
      fc.property(
        fc.oneof(nullOrUndefined, emptyOrWhitespace),
        (token) => {
          const result = validateToken(token);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.code).toBe('UNAUTHENTICATED');
            expect(result.error.message).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.5**
   * For any malformed token string (not valid JWT structure), validation returns UNAUTHENTICATED.
   */
  it('malformed tokens are rejected with UNAUTHENTICATED', () => {
    fc.assert(
      fc.property(malformedToken, (token) => {
        const result = validateToken(token);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('UNAUTHENTICATED');
          expect(result.error.message).toBeDefined();
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.5**
   * For any expired token (exp in the past), validation returns UNAUTHENTICATED.
   */
  it('expired tokens are rejected with UNAUTHENTICATED', () => {
    fc.assert(
      fc.property(expiredTokenString, (token) => {
        const result = validateToken(token);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('UNAUTHENTICATED');
          expect(result.error.message).toBe('Token expired');
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.4**
   * For any valid token with uid and future expiration, validation succeeds and returns the uid.
   */
  it('valid tokens with uid and future expiration are accepted', () => {
    fc.assert(
      fc.property(validTokenPayload, (payload) => {
        const token = createJwtToken(payload);
        const result = validateToken(token);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.uid).toBe(payload.uid);
          expect(result.data.exp).toBe(payload.exp);
        }
      }),
      { numRuns: 200 }
    );
  });
});
