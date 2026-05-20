import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitize, logger } from '../../functions/src/utils/logger';

describe('PII-Safe Logger Utility', () => {
  describe('sanitize', () => {
    it('should redact email field', () => {
      const input = { email: 'user@example.com', type: 'calculator' };
      const result = sanitize(input) as Record<string, unknown>;
      expect(result.email).toBe('[REDACTED]');
      expect(result.type).toBe('calculator');
    });

    it('should redact name field', () => {
      const input = { name: 'John Doe', role: 'funder' };
      const result = sanitize(input) as Record<string, unknown>;
      expect(result.name).toBe('[REDACTED]');
      expect(result.role).toBe('funder');
    });

    it('should redact phone field', () => {
      const input = { phone: '+27123456789', country: 'ZA' };
      const result = sanitize(input) as Record<string, unknown>;
      expect(result.phone).toBe('[REDACTED]');
      expect(result.country).toBe('ZA');
    });

    it('should redact multiple PII fields simultaneously', () => {
      const input = {
        email: 'test@test.com',
        name: 'Jane Smith',
        phone: '0821234567',
        leadId: 'lead-123',
        type: 'consultation',
      };
      const result = sanitize(input) as Record<string, unknown>;
      expect(result.email).toBe('[REDACTED]');
      expect(result.name).toBe('[REDACTED]');
      expect(result.phone).toBe('[REDACTED]');
      expect(result.leadId).toBe('lead-123');
      expect(result.type).toBe('consultation');
    });

    it('should redact PII in nested objects', () => {
      const input = {
        leadId: 'lead-456',
        user: {
          email: 'nested@example.com',
          name: 'Nested User',
          role: 'admin',
        },
      };
      const result = sanitize(input) as Record<string, unknown>;
      const user = result.user as Record<string, unknown>;
      expect(user.email).toBe('[REDACTED]');
      expect(user.name).toBe('[REDACTED]');
      expect(user.role).toBe('admin');
    });

    it('should redact PII in arrays of objects', () => {
      const input = [
        { email: 'a@b.com', id: '1' },
        { email: 'c@d.com', id: '2' },
      ];
      const result = sanitize(input) as Array<Record<string, unknown>>;
      expect(result[0].email).toBe('[REDACTED]');
      expect(result[0].id).toBe('1');
      expect(result[1].email).toBe('[REDACTED]');
      expect(result[1].id).toBe('2');
    });

    it('should handle null and undefined values', () => {
      expect(sanitize(null)).toBeNull();
      expect(sanitize(undefined)).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(sanitize('hello')).toBe('hello');
      expect(sanitize(42)).toBe(42);
      expect(sanitize(true)).toBe(true);
    });

    it('should not mutate the original object', () => {
      const input = { email: 'original@test.com', id: '123' };
      sanitize(input);
      expect(input.email).toBe('original@test.com');
    });

    it('should redact displayName and phoneNumber variants', () => {
      const input = { displayName: 'Test User', phoneNumber: '+1234567890', userId: 'uid-1' };
      const result = sanitize(input) as Record<string, unknown>;
      expect(result.displayName).toBe('[REDACTED]');
      expect(result.phoneNumber).toBe('[REDACTED]');
      expect(result.userId).toBe('uid-1');
    });

    it('should preserve non-PII fields in deeply nested structures', () => {
      const input = {
        data: {
          user: {
            email: 'deep@test.com',
            profile: {
              name: 'Deep User',
              country: 'ZA',
            },
          },
        },
      };
      const result = sanitize(input) as Record<string, unknown>;
      const data = result.data as Record<string, unknown>;
      const user = data.user as Record<string, unknown>;
      const profile = user.profile as Record<string, unknown>;
      expect(user.email).toBe('[REDACTED]');
      expect(profile.name).toBe('[REDACTED]');
      expect(profile.country).toBe('ZA');
    });
  });

  describe('logger methods', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should call console.log with sanitized data for info()', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Test message', { email: 'secret@test.com', id: '123' });
      expect(spy).toHaveBeenCalledWith(
        'Test message {"email":"[REDACTED]","id":"123"}'
      );
    });

    it('should call console.warn with sanitized data for warn()', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('Warning', { name: 'Secret Name', code: 'ERR' });
      expect(spy).toHaveBeenCalledWith(
        'Warning {"name":"[REDACTED]","code":"ERR"}'
      );
    });

    it('should call console.error with sanitized data for error()', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('Error occurred', { phone: '0821234567', errorCode: 500 });
      expect(spy).toHaveBeenCalledWith(
        'Error occurred {"phone":"[REDACTED]","errorCode":500}'
      );
    });

    it('should handle messages without data', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Simple message');
      expect(spy).toHaveBeenCalledWith('Simple message');
    });
  });
});
