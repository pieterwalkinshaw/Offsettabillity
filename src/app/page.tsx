'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [industry, setIndustry] = useState('');
  const [budget, setBudget] = useState('');
  const [showResult, setShowResult] = useState(false);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    setShowResult(true);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-32 flex flex-col items-center text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900/40 via-background to-background -z-10"></div>
        <div className="container mx-auto px-4 max-w-5xl animate-fade-in">
          <span className="inline-block py-1 px-3 rounded-full bg-primary-500/10 text-primary-400 text-sm font-semibold mb-6 border border-primary-500/20">
            The Standard for ESG Confidence
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
            Fund Verified Impact. <br />
            <span className="gradient-text">Stay Audit-Ready.</span>
          </h1>
          <p className="text-lg md:text-xl text-foreground/70 mb-10 max-w-2xl mx-auto">
            Offsettable is the lead-generation-first ESG impact platform connecting corporates, funders, and institutions to verified, audit-ready social and environmental projects.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/projects" className="w-full sm:w-auto px-8 py-4 rounded-full bg-primary-600 hover:bg-primary-500 text-white font-medium transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">
              Build Your ESG Portfolio
            </Link>
            <Link href="/projects" className="w-full sm:w-auto px-8 py-4 rounded-full glass hover:bg-white/20 dark:glass-dark dark:hover:bg-black/40 font-medium transition-all">
              Browse Verified Projects
            </Link>
          </div>
        </div>
      </section>

      {/* 2. ESG Calculator Widget */}
      <section className="py-20 relative z-10">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="glass-dark rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-6 text-center">ESG Impact Calculator</h2>
              <p className="text-center text-foreground/60 mb-8 max-w-xl mx-auto">
                Discover your suggested ESG investment allocation based on industry benchmarks.
              </p>
              
              {!showResult ? (
                <form onSubmit={handleCalculate} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Industry</label>
                    <select 
                      className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select your industry...</option>
                      <option value="tech">Technology</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="finance">Financial Services</option>
                      <option value="retail">Retail</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Annual Revenue / Budget</label>
                    <input 
                      type="number"
                      placeholder="e.g. 5000000"
                      className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2 pt-4">
                    <button type="submit" className="w-full px-8 py-4 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-medium transition-all shadow-lg">
                      Calculate Suggested Allocation
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center max-w-2xl mx-auto animate-slide-up">
                  <div className="bg-primary-900/30 border border-primary-500/30 rounded-2xl p-8 mb-6">
                    <h3 className="text-xl font-medium mb-2 text-primary-200">Recommended Annual Allocation</h3>
                    <div className="text-5xl font-bold text-primary-400 mb-4">
                      ${(Number(budget) * 0.015).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <p className="text-sm text-foreground/60">
                      Based on a 1.5% target for the {industry} sector.
                    </p>
                  </div>
                  <button onClick={() => setShowResult(false)} className="text-primary-400 hover:text-primary-300 text-sm font-medium mr-6">
                    Recalculate
                  </button>
                  <Link href="/contact" className="inline-block px-8 py-3 rounded-full bg-primary-600 hover:bg-primary-500 text-white font-medium transition-all shadow-lg">
                    Get Full Report
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Verified Projects */}
      <section className="py-24 bg-foreground/5">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Featured Verified Projects</h2>
              <p className="text-foreground/60 max-w-2xl">Invest in high-impact initiatives that have been rigorously audited by independent professionals.</p>
            </div>
            <Link href="/projects" className="hidden md:flex text-primary-400 hover:text-primary-300 font-medium items-center gap-2">
              View All <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Project Card 1 */}
            <div className="group bg-white dark:bg-black/40 rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 hover:border-primary-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(16,185,129,0.1)]">
              <div className="h-48 bg-gradient-to-br from-primary-900 to-accent-900 relative">
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-primary-300 border border-primary-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary-400 shadow-[0_0_5px_#34d399]"></span>
                  Premium Assured
                </div>
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white/80">
                  Carbon Removal
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">Reforestation in the Amazon</h3>
                <p className="text-sm text-foreground/60 mb-6 line-clamp-2">A verified initiative restoring 10,000 hectares of degraded land in the Brazilian Amazon.</p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <div className="text-xs text-foreground/50 mb-1">Impact</div>
                    <div className="text-sm font-semibold">15k tons CO₂</div>
                  </div>
                  <div>
                    <div className="text-xs text-foreground/50 mb-1">Funding</div>
                    <div className="text-sm font-semibold">85% Funded</div>
                  </div>
                </div>
                <Link href="/projects/1" className="block w-full text-center py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-sm font-medium">
                  View Details
                </Link>
              </div>
            </div>

            {/* Project Card 2 */}
            <div className="group bg-white dark:bg-black/40 rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 hover:border-primary-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(16,185,129,0.1)]">
              <div className="h-48 bg-gradient-to-br from-blue-900 to-emerald-900 relative">
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-primary-300 border border-primary-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary-400 shadow-[0_0_5px_#34d399]"></span>
                  Verified+
                </div>
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white/80">
                  Clean Water
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">Sub-Saharan Solar Wells</h3>
                <p className="text-sm text-foreground/60 mb-6 line-clamp-2">Providing sustainable, solar-powered clean water access to 50 rural communities.</p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <div className="text-xs text-foreground/50 mb-1">Impact</div>
                    <div className="text-sm font-semibold">120k Lives</div>
                  </div>
                  <div>
                    <div className="text-xs text-foreground/50 mb-1">Funding</div>
                    <div className="text-sm font-semibold">42% Funded</div>
                  </div>
                </div>
                <Link href="/projects/2" className="block w-full text-center py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-sm font-medium">
                  View Details
                </Link>
              </div>
            </div>

            {/* Project Card 3 */}
            <div className="group bg-white dark:bg-black/40 rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 hover:border-primary-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(16,185,129,0.1)]">
              <div className="h-48 bg-gradient-to-br from-orange-900 to-primary-900 relative">
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-primary-300 border border-primary-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary-400 shadow-[0_0_5px_#34d399]"></span>
                  Verified
                </div>
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white/80">
                  Education
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">Tech Hubs for Youth</h3>
                <p className="text-sm text-foreground/60 mb-6 line-clamp-2">Building fully-equipped, solar-powered tech education centers in underserved urban areas.</p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <div className="text-xs text-foreground/50 mb-1">Impact</div>
                    <div className="text-sm font-semibold">5k Students</div>
                  </div>
                  <div>
                    <div className="text-xs text-foreground/50 mb-1">Funding</div>
                    <div className="text-sm font-semibold">95% Funded</div>
                  </div>
                </div>
                <Link href="/projects/3" className="block w-full text-center py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-sm font-medium">
                  View Details
                </Link>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center md:hidden">
            <Link href="/projects" className="inline-block text-primary-600 dark:text-primary-400 font-medium border border-primary-500/30 rounded-full px-6 py-2">
              View All Projects
            </Link>
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How Offsettable Works</h2>
            <p className="text-foreground/60 text-lg">A rigorous pipeline from project discovery to audit-ready reporting.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-primary-900/20 via-primary-500/50 to-primary-900/20 z-0"></div>
            
            {[
              { step: '01', title: 'Choose', desc: 'Browse our curated portfolio of pre-screened ESG projects aligned with your goals.' },
              { step: '02', title: 'Verify', desc: 'Every project undergoes independent audits by certified professionals on our platform.' },
              { step: '03', title: 'Fund', desc: 'Deploy capital securely to verified initiatives with transparent milestones.' },
              { step: '04', title: 'Report', desc: 'Receive automated, audit-ready impact reports for your stakeholders.' }
            ].map((item, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-background border-4 border-primary-100 dark:border-primary-900 flex items-center justify-center text-2xl font-bold text-primary-600 dark:text-primary-400 mb-6 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-foreground/60 text-sm max-w-[200px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Trust Section */}
      <section className="py-20 border-y border-black/5 dark:border-white/5 bg-foreground/[0.02]">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm font-semibold text-primary-600 dark:text-primary-400 tracking-widest uppercase mb-8">Trusted by Global Auditors & Corporates</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Placeholder logos */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-32 bg-foreground/10 rounded animate-pulse-slow"></div>
            ))}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-4xl mx-auto border-t border-black/5 dark:border-white/10 pt-16">
            <div>
              <div className="text-4xl font-bold text-foreground mb-2">250+</div>
              <div className="text-sm text-foreground/60">Projects Verified</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-foreground mb-2">$42M</div>
              <div className="text-sm text-foreground/60">Funds Deployed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-foreground mb-2">100%</div>
              <div className="text-sm text-foreground/60">Audit-Ready Reports</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-foreground mb-2">50+</div>
              <div className="text-sm text-foreground/60">Certified Auditors</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Lead Capture CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary-900/10 -z-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-600/10 rounded-full blur-[100px] -z-10"></div>
        
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to scale your ESG impact?</h2>
          <p className="text-xl text-foreground/80 mb-10 max-w-2xl mx-auto">
            Get personalized guidance on building a compliant, high-impact ESG portfolio.
          </p>
          <Link href="/contact" className="inline-block px-10 py-5 rounded-full bg-foreground text-background font-bold text-lg hover:scale-105 transition-all shadow-xl">
            Speak to an ESG Advisor
          </Link>
        </div>
      </section>
    </div>
  );
}
