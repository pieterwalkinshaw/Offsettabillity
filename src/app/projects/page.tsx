'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getProjects } from '@/lib/firebase/projects';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const [filter, setFilter] = useState('All');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getProjects();
      setProjects(data);
      setLoading(false);
    }
    load();
  }, []);

  const filteredProjects = filter === 'All' 
    ? projects 
    : projects.filter(p => p.category === filter);

  const categories = ['All', 'Carbon Removal', 'Clean Water', 'Education', 'Waste Management', 'Renewable Energy', 'Food Security'];

  return (
    <div className="flex-grow bg-background py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Verified Impact Projects</h1>
          <p className="text-xl text-foreground/60">
            Browse our portfolio of rigorously audited projects. Filter by category to find initiatives that align with your ESG goals.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                filter === cat 
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' 
                  : 'bg-white/5 border border-white/10 hover:border-primary-500/50 hover:bg-white/10 text-foreground/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-foreground/50">Loading projects...</div>
        ) : (
          <>
            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProjects.map((project) => (
                <div key={project.projectId} className="group bg-white dark:bg-black/40 rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 hover:border-primary-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(16,185,129,0.1)]">
                  <div className={`h-48 bg-gradient-to-br from-primary-900 to-accent-900 relative`}>
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-primary-300 border border-primary-500/30 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary-400 shadow-[0_0_5px_#34d399]"></span>
                      {project.verificationBadge}
                    </div>
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white/80">
                      {project.category}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">{project.title}</h3>
                    </div>
                    <div className="text-sm text-foreground/50 mb-6 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {project.location.address}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-foreground/[0.02] rounded-xl p-3 border border-black/5 dark:border-white/5">
                        <div className="text-xs text-foreground/50 mb-1 truncate" title={project.impactMetrics?.primaryMetric?.label || 'Impact'}>
                          {project.impactMetrics?.primaryMetric?.label || 'Impact'}
                        </div>
                        <div className="text-sm font-semibold truncate">
                          {project.impactMetrics?.primaryMetric?.value || '?'}
                        </div>
                      </div>
                      <div className="bg-foreground/[0.02] rounded-xl p-3 border border-black/5 dark:border-white/5">
                        <div className="text-xs text-foreground/50 mb-1">Funding</div>
                        <div className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                          {project.fundingGoal ? Math.round((project.fundingRaised / project.fundingGoal) * 100) : 0}% Funded
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-foreground/10 rounded-full h-1.5 mb-6 overflow-hidden">
                      <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${project.fundingGoal ? (project.fundingRaised / project.fundingGoal) * 100 : 0}%` }}></div>
                    </div>

                    <Link href={`/projects/${project.projectId}`} className="block w-full text-center py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-sm font-medium">
                      View Full Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {filteredProjects.length === 0 && (
              <div className="text-center py-20 text-foreground/50">
                No projects found in this category.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
