'use client';

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes } from 'firebase/storage';
import { functions, storage } from '@/lib/firebase/config';
import { RegistrationSchema } from '../../../../shared/schemas';
import { getUtmParams } from '@/lib/hooks/useUtmCapture';
import { Loader2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

type Role = 'funder' | 'owner' | 'auditor';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  country: string;
  role: Role | '';
  // Funder fields
  organizationName: string;
  organizationType: string;
  industry: string;
  areasOfInterest: string[];
  // Owner fields
  organizationRegNumber: string;
  // Auditor fields
  qualifications: string;
  yearsOfExperience: string;
  specializations: string[];
  cvFile: File | null;
}

const initialFormData: FormData = {
  email: '',
  password: '',
  confirmPassword: '',
  name: '',
  country: '',
  role: '',
  organizationName: '',
  organizationType: '',
  industry: '',
  areasOfInterest: [],
  organizationRegNumber: '',
  qualifications: '',
  yearsOfExperience: '',
  specializations: [],
  cvFile: null,
};

const ORGANIZATION_TYPES = [
  'Corporate',
  'NGO',
  'Government',
  'Individual',
];

const INDUSTRIES = [
  'Agriculture',
  'Construction',
  'Education',
  'Energy',
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Mining',
  'Retail',
  'Technology',
  'Transport',
  'Other',
];

const SPECIALIZATIONS = [
  'Energy Saving & Efficiency',
  'Renewable Energy',
  'Carbon Removal & Sequestration',
  'Education & Skills Development',
  'Healthcare & Wellness',
  'Food Security & Agriculture',
  'Clean Water & Sanitation',
  'Waste Management & Recycling',
  'Biodiversity & Conservation',
  'Affordable Housing',
  'Digital Inclusion & Connectivity',
  'Gender Equality & Empowerment',
];

const COUNTRIES = [
  { code: 'ZA', name: 'South Africa' },
  { code: 'BW', name: 'Botswana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'NA', name: 'Namibia' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'NL', name: 'Netherlands' },
];

const MAX_CV_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_CV_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const updateField = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear field error on change
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setSubmitError('');
    },
    []
  );

  const validateStep1 = (): boolean => {
    if (!formData.role) {
      setErrors({ role: 'Please select a role to continue' });
      return false;
    }
    setErrors({});
    return true;
  };

  const validateStep2 = (): boolean => {
    const stepErrors: Record<string, string> = {};

    if (!formData.email) {
      stepErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      stepErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      stepErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      stepErrors.password = 'Password must be at least 8 characters';
    } else if (formData.password.length > 64) {
      stepErrors.password = 'Password must be at most 64 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      stepErrors.password =
        'Password must contain uppercase, lowercase, and digit';
    }

    if (!formData.confirmPassword) {
      stepErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      stepErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.name) {
      stepErrors.name = 'Full name is required';
    } else if (formData.name.length > 100) {
      stepErrors.name = 'Name must be at most 100 characters';
    }

    if (!formData.country) {
      stepErrors.country = 'Country is required';
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const stepErrors: Record<string, string> = {};

    if (formData.role === 'funder') {
      if (!formData.organizationName) {
        stepErrors.organizationName = 'Organization name is required';
      }
      if (!formData.organizationType) {
        stepErrors.organizationType = 'Organization type is required';
      }
      if (!formData.industry) {
        stepErrors.industry = 'Industry is required';
      }
      if (formData.areasOfInterest.length === 0) {
        stepErrors.areasOfInterest =
          'Select at least one area of interest';
      }
    } else if (formData.role === 'owner') {
      if (!formData.organizationName) {
        stepErrors.organizationName = 'Organization name is required';
      }
      if (!formData.organizationRegNumber) {
        stepErrors.organizationRegNumber =
          'Registration number is required';
      }
      if (!formData.organizationType) {
        stepErrors.organizationType = 'Organization type is required';
      }
    } else if (formData.role === 'auditor') {
      if (!formData.qualifications) {
        stepErrors.qualifications = 'Qualifications are required';
      }
      if (!formData.yearsOfExperience) {
        stepErrors.yearsOfExperience = 'Years of experience is required';
      }
      else if (isNaN(Number(formData.yearsOfExperience)) || Number(formData.yearsOfExperience) < 0) {
        stepErrors.yearsOfExperience = 'Please enter a valid number';
      }
      if (formData.specializations.length === 0) {
        stepErrors.specializations =
          'Select at least one specialization';
      }
      // CV validation (optional but if provided, must be valid)
      if (formData.cvFile) {
        if (!ACCEPTED_CV_TYPES.includes(formData.cvFile.type)) {
          stepErrors.cvFile = 'Only PDF and DOCX files are accepted';
        } else if (formData.cvFile.size > MAX_CV_SIZE) {
          stepErrors.cvFile = 'File size must not exceed 5 MB';
        }
      }
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
    setErrors({});
    setSubmitError('');
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    // Full schema validation before submit
    const payload = {
      email: formData.email,
      password: formData.password,
      name: formData.name,
      country: formData.country,
      role: formData.role as Role,
      ...(formData.role === 'funder' && {
        organizationName: formData.organizationName,
        organizationType: formData.organizationType,
        industry: formData.industry,
        areasOfInterest: formData.areasOfInterest,
      }),
      ...(formData.role === 'owner' && {
        organizationName: formData.organizationName,
        organizationRegNumber: formData.organizationRegNumber,
        organizationType: formData.organizationType,
      }),
      ...(formData.role === 'auditor' && {
        qualifications: formData.qualifications,
        yearsOfExperience: Number(formData.yearsOfExperience),
        specializations: formData.specializations,
      }),
    };

    const parseResult = RegistrationSchema.safeParse(payload);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const fieldPath = issue.path.join('.');
        if (fieldPath && !fieldErrors[fieldPath]) {
          fieldErrors[fieldPath] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Upload CV if present (auditor)
      let cvPath: string | undefined;
      if (formData.role === 'auditor' && formData.cvFile) {
        const timestamp = Date.now();
        const ext = formData.cvFile.name.split('.').pop();
        const cvRef = ref(
          storage,
          `auditor-cvs/${formData.email}-${timestamp}.${ext}`
        );
        await uploadBytes(cvRef, formData.cvFile);
        cvPath = cvRef.fullPath;
      }

      // Attach UTM params from session
      const utmParams = getUtmParams();

      const registerFn = httpsCallable(functions, 'auth_register');
      await registerFn({
        ...payload,
        ...(cvPath && { cvPath }),
        ...(utmParams?.source && { utmSource: utmParams.source }),
        ...(utmParams?.medium && { utmMedium: utmParams.medium }),
        ...(utmParams?.campaign && { utmCampaign: utmParams.campaign }),
      });

      setIsSuccess(true);
    } catch (err: unknown) {
      const error = err as {
        code?: string;
        message?: string;
        details?: {
          code?: string;
          fields?: Record<string, string>;
        };
      };

      if (error.details?.code === 'ALREADY_EXISTS') {
        setErrors({ email: 'This email is already registered' });
        setStep(2); // Go back to email step to show the error
      } else if (error.details?.fields) {
        setErrors(error.details.fields);
      } else {
        setSubmitError(
          error.message || 'Registration failed. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Registration Successful
          </h1>
          <p className="text-gray-600">
            {formData.role === 'auditor'
              ? 'Your account has been created and is pending admin approval. You will be notified once approved.'
              : 'Your account has been created. You can now log in to access your dashboard.'}
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  s <= step
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Role</span>
            <span>Account</span>
            <span>Details</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Create your account
          </h1>
          <p className="text-gray-500 mb-6 text-sm">
            {step === 1 && 'Choose how you want to use Offsettabillity'}
            {step === 2 && 'Enter your account details'}
            {step === 3 && 'Complete your profile'}
          </p>

          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <RoleCard
                role="funder"
                title="Funder"
                description="Fund verified ESG impact projects and build your portfolio"
                selected={formData.role === 'funder'}
                onSelect={() => updateField('role', 'funder')}
              />
              <RoleCard
                role="owner"
                title="Project Owner"
                description="List your impact project for verification and funding"
                selected={formData.role === 'owner'}
                onSelect={() => updateField('role', 'owner')}
              />
              <RoleCard
                role="auditor"
                title="Auditor"
                description="Verify project claims as an independent professional"
                selected={formData.role === 'auditor'}
                onSelect={() => updateField('role', 'auditor')}
              />
              {errors.role && (
                <p className="text-sm text-red-600" role="alert" aria-live="polite">
                  {errors.role}
                </p>
              )}
            </div>
          )}

          {/* Step 2: Common Fields */}
          {step === 2 && (
            <div className="space-y-4">
              <InputField
                label="Email address"
                type="email"
                value={formData.email}
                onChange={(v) => updateField('email', v)}
                error={errors.email}
                placeholder="you@company.com"
                autoComplete="email"
              />
              <InputField
                label="Full name"
                type="text"
                value={formData.name}
                onChange={(v) => updateField('name', v)}
                error={errors.name}
                placeholder="Your full name"
                autoComplete="name"
              />
              <InputField
                label="Password"
                type="password"
                value={formData.password}
                onChange={(v) => updateField('password', v)}
                error={errors.password}
                placeholder="Min 8 chars, uppercase, lowercase, digit"
                autoComplete="new-password"
              />
              <InputField
                label="Confirm password"
                type="password"
                value={formData.confirmPassword}
                onChange={(v) => updateField('confirmPassword', v)}
                error={errors.confirmPassword}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
              <SelectField
                label="Country"
                value={formData.country}
                onChange={(v) => updateField('country', v)}
                error={errors.country}
                options={COUNTRIES.map((c) => ({
                  value: c.code,
                  label: c.name,
                }))}
                placeholder="Select your country"
              />
            </div>
          )}

          {/* Step 3: Role-Specific Fields */}
          {step === 3 && formData.role === 'funder' && (
            <div className="space-y-4">
              <InputField
                label="Organization name"
                type="text"
                value={formData.organizationName}
                onChange={(v) => updateField('organizationName', v)}
                error={errors.organizationName}
                placeholder="Your organization"
              />
              <SelectField
                label="Organization type"
                value={formData.organizationType}
                onChange={(v) => updateField('organizationType', v)}
                error={errors.organizationType}
                options={ORGANIZATION_TYPES.map((t) => ({
                  value: t,
                  label: t,
                }))}
                placeholder="Select type"
              />
              <SelectField
                label="Industry"
                value={formData.industry}
                onChange={(v) => updateField('industry', v)}
                error={errors.industry}
                options={INDUSTRIES.map((i) => ({
                  value: i,
                  label: i,
                }))}
                placeholder="Select industry"
              />
              <CheckboxGroup
                label="Areas of interest"
                options={SPECIALIZATIONS}
                selected={formData.areasOfInterest}
                onChange={(v) => updateField('areasOfInterest', v)}
                error={errors.areasOfInterest}
              />
            </div>
          )}

          {step === 3 && formData.role === 'owner' && (
            <div className="space-y-4">
              <InputField
                label="Organization name"
                type="text"
                value={formData.organizationName}
                onChange={(v) => updateField('organizationName', v)}
                error={errors.organizationName}
                placeholder="Your organization"
              />
              <SelectField
                label="Organization type"
                value={formData.organizationType}
                onChange={(v) => updateField('organizationType', v)}
                error={errors.organizationType}
                options={ORGANIZATION_TYPES.map((t) => ({
                  value: t,
                  label: t,
                }))}
                placeholder="Select type"
              />
              <InputField
                label="Registration number"
                type="text"
                value={formData.organizationRegNumber}
                onChange={(v) => updateField('organizationRegNumber', v)}
                error={errors.organizationRegNumber}
                placeholder="e.g. 2024/123456/07"
              />
            </div>
          )}

          {step === 3 && formData.role === 'auditor' && (
            <div className="space-y-4">
              <InputField
                label="Professional qualifications"
                type="text"
                value={formData.qualifications}
                onChange={(v) => updateField('qualifications', v)}
                error={errors.qualifications}
                placeholder="e.g. CA(SA), CFA, ISO 14001 Lead Auditor"
              />
              <InputField
                label="Years of experience"
                type="number"
                value={formData.yearsOfExperience}
                onChange={(v) => updateField('yearsOfExperience', v)}
                error={errors.yearsOfExperience}
                placeholder="0"
              />
              <CheckboxGroup
                label="Specializations"
                options={SPECIALIZATIONS}
                selected={formData.specializations}
                onChange={(v) => updateField('specializations', v)}
                error={errors.specializations}
              />
              <FileUpload
                label="CV / Resume (optional)"
                accept=".pdf,.docx"
                file={formData.cvFile}
                onChange={(f) => updateField('cvFile', f)}
                error={errors.cvFile}
                hint="PDF or DOCX, max 5 MB"
              />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isSubmitting}
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>
            )}
          </div>

          {/* Login link */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a
              href="/login"
              className="text-primary-600 font-medium hover:text-primary-700"
            >
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function RoleCard({
  role,
  title,
  description,
  selected,
  onSelect,
}: {
  role: string;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
        selected
          ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-primary-600' : 'border-gray-300'
          }`}
        >
          {selected && (
            <div className="w-2 h-2 rounded-full bg-primary-600" />
          )}
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </button>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-primary-500 focus:ring-primary-200'
        } focus:outline-none focus:ring-2`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  error,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-primary-500 focus:ring-primary-200'
        } focus:outline-none focus:ring-2 ${!value ? 'text-gray-400' : 'text-foreground'}`}
      >
        <option value="" disabled>
          {placeholder || 'Select...'}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
  error,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
        {options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function FileUpload({
  label,
  accept,
  file,
  onChange,
  error,
  hint,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  hint?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    onChange(selected);
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          error
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 hover:border-primary-400 bg-gray-50'
        }`}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
        {file ? (
          <p className="text-sm text-primary-700 font-medium">
            {file.name}{' '}
            <span className="text-gray-500 font-normal">
              ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            Click or drag to upload
          </p>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
