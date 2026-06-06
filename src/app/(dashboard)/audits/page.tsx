'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type { Audit, Project } from '@shared/types';

function MyAuditsPage() {
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
        where('status', 'in', ['pending', 'in_progress']),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ ...d.data(), auditId: d.id } as Audit));

      // Fetch project titles
      const withTitles = await Promise.all(
        list.map(async (audit) => {
          try {
            const pDoc = await getDoc(doc(db, 'projects', audit.projectId));
            return { ...audit, projectTitle: pDoc.exists() ? (pDoc.data() as Project).title : undefined };
          } catch { return audit; }
        })
      );
      setAudits(withTitles);
    } catch { setError('Failed to load audits.'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (user) fetchAudits(); }, [user, fetchAudits]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">My Assigned Audits</h1>
        <p className="text-foreground/60 mb-8">Audits assigned to you that are pending or in progress.</p>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-sm text-red-700">{error}</p></div>
        ) : audits.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-12">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold">No assigned audits</p>
            <p className="text-sm text-foreground/60 mt-1">You have no pending or in-progress audits.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {audits.map((audit) => (
              <a key={audit.auditId} href={`/audits/${audit.auditId}/submit`} className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-primary-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{audit.projectTitle || `Project ${audit.projectId.slice(0, 8)}...`}</p>
                    <p className="text-sm text-foreground/60 mt-1">Status: <span className="capitalize font-medium">{audit.status.replace('_', ' ')}</span></p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${audit.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                    {audit.status === 'pending' ? 'Pending' : 'In Progress'}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditsPage() {
  return <ProtectedRoute allowedRoles={['auditor']}><MyAuditsPage /></ProtectedRoute>;
}
