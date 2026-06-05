'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type { Project, User } from '@shared/types';

function AvailableProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get auditor specializations
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? (userDoc.data() as User) : null;
      const specializations = userData?.specializations ?? [];

      // Get projects needing verification
      const q = query(
        collection(db, 'projects'),
        where('verificationStatus', 'in', ['prescreened', 'pending_audit']),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => d.data() as Project);

      // Filter by specializations if set
      if (specializations.length > 0) {
        list = list.filter((p) => specializations.includes(p.category));
      }

      // Exclude own projects
      list = list.filter((p) => p.ownerId !== user.uid);

      setProjects(list);
    } catch { setError('Failed to load available projects.'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (user) fetchProjects(); }, [user, fetchProjects]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Available Projects</h1>
        <p className="text-foreground/60 mb-8">Projects matching your specializations that need verification.</p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-sm text-red-700">{error}</p></div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-12">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold">No projects available</p>
            <p className="text-sm text-foreground/60 mt-1">No projects matching your specializations need verification right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div key={p.projectId} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-primary-300 transition-colors">
                <p className="text-xs font-medium text-foreground/60 uppercase mb-2">{p.category.replace(/-/g, ' ')}</p>
                <h3 className="font-semibold text-foreground truncate">{p.title}</h3>
                <p className="text-xs text-foreground/60 mt-2 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-foreground/50">
                  <span>{p.location?.country}</span>
                  <span className="capitalize">{p.verificationStatus.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AvailablePage() {
  return <ProtectedRoute allowedRoles={['auditor']}><AvailableProjectsPage /></ProtectedRoute>;
}
