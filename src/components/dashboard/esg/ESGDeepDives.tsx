'use client';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

export default function ESGDeepDives() {
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const carbonData = [
    { name: 'Scope 1', offset: 20000, reduced: 15000 },
    { name: 'Scope 2', offset: 45000, reduced: 20000 },
    { name: 'Scope 3', offset: 10000, reduced: 10000 },
  ];

  const wasteData = [
    { name: 'Recycled', value: 45 },
    { name: 'Composted', value: 15 },
    { name: 'Landfill', value: 32 },
    { name: 'Hazardous', value: 8 },
  ];

  const energyData = [
    { month: 'Jan', renewable: 30, nonRenewable: 70 },
    { month: 'Feb', renewable: 35, nonRenewable: 65 },
    { month: 'Mar', renewable: 42, nonRenewable: 58 },
    { month: 'Apr', renewable: 45, nonRenewable: 55 },
  ];

  return (
    <div className="space-y-8 mb-8">
      <h2 className="text-2xl font-bold px-2">Initiative Deep-Dives</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Carbon Removal */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-primary-400">A. Carbon Removal</h3>
              <p className="text-foreground/60 text-sm">Total CO₂e removed: 120,000t</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">Cost / tonne</div>
              <div className="text-2xl font-bold text-white">R145</div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={carbonData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#000000dd', borderColor: '#333', borderRadius: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="offset" stackId="a" fill="#10b981" name="Offset (t)" radius={[0,0,4,4]} />
                <Bar dataKey="reduced" stackId="a" fill="#3b82f6" name="Reduced (t)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Clean Water */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-blue-400">B. Clean Water</h3>
              <p className="text-foreground/60 text-sm">Total water use: 4.2M m³</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">Intensity</div>
              <div className="text-2xl font-bold text-red-400">2.1 <span className="text-sm text-foreground/50">m³/unit</span></div>
            </div>
          </div>
          <div className="flex items-center justify-between h-64 gap-6">
            <div className="w-1/2 flex flex-col justify-center gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-sm text-foreground/60 mb-1">% Recycled Water</div>
                <div className="text-3xl font-bold text-blue-400">38%</div>
                <div className="w-full bg-white/10 h-1.5 mt-3 rounded-full overflow-hidden"><div className="bg-blue-500 w-[38%] h-full"></div></div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-sm text-foreground/60 mb-1">Stressed Regions</div>
                <div className="text-3xl font-bold text-orange-400">12%</div>
                <div className="w-full bg-white/10 h-1.5 mt-3 rounded-full overflow-hidden"><div className="bg-orange-500 w-[12%] h-full"></div></div>
              </div>
            </div>
            <div className="w-1/2 h-full flex items-center justify-center bg-blue-900/10 rounded-2xl border border-blue-500/20 relative overflow-hidden">
               {/* Mock Heatmap visualization using CSS gradients */}
               <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_30%,_var(--color-blue-500)_0%,_transparent_50%),radial-gradient(circle_at_70%_80%,_var(--color-red-500)_0%,_transparent_40%)] blur-xl"></div>
               <span className="relative z-10 font-medium text-blue-200/50 text-sm">Regional Heatmap Overview</span>
            </div>
          </div>
        </div>

        {/* Waste Management */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-amber-500">C. Waste Management</h3>
              <p className="text-foreground/60 text-sm">Total waste: 4,500 tonnes</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">Diversion Rate</div>
              <div className="text-2xl font-bold text-amber-500">68%</div>
            </div>
          </div>
          <div className="h-64 w-full flex items-center">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie data={wasteData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {wasteData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#000000dd', borderColor: '#333', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-50% flex flex-col justify-center space-y-3">
              {wasteData.map((entry, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length]}}></div>
                  <div className="text-sm font-medium">{entry.name} ({entry.value}%)</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Renewable Energy */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-purple-400">D. Renewable Energy</h3>
              <p className="text-foreground/60 text-sm">Total energy: 12,400 MWh</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">Emissions Avoided</div>
              <div className="text-2xl font-bold text-emerald-400">3,200 <span className="text-sm text-foreground/50">tCO₂e</span></div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="month" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#000000dd', borderColor: '#333', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="renewable" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorRen)" name="% Renewable" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
