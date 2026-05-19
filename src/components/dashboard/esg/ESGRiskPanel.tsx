'use client';

import { ShieldAlert, TrendingUp, BookOpen, AlertTriangle } from 'lucide-react';

export default function ESGRiskPanel() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      
      {/* Targets & Forecasting */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold">Targets & Forecasting</h2>
        </div>
        
        <div className="space-y-6 flex-grow">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-foreground/80">FY26 Carbon Reduction Goal</span>
              <span className="font-bold text-blue-400">85% Projected</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
            </div>
            <div className="text-xs text-foreground/50 mt-2 flex justify-between">
              <span>Current: 120k tCO₂e</span>
              <span>Target: 140k tCO₂e</span>
            </div>
          </div>
          
          <div className="pt-4 border-t border-white/10">
            <h4 className="text-sm font-semibold mb-3">ROI / Impact Efficiency</h4>
            <div className="bg-foreground/5 rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-xs text-foreground/50">Cost per Impact Unit</div>
                <div className="font-bold">R14.50 <span className="text-xs font-normal text-emerald-400">↓ 2% YoY</span></div>
              </div>
              <div className="text-right">
                <div className="text-xs text-foreground/50">Budget Deployed</div>
                <div className="font-bold text-primary-400">68%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk & Compliance */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold">Risk & Compliance</h2>
        </div>
        
        <div className="space-y-4 flex-grow">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-red-200">Supply Chain Climate Exposure</div>
              <div className="text-xs text-red-200/70 mt-1">High physical risk identified for raw material sourcing in Southeast Asia (TCFD aligned).</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-orange-200">Pending Regulatory Audits</div>
              <div className="text-xs text-orange-200/70 mt-1">Q2 ISO 14001 surveillance audit scheduled for next month. Preparation at 80%.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Narrative Insights */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold">Executive Insights</h2>
        </div>
        
        <div className="space-y-4 text-sm flex-grow">
          <div>
            <h4 className="font-semibold text-emerald-400 mb-1">What improved this period?</h4>
            <p className="text-foreground/80">Renewable energy generation exceeded targets by 6% due to the new solar arrays coming fully online ahead of schedule.</p>
          </div>
          <div>
            <h4 className="font-semibold text-red-400 mb-1">What is off-track?</h4>
            <p className="text-foreground/80">Water intensity increased slightly due to unexpected maintenance in processing plant B, requiring temporary inefficient cooling loops.</p>
          </div>
          <div>
            <h4 className="font-semibold text-primary-400 mb-1">Strategic Opportunities</h4>
            <p className="text-foreground/80">Expanding the "Education" initiative to local suppliers could hedge against future compliance risks while boosting our overall ESG score.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
