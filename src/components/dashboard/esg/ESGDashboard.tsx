'use client';

import ESGScorecard from './ESGScorecard';
import ESGDeepDives from './ESGDeepDives';
import ESGRiskPanel from './ESGRiskPanel';
import type { Project } from '@/types';

interface ESGDashboardProps {
  context: 'funder' | 'project' | 'admin';
  titleOverride?: string;
  projectId?: string;
  project?: Project;
}

export default function ESGDashboard({ context, titleOverride, projectId, project }: ESGDashboardProps) {
  
  // Provide specific top-level header data based on the context
  const getContextHeader = () => {
    switch (context) {
      case 'project':
        return {
          title: project ? `${project.title} ESG Performance` : (titleOverride || 'Project ESG Performance'),
          scope: project?.impactMetrics?.reportingPeriod || 'Project Level',
          score: project?.verificationBadge || 'Pending',
          highlights: [
            `${project?.impactMetrics?.primaryMetric?.label}: ${project?.impactMetrics?.primaryMetric?.value}`,
            `Status: ${project?.status}`,
            'Met all secondary milestones ahead of schedule.'
          ]
        };
      case 'funder':
        return {
          title: 'Portfolio ESG Performance',
          scope: 'Fund Level (Aggregate)',
          score: 'A- (Composite)',
          highlights: [
            'Total portfolio emissions offset crossed 100k tonne milestone.',
            'Water intensity remains a key risk area across manufacturing investments.',
            'Investments allocated to Renewable Energy yielded highest ROI this quarter.'
          ]
        };
      case 'admin':
      default:
        return {
          title: 'Platform ESG Overview',
          scope: 'Global System',
          score: 'AA',
          highlights: [
            '15 new verified projects onboarded this quarter.',
            'Platform-wide carbon removal targets tracking at 105%.',
            'Increased auditor throughput by 20%.'
          ]
        };
    }
  };

  const header = getContextHeader();

  return (
    <div className="w-full">
      {/* 1. Header (Top Bar) */}
      <div className="bg-gradient-to-br from-primary-900/30 to-accent-900/30 border border-primary-500/20 rounded-3xl p-6 md:p-8 mb-8 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-3xl font-bold mb-2">{header.title}</h1>
            <div className="flex items-center gap-3 text-sm font-medium">
              <span className="px-3 py-1 bg-black/40 rounded-full text-white/80">Reporting Period: FY2026 Q2</span>
              <span className="px-3 py-1 bg-black/40 rounded-full text-white/80">Scope: {header.scope}</span>
            </div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-sm text-foreground/60 mb-1 uppercase tracking-wider font-semibold">ESG Rating</div>
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
              {header.score}
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-semibold text-foreground/60 mb-3 uppercase tracking-wider">Key Highlights</h4>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {header.highlights.map((highlight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-foreground/90">
                <span className="text-primary-500 font-bold mt-0.5">•</span>
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 2. ESG Scorecard */}
      <ESGScorecard />

      {/* 3. Deep Dives */}
      <ESGDeepDives />

      {/* 4 & 5 & 6. Risk, Targets, Narrative */}
      <ESGRiskPanel />

    </div>
  );
}
