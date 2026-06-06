'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { Suspense } from 'react';
import {
  ShieldCheck, TrendingUp, MapPin, Calendar, AlertCircle, Loader2,
  CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import type { Project, Audit, VerificationBadge, AuditRecommendation } from '@shared/types';

function badgeColor(badge: VerificationBadge): string {
  switch (badge) {
    case 'Premium Assured': return 'bg-primary-600 text-white';
    case 'Verified+': return 'bg-primary-500 text-white';
    case 'Verified': return 'bg-primary-400 text-white';
    default: return 'bg-gray-200 text-gray-600';
  }
}

function recommendationIcon(rec: AuditRecommendation) {
  switch (rec) {
    case 'approve': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case 'conditional': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    case 'reject': return <XCircle className="w-4 h-4 text-red-600" />;
  }
}

function formatCurrency(cents: number): string {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ProjectDetailContent() {
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = searchParams.get('id');

  useEffect(() => {
    if (!projectId) { setError('No project ID specified.'); setLoading(false); return; }

    async function fetchData() {
      setLoading(true); setError(null);
      try {
        const projectSnap = await getDoc(doc(db, 'projects', projectId!));
        if (!projectSnap.exists()) { setError('Project not found.'); setLoading(false); return; }
        const projectData = { ...projectSnap.data(), projectId: projectSnap.id } as Project;
        setProject(projectData);

        try {
          const auditsQuery = query(collection(db, 'audits'), where('projectId', '==', projectId), where('status', '==', 'completed'));
          const auditsSnap = await getDocs(auditsQuery);
          setAudits(auditsSnap.docs.map((d) => ({ ...d.data(), auditId: d.id } as Audit)).sort((a, b) => {
            const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return dateB - dateA;
          }));
        } catch { /* audits failed — show project without */ }
      } catch { setError('Failed to load project details.'); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [projectId]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /><span className="ml-3 text-foreground/60">Loading project...</span></div>;
  if (error || !project) return <div className="flex flex-col items-center justify-center min-h-[60vh] px-4"><AlertCircle className="w-12 h-12 text-red-500 mb-4" /><h1 className="text-xl font-semibold mb-2">{error || 'Project not found'}</h1></div>;

  const fundingPercentage = project.fundingGoal > 0 ? Math.min(Math.round((project.fundingRaised / project.fundingGoal) * 100), 100) : 0;
  const isFunder = userProfile?.role === 'funder';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{project.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="text-sm text-foreground/60 capitalize">{project.category.replace(/-/g, ' ')}</span>
              {project.location?.country && <span className="flex items-center gap-1 text-sm text-foreground/60"><MapPin className="w-3.5 h-3.5" />{project.location.country}</span>}
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${badgeColor(project.verificationBadge)}`}>
            <ShieldCheck className="w-4 h-4" />{project.verificationBadge === 'None' ? 'Unverified' : project.verificationBadge}
          </div>
        </div>
      </header>

      <section className="mb-8"><h2 className="text-lg font-semibold mb-3">Overview</h2><p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">{project.description}</p></section>

      <section className="mb-8"><h2 className="text-lg font-semibold mb-3">Impact Metrics</h2>
        <div className="bg-primary-50 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div><p className="text-sm text-foreground/60 mb-1">Primary Metric</p><p className="text-xl font-bold text-primary-700">{project.impactMetrics.primaryMetric.value.toLocaleString()} <span className="text-sm font-normal text-foreground/60">{project.impactMetrics.primaryMetric.label}</span></p></div>
            <div className="flex items-center gap-2 text-sm text-foreground/60"><Calendar className="w-4 h-4" /><span>Reporting: {project.impactMetrics.reportingPeriod}</span></div>
          </div>
        </div>
      </section>

      <section className="mb-8"><h2 className="text-lg font-semibold mb-3">Verification & Audit History</h2>
        {audits.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"><AlertCircle className="w-5 h-5 text-yellow-600" /><p className="text-sm text-yellow-800">Verification is in progress.</p></div>
        ) : (
          <div className="space-y-4">{audits.map((audit) => (
            <div key={audit.auditId} className="border border-foreground/10 rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">{audit.recommendation && recommendationIcon(audit.recommendation)}<span className="text-sm font-medium">{audit.recommendation ? audit.recommendation.charAt(0).toUpperCase() + audit.recommendation.slice(1) : 'Pending'}</span></div>
                {audit.completedAt && <span className="text-xs text-foreground/50">{new Date(audit.completedAt).toLocaleDateString('en-ZA')}</span>}
              </div>
              {audit.findings && <p className="text-sm text-foreground/70">{audit.findings}</p>}
            </div>
          ))}</div>
        )}
      </section>

      <section className="mb-8"><h2 className="text-lg font-semibold mb-3">Funding Progress</h2>
        <div className="border border-foreground/10 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
            <div><p className="text-2xl font-bold text-foreground">{formatCurrency(project.fundingRaised)}</p><p className="text-sm text-foreground/60">raised of {formatCurrency(project.fundingGoal)} goal</p></div>
            <span className="text-lg font-semibold text-primary-600">{fundingPercentage}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${fundingPercentage}%` }} /></div>
          {isFunder && <div className="mt-4"><a href={`/dashboard/funding/new?projectId=${project.projectId}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"><TrendingUp className="w-4 h-4" />Fund This Project</a></div>}
        </div>
      </section>

      {project.espQualification && (
        <section className="mb-8"><h2 className="text-lg font-semibold mb-3">ESP Qualification</h2>
          <div className="border border-foreground/10 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2">{project.espQualification.qualifies ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-500" />}<span className="font-medium">{project.espQualification.qualifies ? 'Qualifies for ESP / Social Spending' : 'Does not qualify'}</span></div>
            {project.espQualification.category && <p className="text-sm text-foreground/70 mt-2"><span className="font-medium">Category:</span> {project.espQualification.category}</p>}
          </div>
        </section>
      )}

      {project.sdgAlignment && project.sdgAlignment.length > 0 && (
        <section className="mb-8"><h2 className="text-lg font-semibold mb-3">SDG Alignment</h2>
          <div className="flex flex-wrap gap-2">{project.sdgAlignment.map((sdg) => <span key={sdg} className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded-full">SDG {sdg}</span>)}</div>
        </section>
      )}
    </div>
  );
}

export default function ProjectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>}>
      <ProjectDetailContent />
    </Suspense>
  );
}
