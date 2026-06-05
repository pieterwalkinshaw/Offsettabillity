'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import { ProjectCreateSchema } from '@shared/schemas';
import type { TaxonomyCategory } from '@shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = ['Basic Info', 'Location & Funding', 'Impact Metrics', 'Documents'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENTS = 10;
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const ACCEPTED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg';

const REPORTING_PERIODS = ['Monthly', 'Quarterly', 'Annually', 'Project Duration'] as const;

const COUNTRIES: { code: string; name: string }[] = [
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'GH', name: 'Ghana' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'BW', name: 'Botswana' },
  { code: 'NA', name: 'Namibia' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'SN', name: 'Senegal' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'CM', name: 'Cameroon' },
  { code: 'AO', name: 'Angola' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'CN', name: 'China' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'AU', name: 'Australia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'CA', name: 'Canada' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'CH', name: 'Switzerland' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  title: string;
  description: string;
  category: string;
  address: string;
  country: string;
  fundingGoalDisplay: string; // formatted ZAR string for display
  reportingPeriod: string;
  primaryMetricValue: string;
}

interface FieldErrors {
  [key: string]: string;
}

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatZAR(cents: number): string {
  const rands = cents / 100;
  return `R ${rands.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseZARInput(value: string): number {
  // Remove currency symbol, spaces, and commas
  const cleaned = value.replace(/[R\s,]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100); // Convert to cents
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


// ─── Component ───────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: '',
    address: '',
    country: 'ZA',
    fundingGoalDisplay: '',
    reportingPeriod: '',
    primaryMetricValue: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get selected category details
  const selectedCategory = categories.find((c) => c.id === formData.category);

  // ─── Fetch Active Taxonomy Categories ──────────────────────────────────

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const q = query(
        collection(db, 'taxonomy'),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const snapshot = await getDocs(q);
      const cats: TaxonomyCategory[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: data.id ?? doc.id,
          name: data.name,
          description: data.description,
          primaryMetricLabel: data.primaryMetricLabel,
          icon: data.icon,
          sdgNumbers: data.sdgNumbers,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        } as TaxonomyCategory;
      });
      setCategories(cats);
    } catch {
      // Silently fail — categories will show empty
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ─── Form Handlers ─────────────────────────────────────────────────────

  function handleFieldChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleFundingGoalChange(value: string) {
    // Allow only digits and decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    setFormData((prev) => ({ ...prev, fundingGoalDisplay: cleaned }));
    if (fieldErrors.fundingGoal) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.fundingGoal;
        return next;
      });
    }
  }

  function handleFundingGoalBlur() {
    const cents = parseZARInput(formData.fundingGoalDisplay);
    if (cents > 0) {
      setFormData((prev) => ({
        ...prev,
        fundingGoalDisplay: formatZAR(cents).replace('R ', ''),
      }));
    }
  }

  // ─── File Upload Handlers ───────────────────────────────────────────────

  function validateFile(file: File): string | undefined {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return 'File type not supported. Use PDF, PNG, or JPEG.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File exceeds 5 MB limit (${formatFileSize(file.size)}).`;
    }
    return undefined;
  }

  function addFiles(newFiles: FileList | File[]) {
    const fileArray = Array.from(newFiles);
    const remaining = MAX_DOCUMENTS - files.length;

    if (remaining <= 0) {
      setFieldErrors((prev) => ({
        ...prev,
        documents: `Maximum ${MAX_DOCUMENTS} documents allowed.`,
      }));
      return;
    }

    const toAdd = fileArray.slice(0, remaining);
    const uploadFiles: UploadFile[] = toAdd.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      name: file.name,
      size: file.size,
      error: validateFile(file),
    }));

    setFiles((prev) => [...prev, ...uploadFiles]);
    if (fieldErrors.documents) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.documents;
        return next;
      });
    }
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  // ─── Step Validation ────────────────────────────────────────────────────

  function validateCurrentStep(): boolean {
    const errors: FieldErrors = {};

    if (currentStep === 0) {
      if (!formData.title.trim()) errors.title = 'Title is required.';
      else if (formData.title.trim().length > 120) errors.title = 'Title must be 120 characters or fewer.';
      if (!formData.description.trim()) errors.description = 'Description is required.';
      else if (formData.description.trim().length > 5000) errors.description = 'Description must be 5000 characters or fewer.';
      if (!formData.category) errors.category = 'Please select a category.';
    }

    if (currentStep === 1) {
      if (!formData.address.trim()) errors.address = 'Address is required.';
      if (!formData.country) errors.country = 'Please select a country.';
      const cents = parseZARInput(formData.fundingGoalDisplay);
      if (!formData.fundingGoalDisplay.trim()) {
        errors.fundingGoal = 'Funding goal is required.';
      } else if (cents < 1000) {
        errors.fundingGoal = 'Minimum funding goal is R 10.00 (1000 cents).';
      } else if (cents > 999999999) {
        errors.fundingGoal = 'Maximum funding goal is R 9,999,999.99.';
      }
    }

    if (currentStep === 2) {
      if (!formData.reportingPeriod) errors.reportingPeriod = 'Please select a reporting period.';
      if (!formData.primaryMetricValue.trim()) {
        errors.primaryMetricValue = 'Primary metric value is required.';
      } else if (isNaN(Number(formData.primaryMetricValue))) {
        errors.primaryMetricValue = 'Must be a valid number.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  }

  function handleBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  // ─── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitError(null);

    // Build the payload
    const fundingGoalCents = parseZARInput(formData.fundingGoalDisplay);
    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      location: {
        lat: 0, // Placeholder — geocoding not in scope for this task
        lng: 0,
        address: formData.address.trim(),
        country: formData.country,
      },
      fundingGoal: fundingGoalCents,
      impactMetrics: {
        reportingPeriod: formData.reportingPeriod as
          | 'Monthly'
          | 'Quarterly'
          | 'Annually'
          | 'Project Duration',
        primaryMetric: {
          label: selectedCategory?.primaryMetricLabel || 'Impact Units',
          value: Number(formData.primaryMetricValue),
        },
      },
    };

    // Full Zod validation
    const result = ProjectCreateSchema.safeParse(payload);
    if (!result.success) {
      const errors: FieldErrors = {};
      const errorMessages: string[] = [];
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        const msg = `${path}: ${issue.message}`;
        errorMessages.push(msg);
        if (path.includes('title')) errors.title = issue.message;
        else if (path.includes('description')) errors.description = issue.message;
        else if (path.includes('category')) errors.category = issue.message;
        else if (path.includes('address')) errors.address = issue.message;
        else if (path.includes('country')) errors.country = issue.message;
        else if (path.includes('fundingGoal')) errors.fundingGoal = issue.message;
        else if (path.includes('reportingPeriod')) errors.reportingPeriod = issue.message;
        else if (path.includes('primaryMetric') || path.includes('label')) errors.primaryMetricValue = issue.message;
      }
      setFieldErrors(errors);
      setSubmitError(`Validation failed: ${errorMessages.join('; ')}`);
      // Navigate to the first step with errors
      if (errors.title || errors.description || errors.category) setCurrentStep(0);
      else if (errors.address || errors.country || errors.fundingGoal) setCurrentStep(1);
      else if (errors.reportingPeriod || errors.primaryMetricValue) setCurrentStep(2);
      return;
    }

    setSubmitting(true);

    try {
      // Create the project via Cloud Function
      const projectsCreate = httpsCallable<typeof payload, { projectId: string }>(
        functions,
        'projects_create'
      );
      const response = await projectsCreate(payload);
      const projectId = response.data.projectId;

      // Upload documents
      const validFiles = files.filter((f) => !f.error);
      if (validFiles.length > 0) {
        const projectsUploadDocument = httpsCallable(functions, 'projects_uploadDocument');
        for (const uploadFile of validFiles) {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]); // Remove data URL prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(uploadFile.file);
          });

          await projectsUploadDocument({
            projectId,
            fileName: uploadFile.name,
            contentType: uploadFile.file.type,
            data: base64,
          });
        }
      }

      setSubmitSuccess(true);
    } catch (err: unknown) {
      const error = err as { details?: { error?: { fields?: FieldErrors; message?: string } }; message?: string };
      if (error.details?.error?.fields) {
        setFieldErrors(error.details.error.fields);
      } else {
        setSubmitError(
          error.details?.error?.message ?? error.message ?? 'Failed to create project. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success State ──────────────────────────────────────────────────────

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Project Created</h1>
          <p className="text-foreground/60 mb-6">
            Your project has been saved as a draft. Upload supporting documents and submit for verification when ready.
          </p>
          <a
            href="/dashboard/projects"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            View My Projects
          </a>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Create New Project</h1>
          <p className="text-foreground/60 mt-1">
            Fill in the details below to list your impact project on the platform.
          </p>
        </div>

        {/* Progress Indicator */}
        <nav aria-label="Progress" className="mb-8">
          <ol className="flex items-center gap-2">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-2 flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      index < currentStep
                        ? 'bg-primary-600 text-white'
                        : index === currentStep
                        ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                        : 'bg-foreground/10 text-foreground/50'
                    }`}
                  >
                    {index < currentStep ? '✓' : index + 1}
                  </div>
                  <span
                    className={`text-xs mt-1 text-center hidden sm:block ${
                      index <= currentStep ? 'text-foreground/80 font-medium' : 'text-foreground/40'
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 rounded ${
                      index < currentStep ? 'bg-primary-600' : 'bg-foreground/10'
                    }`}
                  />
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-800 border border-foreground/10 rounded-xl p-6 shadow-sm">
          {/* Step 1: Basic Info */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>

              {/* Title */}
              <div>
                <label htmlFor="project-title" className="block text-sm font-medium text-foreground/80 mb-1">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="project-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="e.g. Solar Panel Installation for Rural Schools"
                  maxLength={120}
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.title ? 'border-red-500' : 'border-foreground/20'
                  }`}
                />
                <div className="flex justify-between mt-1">
                  {fieldErrors.title && (
                    <p className="text-xs text-red-600" role="alert">{fieldErrors.title}</p>
                  )}
                  <span className="text-xs text-foreground/40 ml-auto">
                    {formData.title.length}/120
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="project-description" className="block text-sm font-medium text-foreground/80 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="project-description"
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Describe your project's goals, methodology, and expected impact..."
                  rows={5}
                  maxLength={5000}
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none ${
                    fieldErrors.description ? 'border-red-500' : 'border-foreground/20'
                  }`}
                />
                <div className="flex justify-between mt-1">
                  {fieldErrors.description && (
                    <p className="text-xs text-red-600" role="alert">{fieldErrors.description}</p>
                  )}
                  <span className="text-xs text-foreground/40 ml-auto">
                    {formData.description.length}/5000
                  </span>
                </div>
              </div>

              {/* Category */}
              <div>
                <label htmlFor="project-category" className="block text-sm font-medium text-foreground/80 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                {loadingCategories ? (
                  <div className="w-full h-10 bg-foreground/5 rounded-lg animate-pulse" />
                ) : (
                  <select
                    id="project-category"
                    value={formData.category}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      fieldErrors.category ? 'border-red-500' : 'border-foreground/20'
                    }`}
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
                {fieldErrors.category && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.category}</p>
                )}
                {selectedCategory && (
                  <p className="mt-1 text-xs text-foreground/50">
                    Primary metric: {selectedCategory.primaryMetricLabel}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Location & Funding */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground mb-4">Location & Funding</h2>

              {/* Address */}
              <div>
                <label htmlFor="project-address" className="block text-sm font-medium text-foreground/80 mb-1">
                  Project Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="project-address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  placeholder="e.g. 123 Main Road, Cape Town"
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.address ? 'border-red-500' : 'border-foreground/20'
                  }`}
                />
                {fieldErrors.address && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.address}</p>
                )}
              </div>

              {/* Country */}
              <div>
                <label htmlFor="project-country" className="block text-sm font-medium text-foreground/80 mb-1">
                  Country <span className="text-red-500">*</span>
                </label>
                <select
                  id="project-country"
                  value={formData.country}
                  onChange={(e) => handleFieldChange('country', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.country ? 'border-red-500' : 'border-foreground/20'
                  }`}
                >
                  <option value="">Select a country...</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.country && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.country}</p>
                )}
              </div>

              {/* Funding Goal */}
              <div>
                <label htmlFor="project-funding" className="block text-sm font-medium text-foreground/80 mb-1">
                  Funding Goal (ZAR) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground/50">
                    R
                  </span>
                  <input
                    id="project-funding"
                    type="text"
                    inputMode="decimal"
                    value={formData.fundingGoalDisplay}
                    onChange={(e) => handleFundingGoalChange(e.target.value)}
                    onBlur={handleFundingGoalBlur}
                    placeholder="1,500.00"
                    className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      fieldErrors.fundingGoal ? 'border-red-500' : 'border-foreground/20'
                    }`}
                  />
                </div>
                {fieldErrors.fundingGoal && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.fundingGoal}</p>
                )}
                <p className="mt-1 text-xs text-foreground/40">
                  Enter the amount in Rands. Stored as integer cents internally.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Impact Metrics */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground mb-4">Impact Metrics</h2>

              {/* Reporting Period */}
              <div>
                <label htmlFor="project-period" className="block text-sm font-medium text-foreground/80 mb-1">
                  Reporting Period <span className="text-red-500">*</span>
                </label>
                <select
                  id="project-period"
                  value={formData.reportingPeriod}
                  onChange={(e) => handleFieldChange('reportingPeriod', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.reportingPeriod ? 'border-red-500' : 'border-foreground/20'
                  }`}
                >
                  <option value="">Select reporting period...</option>
                  {REPORTING_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
                {fieldErrors.reportingPeriod && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.reportingPeriod}</p>
                )}
              </div>

              {/* Primary Metric */}
              <div>
                <label htmlFor="project-metric" className="block text-sm font-medium text-foreground/80 mb-1">
                  {selectedCategory?.primaryMetricLabel ?? 'Primary Metric Value'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  id="project-metric"
                  type="text"
                  inputMode="numeric"
                  value={formData.primaryMetricValue}
                  onChange={(e) => handleFieldChange('primaryMetricValue', e.target.value)}
                  placeholder="e.g. 500"
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.primaryMetricValue ? 'border-red-500' : 'border-foreground/20'
                  }`}
                />
                {fieldErrors.primaryMetricValue && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.primaryMetricValue}</p>
                )}
                {selectedCategory && (
                  <p className="mt-1 text-xs text-foreground/50">
                    Measured in: {selectedCategory.primaryMetricLabel}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Documents */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground mb-4">Supporting Documents</h2>
              <p className="text-sm text-foreground/60 -mt-2 mb-4">
                Upload supporting documents (PDF, PNG, JPEG). Max 5 MB each, up to 10 files.
              </p>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                aria-label="Upload documents. Click or drag files here."
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                    : 'border-foreground/20 hover:border-foreground/40'
                } ${files.length >= MAX_DOCUMENTS ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="text-3xl mb-2">📄</div>
                <p className="text-sm font-medium text-foreground/70">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-xs text-foreground/40 mt-1">
                  PDF, PNG, JPEG — Max 5 MB per file
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>

              {fieldErrors.documents && (
                <p className="text-xs text-red-600" role="alert">{fieldErrors.documents}</p>
              )}

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-foreground/50 font-medium">
                    {files.length}/{MAX_DOCUMENTS} documents
                  </p>
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                        f.error
                          ? 'border-red-300 bg-red-50 dark:bg-red-900/10'
                          : 'border-foreground/10 bg-foreground/[0.02]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground truncate">{f.name}</p>
                        <p className={`text-xs ${f.error ? 'text-red-600' : 'text-foreground/40'}`}>
                          {f.error ?? formatFileSize(f.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        className="ml-3 text-foreground/40 hover:text-red-600 transition-colors"
                        aria-label={`Remove ${f.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit Error */}
          {submitError && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300" role="alert">{submitError}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-foreground/10">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="px-4 py-2 border border-foreground/20 text-foreground/70 rounded-lg font-medium hover:bg-foreground/5 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating Project...' : 'Create Project'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
