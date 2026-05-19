'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { createProject } from '@/lib/firebase/projects';
import { getTaxonomy } from '@/lib/firebase/taxonomy';
import type { Project, TaxonomyCategory } from '@/types';

export default function NewProjectPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);

  useEffect(() => {
    async function loadTaxonomy() {
      const data = await getTaxonomy();
      setTaxonomy(data);
    }
    loadTaxonomy();
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    subCategory: '',
    description: '',
    address: '',
    fundingGoal: '',
    reportingPeriod: 'Project Duration',
    primaryMetricValue: '',
  });

  const [wasteBreakdown, setWasteBreakdown] = useState({
    recycled: 0,
    reused: 0,
    composted: 0,
    landfill: 0
  });

  // Derived state based on selected category
  const selectedCategoryConfig = taxonomy.find(c => c.name === formData.category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCategoryConfig) return;
    setLoading(true);

    const newProject: Project = {
      projectId: `proj-${Date.now()}`,
      title: formData.title,
      description: formData.description,
      category: formData.category,
      subCategory: formData.subCategory,
      ownerId: user.userId,
      location: {
        lat: 0,
        lng: 0,
        address: formData.address,
      },
      fundingGoal: Number(formData.fundingGoal),
      fundingRaised: 0,
      impactMetrics: {
        reportingPeriod: formData.reportingPeriod,
        primaryMetric: {
          label: selectedCategoryConfig.primaryMetricLabel,
          value: formData.primaryMetricValue
        },
        ...(selectedCategoryConfig.requiresWasteBreakdown ? { wasteBreakdown } : {})
      },
      verificationScore: 0,
      verificationStatus: 'draft',
      verificationBadge: 'None',
      riskLevel: 'medium',
      status: 'draft',
      auditHistory: [],
      createdAt: new Date().toISOString(),
    };

    try {
      await createProject(newProject);
      router.push('/dashboard');
    } catch (error) {
      console.error("Error creating project", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleWasteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWasteBreakdown(prev => ({ ...prev, [e.target.name]: Number(e.target.value) }));
  };

  if (!user || user.role !== 'owner') {
    return <div className="p-8 text-center">Unauthorized. Only Project Owners can create projects.</div>;
  }

  return (
    <div className="flex-grow bg-background py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-8">
          <button onClick={() => router.back()} className="text-sm text-foreground/60 hover:text-primary-400 mb-4 inline-block">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">Create New Project</h1>
          <p className="text-foreground/60">Submit your ESG initiative for audit and funding.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project Title</label>
              <input 
                required type="text" name="title" value={formData.title} onChange={handleChange}
                className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., Solar Microgrids in Kenya"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">ESG Category</label>
                <select 
                  required name="category" value={formData.category} onChange={handleChange}
                  className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="" disabled>Select...</option>
                  {taxonomy.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sub-Category</label>
                <input 
                  type="text" name="subCategory" value={formData.subCategory} onChange={handleChange}
                  className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Solar"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Location Address</label>
              <input 
                required type="text" name="address" value={formData.address} onChange={handleChange}
                className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., Nairobi, Kenya"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Funding Goal (USD)</label>
              <input 
                required type="number" name="fundingGoal" value={formData.fundingGoal} onChange={handleChange} min="1000"
                className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="500000"
              />
            </div>

            {/* Dynamic Impact Metrics Section */}
            {selectedCategoryConfig && (
              <div className="p-5 rounded-2xl bg-primary-500/10 border border-primary-500/20 mt-6 mb-6">
                <h3 className="font-bold text-primary-400 mb-4">Impact Tracking Data</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Reporting Period</label>
                    <select 
                      required name="reportingPeriod" value={formData.reportingPeriod} onChange={handleChange}
                      className="w-full bg-background/80 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="Project Duration">Project Duration</option>
                      <option value="Annually">Annually</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 truncate" title={selectedCategoryConfig.primaryMetricLabel}>
                      {selectedCategoryConfig.primaryMetricLabel}
                    </label>
                    <input 
                      required type="text" name="primaryMetricValue" value={formData.primaryMetricValue} onChange={handleChange}
                      className="w-full bg-background/80 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., 15000 or 45%"
                    />
                  </div>
                </div>

                {selectedCategoryConfig.requiresWasteBreakdown && (
                  <div className="mt-4 pt-4 border-t border-primary-500/20">
                    <label className="block text-sm font-bold mb-3">Waste Breakdown (%)</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground/70 mb-1">Recycled</label>
                        <input type="number" name="recycled" value={wasteBreakdown.recycled} onChange={handleWasteChange} className="w-full bg-background/80 border border-white/10 rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground/70 mb-1">Reused</label>
                        <input type="number" name="reused" value={wasteBreakdown.reused} onChange={handleWasteChange} className="w-full bg-background/80 border border-white/10 rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground/70 mb-1">Composted</label>
                        <input type="number" name="composted" value={wasteBreakdown.composted} onChange={handleWasteChange} className="w-full bg-background/80 border border-white/10 rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground/70 mb-1">Landfill</label>
                        <input type="number" name="landfill" value={wasteBreakdown.landfill} onChange={handleWasteChange} className="w-full bg-background/80 border border-white/10 rounded-lg px-3 py-2" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea 
                required name="description" value={formData.description} onChange={handleChange} rows={5}
                className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe the impact and scope of this project..."
              />
            </div>
          </div>

          <div className="pt-6 border-t border-white/10">
            <button 
              type="submit" disabled={loading}
              className="w-full px-8 py-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? 'Creating Project...' : 'Submit Project as Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
