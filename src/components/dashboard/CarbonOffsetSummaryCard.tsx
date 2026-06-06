'use client';

import { Leaf } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CarbonOffsetSummaryCardProps {
  totalTonnage: number;      // Aggregated CO₂e offset in metric tons
  purchaseCount: number;     // Number of confirmed purchases
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CarbonOffsetSummaryCard({ totalTonnage, purchaseCount }: CarbonOffsetSummaryCardProps) {
  return (
    <div className="rounded-xl border border-green-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
          <Leaf className="w-5 h-5 text-green-600" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground/60 mb-1">Carbon Offset</p>
          <p className="text-2xl font-bold text-green-700">
            {totalTonnage.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tons CO₂e
          </p>
          <p className="text-sm text-foreground/60 mt-1">
            {purchaseCount} {purchaseCount === 1 ? 'purchase' : 'purchases'} confirmed
          </p>
        </div>
      </div>
    </div>
  );
}
