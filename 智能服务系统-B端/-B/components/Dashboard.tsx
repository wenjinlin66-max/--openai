
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend 
} from 'recharts';
import { Users, DollarSign, TrendingUp, Activity, Sparkles, ArrowRight } from 'lucide-react';
import { DashboardStats, ViewState } from '../types';

interface DashboardProps {
  stats: DashboardStats;
  onNavigate: (view: ViewState) => void;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ComponentType<any>; trend: string }> = ({ title, value, icon: Icon, trend }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between animate-fade-in hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mt-2 inline-block">
        {trend}
      </span>
    </div>
    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
      <Icon className="w-6 h-6 text-blue-600" />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ stats, onNavigate }) => {
  
  // 模拟的营收趋势 (真实项目中应有专门的 API)
  const revenueTrend = [
    { name: '第一周', revenue: stats.totalRevenue * 0.15 },
    { name: '第二周', revenue: stats.totalRevenue * 0.25 },
    { name: '第三周', revenue: stats.totalRevenue * 0.20 },
    { name: '第四周', revenue: stats.totalRevenue * 0.40 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Marketing Quick Action Banner - Replaced Gradient with Solid Blue */}
      <div className="bg-blue-600 rounded-lg p-6 text-white flex flex-col sm:flex-row justify-between items-center shadow-md gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
               <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">发布新的营销活动</h2>
              <p className="text-blue-100 text-sm opacity-90">向 C 端小程序用户推送促销 Banner、弹窗公告或会员活动</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('marketing')} 
            className="px-5 py-2.5 bg-white text-blue-700 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap w-full sm:w-auto justify-center"
          >
            进入营销中心 <ArrowRight className="w-4 h-4" />
          </button>
       </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="客户总数" value={stats.totalCustomers.toLocaleString()} icon={Users} trend="较上月 +12%" />
        <StatCard title="累计营收" value={`$${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} trend="实时更新" />
        <StatCard title="平均满意度" value={`${stats.avgSatisfaction}/5.0`} icon={Activity} trend="基于真实反馈" />
        <StatCard title="总服务人次" value={stats.totalVisits.toLocaleString()} icon={TrendingUp} trend="含匿名访客" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Tier Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 min-w-0">
          <h3 className="text-base font-bold text-slate-800 mb-6">会员等级分布</h3>
          {/* Explicit styling for container to prevent Recharts size calculation issues */}
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <BarChart data={stats.tierDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} name="人数" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 min-w-0">
          <h3 className="text-base font-bold text-slate-800 mb-6">营收趋势估算</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line name="营收额" type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;