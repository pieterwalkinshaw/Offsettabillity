'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import { formatZAR } from '@shared/creditUtils';
import type { PurchaseTransaction, Certificate } from '@shared/types';
import {
  Leaf,
  Loader2,
  AlertCircle,
  RefreshCw,
  Download,
  FileText,
  ShoppingCart,
  TrendingUp,
  Award,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonthlyOffset {
  month: string; // e.g. "Jan 2025"
  tonnage: number;
}

interface ProjectBreakdown {
  projectId: string;
  projectTitle: string;
  projectLocation: string;
  tonnage: number;
  percentage: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTrailing12Months(): { start: Date; months: string[] } {
  const now = new Date();
  const months: string[] = [];
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push(
      d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })
    );
  }

  return { start, months };
}

function groupByMonth(
  transactions: PurchaseTransaction[],
  months: string[],
  startDate: Date
): MonthlyOffset[] {
  // Initialize all months with 0
  const map = new Map<string, number>();
  months.forEach((m) => map.set(m, 0));

  for (const txn of transactions) {
    const txnDate = new Date(txn.createdAt);
    if (txnDate < startDate) continue;

    const key = txnDate.toLocaleDateString('en-ZA', {
      month: 'short',
      year: 'numeric',
    });
    if (map.has(key)) {
      map.set(key, (map.get(key) || 0) + txn.quantity);
    }
  }

  return months.map((month) => ({
    month,
    tonnage: Math.round((map.get(month) || 0) * 100) / 100,
  }));
}

function buildProjectBreakdown(
  transactions: PurchaseTransaction[]
): ProjectBreakdown[] {
  const totalTonnage = transactions.reduce((sum, txn) => sum + txn.quantity, 0);
  const projectMap = new Map<
    string,
    { projectTitle: string; projectLocation: string; tonnage: number }
  >();

  for (const txn of transactions) {
    for (const alloc of txn.projectAllocations) {
      const existing = projectMap.get(alloc.projectId);
      if (existing) {
        existing.tonnage += alloc.tonnage;
      } else {
        projectMap.set(alloc.projectId, {
          projectTitle: alloc.projectTitle,
          projectLocation: '',
          tonnage: alloc.tonnage,
        });
      }
    }
  }

  return Array.from(projectMap.entries()).map(([projectId, data]) => ({
    projectId,
    projectTitle: data.projectTitle,
    projectLocation: data.projectLocation,
    tonnage: Math.round(data.tonnage * 100) / 100,
    percentage:
      totalTonnage > 0
        ? Math.round((data.tonnage / totalTonnage) * 10000) / 100
        : 0,
  }));
}

// ─── Main Content ────────────────────────────────────────────────────────────

function SustainabilityContent() {
  const { user, userProfile } = useAuth();

  // Data state
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Export state
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // ─── Data Fetching ───────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch confirmed purchase transactions for this funder
      const txnQuery = query(
        collection(db, 'purchaseTransactions'),
        where('funderId', '==', user.uid),
        where('status', '==', 'confirmed'),
        orderBy('createdAt', 'desc')
      );
      const txnSnap = await getDocs(txnQuery);
      const txnData = txnSnap.docs.map((d) => d.data() as PurchaseTransaction);
      setTransactions(txnData);

      // Fetch certificates for this funder
      const certQuery = query(
        collection(db, 'certificates'),
        where('funderId', '==', user.uid)
      );
      const certSnap = await getDocs(certQuery);
      const certData = certSnap.docs.map((d) => d.data() as Certificate);
      setCertificates(certData);
    } catch {
      setError('Failed to load sustainability data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && userProfile) {
      fetchData();
    }
  }, [user, userProfile, fetchData]);

  // ─── Derived data ────────────────────────────────────────────────────────────

  const totalOffset = useMemo(
    () => transactions.reduce((sum, txn) => sum + txn.quantity, 0),
    [transactions]
  );

  const totalSpent = useMemo(
    () => transactions.reduce((sum, txn) => sum + txn.totalAmountCents, 0),
    [transactions]
  );

  const purchaseCount = transactions.length;

  const { start: trailingStart, months: trailingMonths } = useMemo(
    () => getTrailing12Months(),
    []
  );

  const monthlyData = useMemo(
    () => groupByMonth(transactions, trailingMonths, trailingStart),
    [transactions, trailingMonths, trailingStart]
  );

  const projectBreakdown = useMemo(
    () => buildProjectBreakdown(transactions),
    [transactions]
  );

  // ─── Export Handlers ─────────────────────────────────────────────────────────

  const handleExport = useCallback(
    async (format: 'csv' | 'pdf') => {
      setExportError(null);

      if (!exportStartDate || !exportEndDate) {
        setExportError('Please select both start and end dates.');
        return;
      }

      const start = new Date(exportStartDate);
      const end = new Date(exportEndDate);
      if (start >= end) {
        setExportError('Start date must be before end date.');
        return;
      }

      setExporting(format);

      try {
        const fnName =
          format === 'csv' ? 'credits_exportCSV' : 'credits_exportPDF';
        const exportFn = httpsCallable<
          { startDate: string; endDate: string },
          { downloadUrl?: string; data?: string }
        >(functions, fnName);

        const result = await exportFn({
          startDate: new Date(exportStartDate).toISOString(),
          endDate: new Date(exportEndDate).toISOString(),
        });

        // If a download URL is returned, open it
        if (result.data.downloadUrl) {
          window.open(result.data.downloadUrl, '_blank');
        } else if (result.data.data && format === 'csv') {
          // For inline CSV data, trigger download
          const blob = new Blob([result.data.data], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `sustainability-report-${exportStartDate}-to-${exportEndDate}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch {
        setExportError(`Failed to generate ${format.toUpperCase()} export. Please try again.`);
      } finally {
        setExporting(null);
      }
    },
    [exportStartDate, exportEndDate]
  );

  // ─── Certificate Download Handler ───────────────────────────────────────────

  const handleCertificateDownload = useCallback(
    async (cert: Certificate) => {
      try {
        const storageRef = ref(storage, cert.storagePath);
        const url = await getDownloadURL(storageRef);
        window.open(url, '_blank');
      } catch {
        // Fallback: construct URL directly
        window.open(
          `https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(cert.storagePath)}?alt=media`,
          '_blank'
        );
      }
    },
    []
  );

  // ─── Loading State ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          {/* Header skeleton */}
          <div className="mb-8 animate-pulse">
            <div className="h-8 w-64 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-96 bg-gray-100 rounded" />
          </div>

          {/* Summary cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse"
              >
                <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
                <div className="h-8 w-32 bg-gray-100 rounded" />
              </div>
            ))}
          </div>

          {/* Chart skeleton */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8 animate-pulse">
            <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
            <div className="h-48 bg-gray-50 rounded" />
          </div>

          {/* Table skeleton */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse">
            <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-50 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────

  if (error && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Empty State ─────────────────────────────────────────────────────────────

  if (!loading && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-16 px-6">
            <Leaf className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground">
              No carbon offset history yet
            </p>
            <p className="text-sm text-foreground/60 mt-2 max-w-md mx-auto">
              Purchase carbon credits to start tracking your sustainability
              impact. Your offset history and certificates will appear here.
            </p>
            <a
              href="/credits"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Browse Carbon Credits
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loaded State ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Leaf className="w-6 h-6 text-green-600" />
            Sustainability Dashboard
          </h1>
          <p className="text-foreground/60 mt-1">
            Track your cumulative carbon offset impact and download certificates.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <p className="text-sm font-medium text-foreground/60">
                Total CO₂e Offset
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {totalOffset.toFixed(2)}{' '}
              <span className="text-sm font-normal text-foreground/50">
                tons
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-medium text-foreground/60">
                Purchases
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {purchaseCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-medium text-foreground/60">
                Total Spent
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatZAR(totalSpent)}
            </p>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Monthly Offset (Trailing 12 Months)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  label={{
                    value: 'tons CO₂e',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: '#6b7280' },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [
                    `${Number(value).toFixed(2)} tons`,
                    'CO₂e Offset',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="tonnage"
                  stroke="#16a34a"
                  fill="#bbf7d0"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Per-Project Breakdown Table */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Offset by Project
          </h2>
          {projectBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 font-medium text-foreground/60">
                      Project
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-foreground/60 hidden sm:table-cell">
                      Location
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-foreground/60">
                      Tonnage
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-foreground/60">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projectBreakdown.map((project) => (
                    <tr
                      key={project.projectId}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="py-3 px-2 font-medium text-foreground">
                        {project.projectTitle}
                      </td>
                      <td className="py-3 px-2 text-foreground/60 hidden sm:table-cell">
                        {project.projectLocation || '—'}
                      </td>
                      <td className="py-3 px-2 text-right text-foreground">
                        {project.tonnage.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right text-foreground">
                        {project.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td className="py-3 px-2 font-semibold text-foreground">
                      Total
                    </td>
                    <td className="py-3 px-2 hidden sm:table-cell" />
                    <td className="py-3 px-2 text-right font-semibold text-foreground">
                      {totalOffset.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-foreground">
                      100.0%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-foreground/60">No project data available.</p>
          )}
        </div>

        {/* Certificates List */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Certificates
          </h2>
          {certificates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 font-medium text-foreground/60">
                      Date
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-foreground/60">
                      Certificate ID
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-foreground/60">
                      Tonnage
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-foreground/60">
                      Download
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
                    <tr
                      key={cert.certificateId}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="py-3 px-2 text-foreground">
                        {new Date(cert.generatedAt).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="py-3 px-2 font-mono text-xs text-foreground/80">
                        {cert.certificateId}
                      </td>
                      <td className="py-3 px-2 text-right text-foreground">
                        {cert.tonnageOffset.toFixed(2)} tons
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => handleCertificateDownload(cert)}
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium text-xs"
                          aria-label={`Download certificate ${cert.certificateId}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-foreground/60">
              No certificates generated yet. Certificates are created once
              purchases are confirmed.
            </p>
          )}
        </div>

        {/* Export Controls */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Export Report
          </h2>
          <p className="text-sm text-foreground/60 mb-4">
            Generate a sustainability report for a specific date range.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label
                htmlFor="export-start-date"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
                <input
                  id="export-start-date"
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => {
                    setExportStartDate(e.target.value);
                    setExportError(null);
                  }}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div className="flex-1">
              <label
                htmlFor="export-end-date"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
                <input
                  id="export-end-date"
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => {
                    setExportEndDate(e.target.value);
                    setExportError(null);
                  }}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {exportError && (
            <p className="text-sm text-red-600 mb-4" role="alert">
              {exportError}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting !== null}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-foreground"
            >
              {exporting === 'csv' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Export CSV
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting === 'pdf' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function SustainabilityPage() {
  return (
    <ProtectedRoute allowedRoles={['funder']}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        }
      >
        <SustainabilityContent />
      </Suspense>
    </ProtectedRoute>
  );
}
