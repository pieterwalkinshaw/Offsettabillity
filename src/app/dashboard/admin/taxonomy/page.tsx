'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { getTaxonomy, saveTaxonomy } from '@/lib/firebase/taxonomy';
import type { TaxonomyCategory } from '@/types';

export default function AdminTaxonomyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    async function load() {
      const data = await getTaxonomy();
      setCategories(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (id: string, field: keyof TaxonomyCategory, value: string | boolean) => {
    setCategories(prev => prev.map(cat => 
      cat.id === id ? { ...cat, [field]: value } : cat
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveTaxonomy(categories);
    setSaving(false);
    alert('Taxonomy successfully updated!');
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="flex-grow bg-background py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <button onClick={() => router.back()} className="text-sm text-foreground/60 hover:text-primary-400 mb-4 inline-block">
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold">Taxonomy & Metrics Admin</h1>
            <p className="text-foreground/60 mt-2">Manage the ESG Categories and their primary tracking metrics globally across the platform.</p>
          </div>
          <button 
            onClick={handleSave} 
            disabled={loading || saving}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {loading ? (
          <div className="text-foreground/50">Loading taxonomy...</div>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground/70">Category Name</label>
                    <input 
                      type="text" 
                      value={cat.name} 
                      onChange={(e) => handleChange(cat.id, 'name', e.target.value)}
                      className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground/70">Primary Metric Label (KPI)</label>
                    <input 
                      type="text" 
                      value={cat.primaryMetricLabel} 
                      onChange={(e) => handleChange(cat.id, 'primaryMetricLabel', e.target.value)}
                      className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary-500"
                      placeholder="e.g. Total CO2e Removed (t)"
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id={`waste-${cat.id}`}
                    checked={cat.requiresWasteBreakdown || false}
                    onChange={(e) => handleChange(cat.id, 'requiresWasteBreakdown', e.target.checked)}
                    className="w-4 h-4 rounded bg-background/50 border-white/10 text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor={`waste-${cat.id}`} className="text-sm text-foreground/80 cursor-pointer">
                    Enable complex Waste Management Breakdown inputs (Recycled, Reused, Composted, Landfill)
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
