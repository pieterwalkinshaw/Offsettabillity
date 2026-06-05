'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import { ProjectCard } from '@/components/projects/ProjectCard';
import type { FundingTransaction, Project } from '@shared/types';

function FundedProjectsPage() {
  const { user, userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalFunded, setTotalFunded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFundedProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const fundingQuery = query(
        collection(db, 'funding'),
        where('funderId', '==', user.uid),
        where('status', '==', 'confirmed'),
        orderBy('createdAt', 'desc')
      );
      const fundingSnap = await getDocs(fundingQuery);
      const transactions = fundingSnap.docs.map((d) => d.data() as FundingTransaction);

      let total = 0;
      const projectIds = new Set<string>();
      transactions.forEach((tx) => {
        total += tx.amount;
        projectIds.add(tx.projectId);
      });
      setTotalFunded(total);

      if (projectIds.size > 0) {
        const projectQuery = query(
          collection(db, 'projects'),
          where('projectId', 'in', [...projectIds].slice(0, 30))
        );
        const projectSnap = await getDocs(projectQuery);
        setProjects(projectSnap.docs.map((d) => d.data() as Project));
      } else {
        setProjects([]);
      }
    } catch {
      setError('Failed to load funded projects.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && userProfile) fetchFundedProjects();
  }, [user, userProfile, fetchFundedProjects]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">My Funded Projects</h1>
          <p className="text-foreground/60 mt-1">Projects you have committed funding to.</p>
        </div>

        {/* Total */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-8">
          <p className="text-sm text-foreground/60 mb-1">Total Confirmed Funding</p>
          <p className="text-3xl font-bold text-primary-700">
            R {(totalFunded / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Projects */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
                <div className="h-4 w-3/4 bg-gray-200 rounded mb-3" />
                <div className="h-3 w-1/2 bg-gray-100 rounded mb-4" />
                <div className="h-8 w-full bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={fetchFundedProjects} className="px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100">Retry</button>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-12">
            <p className="text-4xl mb-3">💰</p>
            <p className="font-semibold text-foreground">No funded projects yet</p>
            <p className="text-sm text-foreground/60 mt-1 mb-4">Browse verified projects and make your first impact investment.</p>
            <a href="/projects" className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Browse Projects</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.projectId} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FundingPage() {
  return (
    <ProtectedRoute allowedRoles={['funder']}>
      <FundedProjectsPage />
    </ProtectedRoute>
  );
}
