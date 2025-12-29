
import React, { useMemo } from 'react';
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
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between animate-fade-in">
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-2 inline-block">
        {trend}
      </span>
    </div>
    <div className="p-3 bg-indigo-50 rounded-full">
      <Icon className="w-6 h-6 text-indigo-600" />
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
      {/* Marketing Quick Action Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white flex flex-col sm:flex-row justify-between items-center shadow-lg shadow-indigo-200 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
               <Sparkles className="w-8 h-8 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">发布新的营销活动</h2>
              <p className="text-indigo-100 text-sm opacity-90">向 C 端小程序用户推送促销 Banner、弹窗公告或会员活动</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('marketing')} 
            className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap w-full sm:w-auto justify-center"
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">会员等级分布</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.tierDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} name="人数" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">营收趋势估算</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line name="营收额" type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
