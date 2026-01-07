import React from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, ComposedChart, Line 
} from 'recharts';
import { ActivityItem, Category, SourceType } from '../types';

interface DashboardProps {
  items: ActivityItem[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#3b82f6'];

const Dashboard: React.FC<DashboardProps> = ({ items }) => {
  const analyzedItems = items.filter(i => i.analyzed);

  // 1. Calculate Monthly Trends (For 2025 or current year context preferably, but showing all for now)
  const monthlyDataMap: Record<string, { count: number, impactSum: number }> = {};
  items.forEach(item => {
      const date = item.date ? new Date(item.date) : new Date();
      const key = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
      if(!monthlyDataMap[key]) monthlyDataMap[key] = { count: 0, impactSum: 0 };
      monthlyDataMap[key].count++;
      if(item.impactScore) monthlyDataMap[key].impactSum += item.impactScore;
  });

  // Sort monthly data chronological
  const monthlyData = Object.entries(monthlyDataMap)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .map(([name, data]) => ({
        name,
        活動量: data.count,
        平均影響力: data.count > 0 ? parseFloat((data.impactSum / data.count).toFixed(1)) : 0
    }))
    // Optional: Filter to show only last 12 months or just 2025 if data exists
    .filter(d => d.name.startsWith('2025') || d.name.startsWith('2024')); 

  // 2. Category Distribution
  const categoryData = Object.values(Category).map(cat => ({
    name: cat,
    value: analyzedItems.filter(i => i.category === cat).length
  })).filter(d => d.value > 0);

  // 3. Source Distribution
  const sourceData = Object.values(SourceType).map(source => ({
    name: source,
    value: items.filter(i => i.source === source).length
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6 mb-8">
      {/* Top Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 className="text-slate-400 text-xs font-bold uppercase">總記錄數</h3>
            <p className="text-2xl font-bold text-white mt-1">{items.length}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 className="text-slate-400 text-xs font-bold uppercase">已分析項目</h3>
            <p className="text-2xl font-bold text-indigo-400 mt-1">{analyzedItems.length}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 className="text-slate-400 text-xs font-bold uppercase">最活躍月份</h3>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
                {monthlyData.sort((a,b) => b.活動量 - a.活動量)[0]?.name.split('/')[1] || '-'} 月
            </p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
             <h3 className="text-slate-400 text-xs font-bold uppercase">主要重心</h3>
             <p className="text-xl font-bold text-pink-400 mt-1 truncate">
                {categoryData.sort((a,b) => b.value - a.value)[0]?.name || '-'}
             </p>
        </div>
      </div>

      {/* Main Trend Chart */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-80">
        <h3 className="text-slate-200 font-semibold mb-4">2025 年度活動與影響力趨勢</h3>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} />
            <YAxis yAxisId="left" stroke="#94a3b8" tick={{fontSize: 12}} />
            <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{fontSize: 12}} domain={[0, 10]} />
            <ReTooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
            />
            <Area yAxisId="left" type="monotone" dataKey="活動量" stroke="#6366f1" fillOpacity={1} fill="url(#colorCount)" />
            <Line yAxisId="right" type="monotone" dataKey="平均影響力" stroke="#10b981" strokeWidth={2} dot={{r: 4}} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-64">
            <h3 className="text-slate-200 font-semibold mb-4">類別分佈</h3>
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={70} tick={{fontSize: 12}} />
                <ReTooltip cursor={{fill: '#334155'}} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
            </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-64">
            <h3 className="text-slate-200 font-semibold mb-4">來源佔比</h3>
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
                >
                {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                </Pie>
                <ReTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
            </PieChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;