import Link from 'next/link';
import { getProjectById } from '@/lib/firebase/projects';
import ESGDashboard from '@/components/dashboard/esg/ESGDashboard';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) {
    return (
      <div className="flex-grow bg-background py-32 text-center">
        <h1 className="text-3xl font-bold mb-4">Project Not Found</h1>
        <Link href="/projects" className="text-primary-400 hover:underline">Return to Projects</Link>
      </div>
    );
  }

  // Define some default documents if empty
  const documents = project.auditHistory.length > 0 ? project.auditHistory.map((doc, idx) => ({
    name: `Audit Report ${idx + 1}`, type: 'PDF', locked: true 
  })) : [
    { name: 'Initial Baseline Assessment', type: 'PDF', locked: false },
    { name: 'Financial Model & Projections', type: 'XLSX', locked: true },
  ];

  return (
    <div className="flex-grow bg-background">
      {/* Hero Header */}
      <div className="w-full h-[40vh] min-h-[300px] bg-gradient-to-br from-primary-900 to-accent-900 relative flex items-end">
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="container mx-auto px-4 pb-12 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-full bg-primary-500/20 backdrop-blur-md border border-primary-500/30 text-xs font-semibold text-primary-300">
              {project.verificationBadge}
            </span>
            <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs font-medium text-white">
              {project.category}
            </span>
            <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs font-medium text-white flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {project.location.address}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">{project.title}</h1>
          <p className="text-white/80 text-lg max-w-2xl line-clamp-2">{project.description}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Full-width ESG Dashboard */}
        <ESGDashboard context="project" project={project} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
          
          {/* Main Content (Left) */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Overview */}
            <section>
              <h2 className="text-2xl font-bold mb-6">Project Overview</h2>
              <p className="text-foreground/80 leading-relaxed text-lg mb-8">
                {project.description}
              </p>
              
              <div className="h-64 bg-foreground/5 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-center relative overflow-hidden">
                {/* Map Placeholder */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, var(--color-primary-500) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                <div className="z-10 flex flex-col items-center">
                  <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center mb-2 animate-pulse">
                    <div className="w-4 h-4 bg-primary-500 rounded-full"></div>
                  </div>
                  <span className="font-medium text-foreground/60 text-sm">Interactive Map Location (Placeholder)</span>
                </div>
              </div>
            </section>

            {/* Documents */}
            <section>
              <h2 className="text-2xl font-bold mb-6">Reports & Documents</h2>
              <div className="space-y-4">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-black/20 hover:border-primary-500/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xs">
                        {doc.type}
                      </div>
                      <div>
                        <h4 className="font-medium">{doc.name}</h4>
                      </div>
                    </div>
                    {doc.locked ? (
                      <Link href="/login" className="flex items-center gap-2 text-sm font-medium text-foreground/40 hover:text-primary-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Login to View
                      </Link>
                    ) : (
                      <button className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sticky Sidebar (Right) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              
              {/* Verification Panel */}
              <div className="bg-white dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl p-6 shadow-lg shadow-black/5">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-black/5 dark:border-white/5">
                  <div className="w-16 h-16 rounded-full border-4 border-primary-500 flex items-center justify-center text-xl font-bold text-primary-600 dark:text-primary-400">
                    {project.verificationScore}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Trust Score</h3>
                    <p className="text-sm text-primary-600 dark:text-primary-400">{project.verificationBadge}</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-foreground/60 mb-3 uppercase tracking-wider">Status</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <div className="font-medium capitalize">{project.status.replace('_', ' ')}</div>
                  </div>
                </div>

                {/* Funding Progress */}
                <div className="mb-8">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold">${(project.fundingRaised / 1000).toFixed(0)}k raised</span>
                    <span className="text-foreground/50">of ${(project.fundingGoal / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="w-full bg-foreground/10 rounded-full h-2 mb-2 overflow-hidden">
                    <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${project.fundingGoal ? (project.fundingRaised / project.fundingGoal) * 100 : 0}%` }}></div>
                  </div>
                  <div className="text-xs text-right text-foreground/50">{project.fundingGoal ? Math.round((project.fundingRaised / project.fundingGoal) * 100) : 0}% Funded</div>
                </div>

                {/* Lead Capture CTAs */}
                <div className="space-y-3">
                  <button className="w-full py-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    Fund This Project
                  </button>
                  <Link href="/contact" className="flex items-center justify-center w-full py-3 rounded-xl border border-primary-500/50 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 font-medium transition-all">
                    Request Full Report
                  </Link>
                  <Link href="/contact" className="flex items-center justify-center w-full py-3 rounded-xl text-foreground/70 hover:text-foreground font-medium transition-colors text-sm underline underline-offset-4">
                    Contact an Advisor
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
