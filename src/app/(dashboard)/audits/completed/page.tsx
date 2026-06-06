'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type { Audit, Project } from '@shared/types';

function CompletedAuditsPage() {
  const { user } = useAuth();
  const [audits, setAudits] = useState<(Audit & { projectTitle?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'audits'),
        where('auditorId', '==', user.uid),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ ...d.data(), auditId: d.id } as Audit));

      const withTitles = await Promise.all(
        list.map(async (audit) => {
          try {
            const pDoc = await getDoc(doc(db, 'projects', audit.projectId));
            return { ...audit, projectTitle: pDoc.exists() ? (pDoc.data() as Project).title : undefined };
          } catch { return audit; }
        })
      );
      setAudits(withTitles);
    } catch { setError('Failed to load completed audits.'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (user) fetchAudits(); }, [user, fetchAudits]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Completed Audits</h1>
        <p className="text-foreground/60 mb-8">Your audit history with findings and recommendations.</p>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-sm text-red-700">{error}</p></div>
        ) : audits.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-12">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold">No completed audits yet</p>
            <p className="text-sm text-foreground/60 mt-1">Once you complete your first audit, it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {audits.map((audit) => (
              <div key={audit.auditId} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{audit.projectTitle || `Project ${audit.projectId.slice(0, 8)}...`}</p>
                    {audit.findings && <p className="text-sm text-foreground/60 mt-1 line-clamp-2">{audit.findings}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      audit.recommendation === 'approve' ? 'bg-green-100 text-green-700' :
                      audit.recommendation === 'conditional' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {audit.recommendation ? audit.recommendation.charAt(0).toUpperCase() + audit.recommendation.slice(1) : '—'}
                    </span>
                    {audit.scoreContribution !== undefined && (
                      <p className="text-xs text-foreground/50 mt-1">Score: {audit.scoreContribution}/100</p>
                    )}
                  </div>
                </div>
                {audit.completedAt && (
                  <p className="text-xs text-foreground/40 mt-2">{new Date(audit.completedAt).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompletedPage() {
  return <ProtectedRoute allowedRoles={['auditor']}><CompletedAuditsPage /></ProtectedRoute>;
}
