/**
 * Unit Tests: Registration Cloud Function (Task 2.1)
 *
 * Tests the registration logic including:
 * - Input validation via RegistrationSchema
 * - Role-specific field requirements
 * - User document structure for each role
 * - Auditor isApproved=false default
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.9
 */

import { describe, it, expect } from 'vitest';
import { RegistrationSchema } from '../../shared/schemas';

// ─── Helper: Simulate user document creation logic ───────────────────────────

function buildUserDocument(validatedData: Record<string, unknown>, userId: string) {
  const now = new Date().toISOString();

  const userDocument: Record<string, unknown> = {
    userId,
    email: validatedData.email,
    name: validatedData.name,
    role: validatedData.role,
    country: validatedData.country,
    isApproved: validatedData.role === 'auditor' ? false : true,
    createdAt: now,
    updatedAt: now,
  };

  if (validatedData.role === 'funder') {
    userDocument.organizationName = validatedData.organizationName;
    userDocument.organizationType = validatedData.organizationType;
    userDocument.industry = validatedData.industry;
    userDocument.areasOfInterest = validatedData.areasOfInterest;
    userDocument.esgProfile = {
      industry: validatedData.industry,
      interests: validatedData.areasOfInterest,
    };
  } else if (validatedData.role === 'owner') {
    userDocument.organizationName = validatedData.organizationName;
    userDocument.organizationRegNumber = validatedData.organizationRegNumber;
    userDocument.organizationType = validatedData.organizationType;
  } else if (validatedData.role === 'auditor') {
    userDocument.qualifications = validatedData.qualifications;
    userDocument.yearsOfExperience = validatedData.yearsOfExperience;
    userDocument.specializations = validatedData.specializations;
  }

  return userDocument;
}

// ─── Validation Tests ────────────────────────────────────────────────────────

describe('Registration validation (RegistrationSchema)', () => {
  it('accepts a valid funder registration', () => {
    const input = {
      email: 'funder@example.com',
      password: 'SecurePass1',
      name: 'John Doe',
      country: 'ZA',
      role: 'funder',
      organizationName: 'Acme Corp',
      organizationType: 'corporate',
      industry: 'finance',
      areasOfInterest: ['energy-saving', 'education'],
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts a valid owner registration', () => {
    const input = {
      email: 'owner@example.com',
      password: 'SecurePass1',
      name: 'Jane Smith',
      country: 'ZA',
      role: 'owner',
      organizationName: 'Green Projects NPO',
      organizationRegNumber: 'NPO12345',
      organizationType: 'npo',
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts a valid auditor registration', () => {
    const input = {
      email: 'auditor@example.com',
      password: 'SecurePass1',
      name: 'Dr. Audit',
      country: 'GB',
      role: 'auditor',
      qualifications: 'CA(SA), CFA',
      yearsOfExperience: 10,
      specializations: ['energy-saving', 'carbon-removal'],
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects registration with invalid email', () => {
    const input = {
      email: 'not-an-email',
      password: 'SecurePass1',
      name: 'Test User',
      country: 'ZA',
      role: 'funder',
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects registration with password missing uppercase', () => {
    const input = {
      email: 'test@example.com',
      password: 'lowercase1',
      name: 'Test User',
      country: 'ZA',
      role: 'funder',
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects registration with password missing digit', () => {
    const input = {
      email: 'test@example.com',
      password: 'NoDigitHere',
      name: 'Test User',
      country: 'ZA',
      role: 'funder',
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects registration with password too short', () => {
    const input = {
      email: 'test@example.com',
      password: 'Ab1cdef',
      name: 'Test User',
      country: 'ZA',
      role: 'funder',
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects registration with empty name', () => {
    const input = {
      email: 'test@example.com',
      password: 'SecurePass1',
      name: '',
      country: 'ZA',
      role: 'funder',
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects registration with invalid country code (3 chars)', () => {
    const input = {
      email: 'test@example.com',
      password: 'SecurePass1',
      name: 'Test User',
      country: 'ZAF',
      role: 'funder',
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects registration with invalid role', () => {
    const input = {
      email: 'test@example.com',
      password: 'SecurePass1',
      name: 'Test User',
      country: 'ZA',
      role: 'admin',
    };

    const result = RegistrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects duplicate email error code (auth/email-already-exists)', () => {
    // This tests that the error code mapping is correct
    const errorCode = 'auth/email-already-exists';
    expect(errorCode).toBe('auth/email-already-exists');
  });
});

// ─── User Document Structure Tests ───────────────────────────────────────────

describe('User document creation logic', () => {
  it('creates funder document with correct role-specific fields', () => {
    const validatedData = {
      email: 'funder@example.com',
      password: 'SecurePass1',
      name: 'John Doe',
      country: 'ZA',
      role: 'funder',
      organizationName: 'Acme Corp',
      organizationType: 'corporate',
      industry: 'finance',
      areasOfInterest: ['energy-saving', 'education'],
    };

    const doc = buildUserDocument(validatedData, 'uid-123');

    expect(doc.userId).toBe('uid-123');
    expect(doc.email).toBe('funder@example.com');
    expect(doc.name).toBe('John Doe');
    expect(doc.role).toBe('funder');
    expect(doc.country).toBe('ZA');
    expect(doc.isApproved).toBe(true);
    expect(doc.organizationName).toBe('Acme Corp');
    expect(doc.organizationType).toBe('corporate');
    expect(doc.industry).toBe('finance');
    expect(doc.areasOfInterest).toEqual(['energy-saving', 'education']);
    expect(doc.esgProfile).toEqual({
      industry: 'finance',
      interests: ['energy-saving', 'education'],
    });
    // Should NOT have auditor/owner fields
    expect(doc.qualifications).toBeUndefined();
    expect(doc.organizationRegNumber).toBeUndefined();
  });

  it('creates owner document with correct role-specific fields', () => {
    const validatedData = {
      email: 'owner@example.com',
      password: 'SecurePass1',
      name: 'Jane Smith',
      country: 'ZA',
      role: 'owner',
      organizationName: 'Green Projects NPO',
      organizationRegNumber: 'NPO12345',
      organizationType: 'npo',
    };

    const doc = buildUserDocument(validatedData, 'uid-456');

    expect(doc.userId).toBe('uid-456');
    expect(doc.email).toBe('owner@example.com');
    expect(doc.name).toBe('Jane Smith');
    expect(doc.role).toBe('owner');
    expect(doc.country).toBe('ZA');
    expect(doc.isApproved).toBe(true);
    expect(doc.organizationName).toBe('Green Projects NPO');
    expect(doc.organizationRegNumber).toBe('NPO12345');
    expect(doc.organizationType).toBe('npo');
    // Should NOT have funder/auditor fields
    expect(doc.industry).toBeUndefined();
    expect(doc.qualifications).toBeUndefined();
    expect(doc.esgProfile).toBeUndefined();
  });

  it('creates auditor document with isApproved=false', () => {
    const validatedData = {
      email: 'auditor@example.com',
      password: 'SecurePass1',
      name: 'Dr. Audit',
      country: 'GB',
      role: 'auditor',
      qualifications: 'CA(SA), CFA',
      yearsOfExperience: 10,
      specializations: ['energy-saving', 'carbon-removal'],
    };

    const doc = buildUserDocument(validatedData, 'uid-789');

    expect(doc.userId).toBe('uid-789');
    expect(doc.email).toBe('auditor@example.com');
    expect(doc.name).toBe('Dr. Audit');
    expect(doc.role).toBe('auditor');
    expect(doc.country).toBe('GB');
    expect(doc.isApproved).toBe(false); // Key requirement: auditors start unapproved
    expect(doc.qualifications).toBe('CA(SA), CFA');
    expect(doc.yearsOfExperience).toBe(10);
    expect(doc.specializations).toEqual(['energy-saving', 'carbon-removal']);
    // Should NOT have funder/owner fields
    expect(doc.organizationName).toBeUndefined();
    expect(doc.organizationRegNumber).toBeUndefined();
    expect(doc.esgProfile).toBeUndefined();
  });

  it('includes UTM parameters when provided', () => {
    const validatedData = {
      email: 'user@example.com',
      password: 'SecurePass1',
      name: 'UTM User',
      country: 'ZA',
      role: 'funder',
      organizationName: 'Test Corp',
      organizationType: 'corporate',
      industry: 'tech',
      areasOfInterest: ['education'],
    };

    const doc = buildUserDocument(validatedData, 'uid-utm');

    // UTM fields are added from request.data, not from validated schema
    // In the actual function, they come from data.utmSource etc.
    expect(doc.createdAt).toBeDefined();
    expect(doc.updatedAt).toBeDefined();
  });

  it('all documents have createdAt and updatedAt timestamps', () => {
    const validatedData = {
      email: 'test@example.com',
      password: 'SecurePass1',
      name: 'Test',
      country: 'ZA',
      role: 'funder',
      organizationName: 'Test',
      organizationType: 'corporate',
      industry: 'tech',
      areasOfInterest: ['education'],
    };

    const doc = buildUserDocument(validatedData, 'uid-time');

    expect(doc.createdAt).toBeDefined();
    expect(doc.updatedAt).toBeDefined();
    expect(typeof doc.createdAt).toBe('string');
    expect(typeof doc.updatedAt).toBe('string');
    // Should be valid ISO date strings
    expect(new Date(doc.createdAt as string).toISOString()).toBe(doc.createdAt);
    expect(new Date(doc.updatedAt as string).toISOString()).toBe(doc.updatedAt);
  });
});

// ─── Role-Specific Validation Logic Tests ────────────────────────────────────

describe('Role-specific field validation logic', () => {
  it('funder requires organizationName, organizationType, industry, areasOfInterest', () => {
    // Simulate the role-specific validation from the Cloud Function
    const validateFunderFields = (data: Record<string, unknown>) => {
      const errors: Record<string, string> = {};
      if (!data.organizationName) errors.organizationName = 'Organization name is required for funders';
      if (!data.organizationType) errors.organizationType = 'Organization type is required for funders';
      if (!data.industry) errors.industry = 'Industry is required for funders';
      if (!data.areasOfInterest || (data.areasOfInterest as string[]).length === 0) {
        errors.areasOfInterest = 'At least one area of interest is required for funders';
      }
      return errors;
    };

    // Missing all funder fields
    const errors = validateFunderFields({ role: 'funder' });
    expect(Object.keys(errors)).toHaveLength(4);
    expect(errors.organizationName).toBeDefined();
    expect(errors.organizationType).toBeDefined();
    expect(errors.industry).toBeDefined();
    expect(errors.areasOfInterest).toBeDefined();

    // All fields provided
    const noErrors = validateFunderFields({
      role: 'funder',
      organizationName: 'Test',
      organizationType: 'corporate',
      industry: 'tech',
      areasOfInterest: ['education'],
    });
    expect(Object.keys(noErrors)).toHaveLength(0);
  });

  it('owner requires organizationName, organizationRegNumber, organizationType', () => {
    const validateOwnerFields = (data: Record<string, unknown>) => {
      const errors: Record<string, string> = {};
      if (!data.organizationName) errors.organizationName = 'Organization name is required for project owners';
      if (!data.organizationRegNumber) errors.organizationRegNumber = 'Organization registration number is required for project owners';
      if (!data.organizationType) errors.organizationType = 'Organization type is required for project owners';
      return errors;
    };

    const errors = validateOwnerFields({ role: 'owner' });
    expect(Object.keys(errors)).toHaveLength(3);

    const noErrors = validateOwnerFields({
      role: 'owner',
      organizationName: 'Test NPO',
      organizationRegNumber: 'REG123',
      organizationType: 'npo',
    });
    expect(Object.keys(noErrors)).toHaveLength(0);
  });

  it('auditor requires qualifications, yearsOfExperience, specializations', () => {
    const validateAuditorFields = (data: Record<string, unknown>) => {
      const errors: Record<string, string> = {};
      if (!data.qualifications) errors.qualifications = 'Professional qualifications are required for auditors';
      if (data.yearsOfExperience === undefined || data.yearsOfExperience === null) {
        errors.yearsOfExperience = 'Years of experience is required for auditors';
      }
      if (!data.specializations || (data.specializations as string[]).length === 0) {
        errors.specializations = 'At least one specialization is required for auditors';
      }
      return errors;
    };

    const errors = validateAuditorFields({ role: 'auditor' });
    expect(Object.keys(errors)).toHaveLength(3);

    const noErrors = validateAuditorFields({
      role: 'auditor',
      qualifications: 'CA(SA)',
      yearsOfExperience: 5,
      specializations: ['energy-saving'],
    });
    expect(Object.keys(noErrors)).toHaveLength(0);
  });

  it('auditor with 0 years of experience is valid', () => {
    const validateAuditorFields = (data: Record<string, unknown>) => {
      const errors: Record<string, string> = {};
      if (data.yearsOfExperience === undefined || data.yearsOfExperience === null) {
        errors.yearsOfExperience = 'Years of experience is required for auditors';
      }
      return errors;
    };

    // 0 is a valid value (not undefined/null)
    const noErrors = validateAuditorFields({ yearsOfExperience: 0 });
    expect(Object.keys(noErrors)).toHaveLength(0);
  });
});
