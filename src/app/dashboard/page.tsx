'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProjectsByOwner } from '@/lib/firebase/projects';
import type { Project } from '@/types';
import ESGDashboard from '@/components/dashboard/esg/ESGDashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ownerProjects, setOwnerProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    async function loadProjects() {
      if (user?.role === 'owner') {
        const p = await getProjectsByOwner(user.userId);
        setOwnerProjects(p);
      }
      setLoading(false);
    }
    loadProjects();
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex-grow bg-background py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Welcome, {user.name}</h1>
            <p className="text-foreground/60 capitalize">{user.role} Dashboard</p>
          </div>
          <div className="hidden md:block">
            <span className="px-4 py-2 rounded-full bg-primary-500/10 text-primary-400 font-semibold border border-primary-500/20 text-sm">
              Account Active
            </span>
          </div>
        </div>

        {/* Dashboard Content Based on Role */}
        {user.role === 'funder' && (
          <div className="space-y-8">
            <ESGDashboard context="funder" />

            <div>
              <h2 className="text-xl font-bold mb-4">Saved Projects</h2>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-foreground/60 mb-4">You have 3 saved projects pending review.</p>
                <Link href="/projects" className="text-primary-400 hover:underline">Browse more verified projects</Link>
              </div>
            </div>
          </div>
        )}

        {user.role === 'owner' && (
          <div className="space-y-8">
            <div className="flex justify-end mb-4">
              <Link href="/dashboard/projects/new" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-all">
                + New Project
              </Link>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-6">Your Projects</h2>
              {loading ? (
                <div className="text-foreground/60">Loading projects...</div>
              ) : ownerProjects.length === 0 ? (
                <div className="text-foreground/60 py-4 text-center">You haven't created any projects yet.</div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-foreground/50 text-sm border-b border-white/10">
                      <th className="pb-3 font-medium">Project Name</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Verification</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownerProjects.map(proj => (
                      <tr key={proj.projectId} className="border-b border-white/5">
                        <td className="py-4 font-medium">{proj.title}</td>
                        <td className="py-4">
                          <span className={`text-sm capitalize ${proj.status === 'live' ? 'text-emerald-400' : 'text-orange-400'}`}>
                            {proj.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="px-2 py-1 bg-primary-500/20 text-primary-300 rounded text-xs">{proj.verificationBadge}</span>
                        </td>
                        <td className="py-4 text-right">
                          <Link href={`/projects/${proj.projectId}`} className="text-sm text-primary-400 hover:text-primary-300 mr-3">View</Link>
                          <button className="text-sm text-foreground/60 hover:text-white">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {user.role === 'auditor' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 border-l-4 border-l-accent-500">
                <h3 className="font-bold mb-2">Assigned Audits</h3>
                <p className="text-3xl font-bold text-accent-400">4</p>
                <p className="text-sm text-foreground/50 mt-2">2 due this week</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 border-l-4 border-l-primary-500">
                <h3 className="font-bold mb-2">Completed Audits</h3>
                <p className="text-3xl font-bold text-primary-400">128</p>
                <p className="text-sm text-foreground/50 mt-2">Average Rating: 4.9/5.0</p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Pending Submissions</h2>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between p-4 border border-white/5 rounded-xl mb-3">
                  <div>
                    <div className="font-medium">Andes Wind Farm Expansion</div>
                    <div className="text-sm text-foreground/50">Deadline: Oct 12, 2026</div>
                  </div>
                  <button className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg text-sm transition-all">
                    Submit Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {user.role === 'admin' && (
          <div className="space-y-8">
            <div className="flex justify-end mb-4">
              <Link href="/dashboard/admin/taxonomy" className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium transition-all">
                ⚙️ Configure ESG Taxonomy
              </Link>
            </div>
            <ESGDashboard context="admin" />
          </div>
        )}
      </div>
    </div>
  );
}
