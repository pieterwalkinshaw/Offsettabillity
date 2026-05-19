'use client';

import { CheckCircle, AlertCircle, XCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function ESGScorecard() {
  const kpis = [
    { initiative: 'Carbon Removal', kpi: 'Net CO₂e (t)', current: '120,000', target: '100,000', variance: '-20%', trend: '↓ 8%', status: 'At Risk' },
    { initiative: 'Clean Water', kpi: 'Water Intensity', current: '2.1 m³/unit', target: '1.8', variance: '+17%', trend: '↑ 5%', status: 'Off Track' },
    { initiative: 'Education', kpi: 'Beneficiaries', current: '15,000', target: '12,000', variance: '+25%', trend: '↑ 12%', status: 'On Track' },
    { initiative: 'Waste Mgmt', kpi: 'Diversion Rate', current: '68%', target: '75%', variance: '-7%', trend: '↑ 10%', status: 'At Risk' },
    { initiative: 'Renewable Energy', kpi: '% Renewable', current: '42%', target: '50%', variance: '-8%', trend: '↑ 6%', status: 'At Risk' },
    { initiative: 'Food Security', kpi: 'Meals Provided', current: '2.3M', target: '2.0M', variance: '+15%', trend: '↑ 9%', status: 'On Track' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'On Track': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'At Risk': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'Off Track': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 mb-8 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">ESG Scorecard (At-a-Glance KPIs)</h2>
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500"/> On Track</div>
          <div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-yellow-500"/> At Risk</div>
          <div className="flex items-center gap-1.5"><XCircle className="w-4 h-4 text-red-500"/> Off Track</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="text-foreground/50 text-sm border-b border-white/10">
              <th className="pb-4 font-medium px-4">Initiative</th>
              <th className="pb-4 font-medium px-4">KPI</th>
              <th className="pb-4 font-medium px-4">Current</th>
              <th className="pb-4 font-medium px-4">Target</th>
              <th className="pb-4 font-medium px-4">Δ vs Target</th>
              <th className="pb-4 font-medium px-4">Trend (YoY)</th>
              <th className="pb-4 font-medium px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {kpis.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/5 transition-colors">
                <td className="py-4 px-4 font-semibold text-primary-300">{row.initiative}</td>
                <td className="py-4 px-4 text-foreground/80">{row.kpi}</td>
                <td className="py-4 px-4 font-bold">{row.current}</td>
                <td className="py-4 px-4 text-foreground/60">{row.target}</td>
                <td className={`py-4 px-4 font-medium ${row.variance.startsWith('+') && row.status === 'On Track' ? 'text-emerald-400' : row.variance.startsWith('-') && row.status !== 'On Track' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {row.variance}
                </td>
                <td className="py-4 px-4 flex items-center gap-1 text-foreground/80">
                  {row.trend.includes('↑') ? <ArrowUpRight className="w-4 h-4 text-emerald-500"/> : <ArrowDownRight className="w-4 h-4 text-red-500"/>}
                  {row.trend.replace(/[↑↓]/g, '')}
                </td>
                <td className="py-4 px-4 text-center">
                  <div className="flex justify-center">
                    {getStatusIcon(row.status)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
