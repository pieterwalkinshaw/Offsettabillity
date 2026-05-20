'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import type { TaxonomyCategory } from '@shared/types';
import { TaxonomyCategorySchema } from '@shared/schemas';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  id: string;
  name: string;
  description: string;
  primaryMetricLabel: string;
  icon: string;
  sdgNumbers: string; // comma-separated for input
  sortOrder: string;
  isActive: boolean;
}

interface FieldErrors {
  [key: string]: string;
}

type ToastType = 'success' | 'error';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyForm: FormData = {
  id: '',
  name: '',
  description: '',
  primaryMetricLabel: '',
  icon: '',
  sdgNumbers: '',
  sortOrder: '0',
  isActive: true,
};

function categoryToForm(cat: TaxonomyCategory): FormData {
  return {
    id: cat.id,
    name: cat.name,
    description: cat.description ?? '',
    primaryMetricLabel: cat.primaryMetricLabel,
    icon: cat.icon ?? '',
    sdgNumbers: cat.sdgNumbers?.join(', ') ?? '',
    sortOrder: String(cat.sortOrder),
    isActive: cat.isActive,
  };
}

function parseFormToPayload(form: FormData) {
  const sdgNumbers = form.sdgNumbers
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(Number)
    .filter((n) => !isNaN(n));

  return {
    id: form.id.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    primaryMetricLabel: form.primaryMetricLabel.trim(),
    icon: form.icon.trim() || undefined,
    sdgNumbers: sdgNumbers.length > 0 ? sdgNumbers : undefined,
    isActive: form.isActive,
    sortOrder: parseInt(form.sortOrder, 10) || 0,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminTaxonomyPage() {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ─── Toast Management ────────────────────────────────────────────────────

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    const duration = type === 'error' ? 6000 : 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  // ─── Fetch Categories ────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'taxonomy'), orderBy('sortOrder', 'asc'));
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
      showToast('error', 'Failed to load categories. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ─── Form Handlers ───────────────────────────────────────────────────────

  function openCreateForm() {
    setFormData(emptyForm);
    setFieldErrors({});
    setFormMode('create');
  }

  function openEditForm(cat: TaxonomyCategory) {
    setFormData(categoryToForm(cat));
    setFieldErrors({});
    setFormMode('edit');
  }

  function closeForm() {
    setFormMode('closed');
    setFormData(emptyForm);
    setFieldErrors({});
  }

  function handleFieldChange(field: keyof FormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  // ─── Submit (Create / Update) ────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const payload = parseFormToPayload(formData);

    // Client-side Zod validation
    const result = TaxonomyCategorySchema.safeParse(payload);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        errors[path] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      if (formMode === 'create') {
        const taxonomyCreate = httpsCallable(functions, 'taxonomy_create');
        await taxonomyCreate(payload);
        showToast('success', `Category "${payload.name}" created successfully.`);
      } else {
        const taxonomyUpdate = httpsCallable(functions, 'taxonomy_update');
        await taxonomyUpdate(payload);
        showToast('success', `Category "${payload.name}" updated successfully.`);
      }
      closeForm();
      await fetchCategories();
    } catch (err: unknown) {
      // Extract field errors from Cloud Function response
      const error = err as { details?: { error?: { fields?: FieldErrors; message?: string } }; message?: string };
      if (error.details?.error?.fields) {
        setFieldErrors(error.details.error.fields);
      } else {
        const message = error.details?.error?.message ?? error.message ?? 'An unexpected error occurred.';
        showToast('error', message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Deactivate ──────────────────────────────────────────────────────────

  async function handleDeactivate(cat: TaxonomyCategory) {
    setSubmitting(true);
    try {
      const taxonomyUpdate = httpsCallable(functions, 'taxonomy_update');
      await taxonomyUpdate({ ...cat, isActive: false });
      showToast('success', `Category "${cat.name}" deactivated.`);
      await fetchCategories();
    } catch (err: unknown) {
      const error = err as { message?: string };
      showToast('error', error.message ?? 'Failed to deactivate category.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReactivate(cat: TaxonomyCategory) {
    setSubmitting(true);
    try {
      const taxonomyUpdate = httpsCallable(functions, 'taxonomy_update');
      await taxonomyUpdate({ ...cat, isActive: true });
      showToast('success', `Category "${cat.name}" reactivated.`);
      await fetchCategories();
    } catch (err: unknown) {
      const error = err as { message?: string };
      showToast('error', error.message ?? 'Failed to reactivate category.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-primary-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Taxonomy Management</h1>
            <p className="text-foreground/60 mt-1">
              Manage project categories, metrics, and classification.
            </p>
          </div>
          {formMode === 'closed' && (
            <button
              onClick={openCreateForm}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Add Category
            </button>
          )}
        </div>

        {/* Create / Edit Form */}
        {formMode !== 'closed' && (
          <div className="mb-8 bg-white dark:bg-slate-800 border border-foreground/10 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {formMode === 'create' ? 'Create New Category' : `Edit: ${formData.name}`}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ID */}
              <div>
                <label htmlFor="cat-id" className="block text-sm font-medium text-foreground/80 mb-1">
                  ID (lowercase, hyphens only)
                </label>
                <input
                  id="cat-id"
                  type="text"
                  value={formData.id}
                  onChange={(e) => handleFieldChange('id', e.target.value)}
                  disabled={formMode === 'edit'}
                  placeholder="e.g. clean-energy"
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.id ? 'border-red-500' : 'border-foreground/20'
                  } ${formMode === 'edit' ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
                {fieldErrors.id && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.id}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label htmlFor="cat-name" className="block text-sm font-medium text-foreground/80 mb-1">
                  Display Name
                </label>
                <input
                  id="cat-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="e.g. Clean Energy Projects"
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.name ? 'border-red-500' : 'border-foreground/20'
                  }`}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
                )}
              </div>

              {/* Primary Metric Label */}
              <div>
                <label htmlFor="cat-metric" className="block text-sm font-medium text-foreground/80 mb-1">
                  Primary Metric Label
                </label>
                <input
                  id="cat-metric"
                  type="text"
                  value={formData.primaryMetricLabel}
                  onChange={(e) => handleFieldChange('primaryMetricLabel', e.target.value)}
                  placeholder="e.g. kWh Saved"
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.primaryMetricLabel ? 'border-red-500' : 'border-foreground/20'
                  }`}
                />
                {fieldErrors.primaryMetricLabel && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.primaryMetricLabel}</p>
                )}
              </div>

              {/* Icon */}
              <div>
                <label htmlFor="cat-icon" className="block text-sm font-medium text-foreground/80 mb-1">
                  Icon (Lucide name)
                </label>
                <input
                  id="cat-icon"
                  type="text"
                  value={formData.icon}
                  onChange={(e) => handleFieldChange('icon', e.target.value)}
                  placeholder="e.g. zap, sun, leaf"
                  className="w-full px-3 py-2 rounded-lg border border-foreground/20 text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* SDG Numbers */}
              <div>
                <label htmlFor="cat-sdg" className="block text-sm font-medium text-foreground/80 mb-1">
                  SDG Numbers (comma-separated, 1–17)
                </label>
                <input
                  id="cat-sdg"
                  type="text"
                  value={formData.sdgNumbers}
                  onChange={(e) => handleFieldChange('sdgNumbers', e.target.value)}
                  placeholder="e.g. 7, 13"
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.sdgNumbers ? 'border-red-500' : 'border-foreground/20'
                  }`}
                />
                {fieldErrors.sdgNumbers && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.sdgNumbers}</p>
                )}
              </div>

              {/* Sort Order */}
              <div>
                <label htmlFor="cat-sort" className="block text-sm font-medium text-foreground/80 mb-1">
                  Sort Order (0–999)
                </label>
                <input
                  id="cat-sort"
                  type="number"
                  min="0"
                  max="999"
                  value={formData.sortOrder}
                  onChange={(e) => handleFieldChange('sortOrder', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.sortOrder ? 'border-red-500' : 'border-foreground/20'
                  }`}
                />
                {fieldErrors.sortOrder && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.sortOrder}</p>
                )}
              </div>

              {/* Description (full width) */}
              <div className="md:col-span-2">
                <label htmlFor="cat-desc" className="block text-sm font-medium text-foreground/80 mb-1">
                  Description (optional, max 500 chars)
                </label>
                <textarea
                  id="cat-desc"
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  rows={3}
                  placeholder="Brief description of this category..."
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none ${
                    fieldErrors.description ? 'border-red-500' : 'border-foreground/20'
                  }`}
                />
                {fieldErrors.description && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
                )}
              </div>

              {/* Active Status (edit mode only) */}
              {formMode === 'edit' && (
                <div className="flex items-center gap-2">
                  <input
                    id="cat-active"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                    className="h-4 w-4 rounded border-foreground/30 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="cat-active" className="text-sm text-foreground/80">
                    Active
                  </label>
                </div>
              )}

              {/* Form Actions */}
              <div className="md:col-span-2 flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? 'Saving...'
                    : formMode === 'create'
                    ? 'Create Category'
                    : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="px-4 py-2 border border-foreground/20 text-foreground/70 rounded-lg font-medium hover:bg-foreground/5 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Categories Table */}
        {loading ? (
          // Skeleton loading state
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-foreground/5 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : categories.length === 0 ? (
          // Empty state
          <div className="text-center py-16 bg-white dark:bg-slate-800 border border-foreground/10 rounded-xl">
            <div className="text-4xl mb-3">📂</div>
            <h3 className="text-lg font-semibold text-foreground">No categories yet</h3>
            <p className="text-foreground/60 mt-1 mb-4">
              Create your first taxonomy category to get started.
            </p>
            {formMode === 'closed' && (
              <button
                onClick={openCreateForm}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                Add Category
              </button>
            )}
          </div>
        ) : (
          // Table
          <div className="overflow-x-auto bg-white dark:bg-slate-800 border border-foreground/10 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10">
                  <th className="text-left px-4 py-3 font-medium text-foreground/60">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/60">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/60 hidden md:table-cell">
                    Primary Metric
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/60 hidden lg:table-cell">
                    SDGs
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/60">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-foreground/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className="border-b border-foreground/5 last:border-b-0 hover:bg-foreground/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-foreground/70 font-mono text-xs">
                      {cat.sortOrder}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{cat.name}</div>
                      <div className="text-xs text-foreground/50 mt-0.5">{cat.id}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground/70 hidden md:table-cell">
                      {cat.primaryMetricLabel}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {cat.sdgNumbers && cat.sdgNumbers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {cat.sdgNumbers.map((n: number) => (
                            <span
                              key={n}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          cat.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditForm(cat)}
                          disabled={submitting}
                          className="px-3 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 border border-primary-200 rounded-md hover:bg-primary-50 dark:border-primary-800 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-50"
                        >
                          Edit
                        </button>
                        {cat.isActive ? (
                          <button
                            onClick={() => handleDeactivate(cat)}
                            disabled={submitting}
                            className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-md hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(cat)}
                            disabled={submitting}
                            className="px-3 py-1 text-xs font-medium text-green-600 hover:text-green-700 border border-green-200 rounded-md hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
