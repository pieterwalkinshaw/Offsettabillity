'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type { Lead, LeadStatus, LeadType } from '@shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  contacted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  qualified: 'bg-purple-100 text-purple-700 border-purple-200',
  converted: 'bg-green-100 text-green-700 border-green-200',
  lost: 'bg-red-100 text-red-700 border-red-200',
};

const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  calculator: 'Calculator',
  report_request: 'Report Request',
  consultation: 'Consultation',
  newsletter: 'Newsletter',
  auditor_inquiry: 'Auditor Inquiry',
};

// ─── Skeleton Components ─────────────────────────────────────────────────────

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
      <div className="h-4 w-40 bg-gray-200 rounded" />
      <div className="h-4 w-24 bg-gray-200 rounded" />
      <div className="h-4 w-20 bg-gray-200 rounded" />
      <div className="h-4 w-28 bg-gray-200 rounded" />
      <div className="h-8 w-24 bg-gray-200 rounded ml-auto" />
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
          <div className="h-6 w-10 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Error Component ─────────────────────────────────────────────────────────

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-red-500 shrink-0" aria-hidden="true">⚠️</span>
        <p className="text-sm text-red-700 truncate">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

// ─── Empty State Component ───────────────────────────────────────────────────

function EmptyState({ icon, title, description }: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-foreground/60 mt-1">{description}</p>
    </div>
  );
}

// ─── Status Badge Component ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${LEAD_STATUS_COLORS[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Lead Row Component ──────────────────────────────────────────────────────

function LeadRow({
  lead,
  onUpdateStatus,
  onUpdateNotes,
  isUpdating,
}: {
  lead: Lead;
  onUpdateStatus: (leadId: string, status: LeadStatus) => void;
  onUpdateNotes: (leadId: string, notes: string) => void;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notesValue, setNotesValue] = useState(lead.notes || '');
  const [notesError, setNotesError] = useState<string | null>(null);

  function handleNotesSubmit() {
    if (notesValue.length > 2000) {
      setNotesError('Notes must not exceed 2000 characters.');
      return;
    }
    setNotesError(null);
    onUpdateNotes(lead.leadId, notesValue);
  }

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
        aria-label={`Toggle details for lead ${lead.email}`}
      >
        <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[180px] truncate">
          {lead.email}
        </td>
        <td className="px-4 py-3 text-sm text-foreground/70">
          {lead.name || '—'}
        </td>
        <td className="px-4 py-3 text-sm">
          <StatusBadge status={lead.status} />
        </td>
        <td className="px-4 py-3 text-sm text-foreground/70">
          {LEAD_TYPE_LABELS[lead.type] || lead.type}
        </td>
        <td className="px-4 py-3 text-sm text-foreground/70">
          {lead.createdAt
            ? new Date(lead.createdAt).toLocaleDateString()
            : '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-foreground/50 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50/50">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lead Details */}
              <div className="space-y-2 text-sm">
                <h4 className="font-medium text-foreground">Details</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-foreground/70">
                  <span className="font-medium">Company:</span>
                  <span>{lead.company || '—'}</span>
                  <span className="font-medium">Phone:</span>
                  <span>{lead.phone || '—'}</span>
                  <span className="font-medium">Source:</span>
                  <span className="truncate max-w-[200px]">{lead.source || '—'}</span>
                  <span className="font-medium">Consent:</span>
                  <span>{lead.marketingConsent ? 'Yes' : 'No'}</span>
                  {lead.industry && (
                    <>
                      <span className="font-medium">Industry:</span>
                      <span>{lead.industry}</span>
                    </>
                  )}
                  {lead.budget != null && (
                    <>
                      <span className="font-medium">Budget:</span>
                      <span>R {(lead.budget / 100).toLocaleString('en-ZA')}</span>
                    </>
                  )}
                  {lead.message && (
                    <>
                      <span className="font-medium">Message:</span>
                      <span className="col-span-1 break-words">{lead.message}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status Update + Notes */}
              <div className="space-y-3">
                {/* Status Update */}
                <div>
                  <label
                    htmlFor={`status-${lead.leadId}`}
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Update Status
                  </label>
                  <select
                    id={`status-${lead.leadId}`}
                    value={lead.status}
                    onChange={(e) => onUpdateStatus(lead.leadId, e.target.value as LeadStatus)}
                    disabled={isUpdating}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label
                    htmlFor={`notes-${lead.leadId}`}
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Notes
                  </label>
                  <textarea
                    id={`notes-${lead.leadId}`}
                    value={notesValue}
                    onChange={(e) => {
                      setNotesValue(e.target.value);
                      if (notesError && e.target.value.length <= 2000) {
                        setNotesError(null);
                      }
                    }}
                    maxLength={2000}
                    rows={3}
                    disabled={isUpdating}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                    placeholder="Add internal follow-up notes..."
                  />
                  <div className="flex items-center justify-between mt-1">
                    <div>
                      {notesError && (
                        <p className="text-xs text-red-600" role="alert">{notesError}</p>
                      )}
                    </div>
                    <span className="text-xs text-foreground/50">
                      {notesValue.length}/2000
                    </span>
                  </div>
                  <button
                    onClick={handleNotesSubmit}
                    disabled={isUpdating || notesValue === (lead.notes || '')}
                    className="mt-2 inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? (
                      <>
                        <svg
                          className="animate-spin -ml-0.5 mr-1.5 h-3.5 w-3.5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save Notes'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Lead Management Page Component ──────────────────────────────────────────

function LeadManagementPage() {
  const { userProfile } = useAuth();

  const [leads, setLeads] = useState<SectionState<Lead[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  // ─── Fetch All Leads ───────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    setLeads((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const q = query(
        collection(db, 'leads'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        leadId: doc.id,
      })) as Lead[];

      setLeads({ data, loading: false, error: null });
    } catch {
      setLeads((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load leads. Please check your permissions.',
      }));
    }
  }, []);

  useEffect(() => {
    if (userProfile) {
      fetchLeads();
    }
  }, [userProfile, fetchLeads]);

  // ─── Pipeline Summary ──────────────────────────────────────────────────

  const pipelineCounts = LEAD_STATUSES.reduce(
    (acc, status) => {
      acc[status] = leads.data.filter((l) => l.status === status).length;
      return acc;
    },
    {} as Record<LeadStatus, number>
  );

  // ─── Filtered Leads ────────────────────────────────────────────────────

  const filteredLeads =
    statusFilter === 'all'
      ? leads.data
      : leads.data.filter((l) => l.status === statusFilter);

  // ─── Update Lead Status ────────────────────────────────────────────────

  async function handleUpdateStatus(leadId: string, newStatus: LeadStatus) {
    setUpdatingLeadId(leadId);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const updateFn = httpsCallable(functions, 'leads_update');
      await updateFn({ leadId, status: newStatus });

      // Update local state
      setLeads((prev) => ({
        ...prev,
        data: prev.data.map((l) =>
          l.leadId === leadId ? { ...l, status: newStatus, updatedAt: new Date().toISOString() } : l
        ),
      }));

      setUpdateSuccess('Lead status updated successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update lead status.';
      setUpdateError(message);
    } finally {
      setUpdatingLeadId(null);
    }
  }

  // ─── Update Lead Notes ─────────────────────────────────────────────────

  async function handleUpdateNotes(leadId: string, notes: string) {
    setUpdatingLeadId(leadId);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const updateFn = httpsCallable(functions, 'leads_update');
      await updateFn({ leadId, notes });

      // Update local state
      setLeads((prev) => ({
        ...prev,
        data: prev.data.map((l) =>
          l.leadId === leadId ? { ...l, notes, updatedAt: new Date().toISOString() } : l
        ),
      }));

      setUpdateSuccess('Notes saved successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save notes.';
      setUpdateError(message);
    } finally {
      setUpdatingLeadId(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Lead Management</h1>
          <p className="text-foreground/60 mt-1">
            View, filter, and manage all captured leads. Update status and add follow-up notes.
          </p>
        </div>

        {/* Success/Error Toasts */}
        {updateSuccess && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2" role="status">
            <span className="text-green-600" aria-hidden="true">✓</span>
            <p className="text-sm text-green-700">{updateSuccess}</p>
            <button
              onClick={() => setUpdateSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800"
              aria-label="Dismiss success message"
            >
              ✕
            </button>
          </div>
        )}

        {updateError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2" role="alert">
            <span className="text-red-500" aria-hidden="true">⚠️</span>
            <p className="text-sm text-red-700">{updateError}</p>
            <button
              onClick={() => setUpdateError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
              aria-label="Dismiss error message"
            >
              ✕
            </button>
          </div>
        )}

        {/* Pipeline Summary */}
        <section aria-labelledby="pipeline-heading" className="mb-8">
          <h2 id="pipeline-heading" className="text-lg font-semibold text-foreground mb-3">
            Pipeline Summary
          </h2>

          {leads.loading ? (
            <PipelineSkeleton />
          ) : leads.error ? (
            <SectionError message={leads.error} onRetry={fetchLeads} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {LEAD_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  className={`rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    statusFilter === status
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  aria-pressed={statusFilter === status}
                  aria-label={`Filter by ${status} leads: ${pipelineCounts[status]} total`}
                >
                  <p className="text-xs font-medium text-foreground/60 uppercase tracking-wide">
                    {status}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {pipelineCounts[status]}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Filter Indicator */}
        {statusFilter !== 'all' && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-foreground/60">
              Showing <strong>{statusFilter}</strong> leads ({filteredLeads.length})
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus:underline"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Leads Table */}
        <section aria-labelledby="leads-table-heading">
          <h2 id="leads-table-heading" className="sr-only">
            Leads List
          </h2>

          {leads.loading ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </div>
          ) : leads.error ? (
            <SectionError message={leads.error} onRetry={fetchLeads} />
          ) : filteredLeads.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="📬"
                title={statusFilter === 'all' ? 'No leads captured yet' : `No ${statusFilter} leads`}
                description={
                  statusFilter === 'all'
                    ? 'Leads will appear here once visitors submit forms on the platform.'
                    : `There are no leads with status "${statusFilter}". Try a different filter.`
                }
              />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Date</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <LeadRow
                        key={lead.leadId}
                        lead={lead}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateNotes={handleUpdateNotes}
                        isUpdating={updatingLeadId === lead.leadId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Page Export (Wrapped in ProtectedRoute) ─────────────────────────────────

export default function AdminLeadsPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <LeadManagementPage />
    </ProtectedRoute>
  );
}
