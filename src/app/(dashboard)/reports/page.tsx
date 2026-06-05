'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import { FileBarChart, Download, Calendar } from 'lucide-react';
import type { FundingTransaction, Project } from '@shared/types';

interface ReportItem {
  projectId: string;
  projectTitle: string;
  category: string;
  totalFunded: number;
  verificationBadge: string;
  verificationScore: number;
}

function ReportsPage() {
  const { user, userProfile } = useAuth();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Get all confirmed funding for this funder
      const fundingQuery = query(
        collection(db, 'funding'),
        where('funderId', '==', user.uid),
        where('status', '==', 'confirmed'),
        orderBy('createdAt', 'desc')
      );
      const fundingSnap = await getDocs(fundingQuery);
      const transactions = fundingSnap.docs.map((d) => d.data() as FundingTransaction);

      // Aggregate by project
      const projectTotals = new Map<string, number>();
      transactions.forEach((tx) => {
        projectTotals.set(tx.projectId, (projectTotals.get(tx.projectId) || 0) + tx.amount);
      });

      if (projectTotals.size === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Fetch project details
      const projectIds = [...projectTotals.keys()].slice(0, 30);
      const projectQuery = query(
        collection(db, 'projects'),
        where('projectId', 'in', projectIds)
      );
      const projectSnap = await getDocs(projectQuery);
      const projects = projectSnap.docs.map((d) => d.data() as Project);

      const reportItems: ReportItem[] = projects.map((p) => ({
        projectId: p.projectId,
        projectTitle: p.title,
        category: p.category,
        totalFunded: projectTotals.get(p.projectId) || 0,
        verificationBadge: p.verificationBadge,
        verificationScore: p.verificationScore,
      }));

      setReports(reportItems);
    } catch {
      setError('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && userProfile) fetchReports();
  }, [user, userProfile, fetchReports]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Impact Reports</h1>
          <p className="text-foreground/60 mt-1">Download audit-ready ESG impact reports for your funded projects.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-32 bg-gray-200 rounded" />
                </div>
                <div className="h-8 w-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={fetchReports} className="px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100">Retry</button>
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-12">
            <p className="text-4xl mb-3">📄</p>
            <p className="font-semibold text-foreground">No reports available</p>
            <p className="text-sm text-foreground/60 mt-1 mb-4">Fund a verified project to access its impact report.</p>
            <a href="/projects" className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Browse Projects</a>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.projectId}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary-300 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                  <FileBarChart className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{report.projectTitle}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-foreground/60">
                    <span className="capitalize">{report.category.replace(/-/g, ' ')}</span>
                    <span>•</span>
                    <span>Score: {report.verificationScore}/100</span>
                    <span>•</span>
                    <span>Your contribution: R {(report.totalFunded / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <a
                  href={`/projects/${report.projectId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  View Report
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FunderReportsPage() {
  return (
    <ProtectedRoute allowedRoles={['funder']}>
      <ReportsPage />
    </ProtectedRoute>
  );
}
