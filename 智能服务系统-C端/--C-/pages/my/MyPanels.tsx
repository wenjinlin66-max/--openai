import React from 'react';
import {
  Award,
  BadgeHelp,
  CalendarClock,
  ChevronRight,
  Clock3,
  Gem,
  Gift,
  Loader2,
  LogOut,
  MapPin,
  MessageCircleMore,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  UserCircle2,
  UserRound,
} from 'lucide-react';
import { Customer } from '../../types';
import { MEMBERSHIP_GUIDE, STORE_PROFILE } from '../../constants';
import { MemberSectionTab, MyPanelKey, RecommendationCard, ServiceRequestRecord, ServiceRequestType } from './shared';

interface NodeItem {
  label: string;
  desc?: string;
  icon: React.ElementType;
  badge?: string;
  onClick: () => void;
}

const NodeCard: React.FC<NodeItem> = ({ label, desc, icon: Icon, badge, onClick }) => (
  <button type="button" onClick={onClick} className="relative rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4 text-center transition-all hover:border-indigo-200 hover:bg-indigo-50">
    {badge && (
      <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge === '在线' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
        {badge}
      </span>
    )}
    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
      <Icon size={20} />
    </div>
    <p className="mt-3 text-sm font-semibold text-slate-800">{label}</p>
    {desc && <p className="mt-1 text-[11px] leading-4 text-slate-400">{desc}</p>}
  </button>
);

interface HomePanelProps {
  user: Customer;
  displayName: string;
  gradientClass: string;
  quickNodes: { key: Exclude<MyPanelKey, 'home'>; label: string; icon: React.ElementType; desc: string; badge?: string }[];
  quickShortcuts: { label: string; action: () => void; icon: React.ElementType; badge?: string }[];
  onSelectPanel: (panel: Exclude<MyPanelKey, 'home'>) => void;
  onLogout: () => void;
}

export const HomePanel: React.FC<HomePanelProps> = ({ user, displayName, gradientClass, quickNodes, quickShortcuts, onSelectPanel, onLogout }) => (
  <>
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradientClass} p-5 text-white shadow-xl shadow-slate-300/30`}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
      <div className="absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/15 text-white shadow-inner">
              {user.avatar_url ? <img src={user.avatar_url} alt={displayName} className="h-full w-full object-cover" /> : <UserCircle2 size={34} />}
            </div>
            <div>
              <h2 className="text-xl font-bold">{displayName}</h2>
              <div className="mt-1 inline-flex items-center rounded-full border border-white/15 bg-black/15 px-2.5 py-0.5 text-xs font-medium text-white/90"><Gem size={11} className="mr-1.5" />{user.tier}</div>
            </div>
          </div>
          <button type="button" onClick={onLogout} className="rounded-full bg-white/15 p-2 text-white/90 transition-colors hover:bg-white/25" title="退出登录"><LogOut size={18} /></button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm"><p className="text-[11px] text-white/70">余额</p><p className="mt-1 text-lg font-bold">¥{(user.balance || 0).toLocaleString()}</p></div>
          <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm"><p className="text-[11px] text-white/70">积分</p><p className="mt-1 text-lg font-bold">{(user.points || 0).toLocaleString()}</p></div>
          <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm"><p className="text-[11px] text-white/70">总消费</p><p className="mt-1 text-lg font-bold">¥{(user.total_spent || 0).toLocaleString()}</p></div>
        </div>
      </div>
    </section>

    <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-4"><h3 className="text-base font-bold text-slate-900">功能中心</h3><p className="mt-1 text-xs text-slate-400">点击节点进入对应功能界面查看详情</p></div>
      <div className="grid grid-cols-3 gap-3">
        {quickNodes.map((node) => <NodeCard key={node.key} {...node} onClick={() => onSelectPanel(node.key)} />)}
      </div>
    </section>

    <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-4"><h3 className="text-base font-bold text-slate-900">快捷入口</h3><p className="mt-1 text-xs text-slate-400">常用高频操作与节点风格统一展示</p></div>
      <div className="grid grid-cols-4 gap-3">
        {quickShortcuts.map((item) => <NodeCard key={item.label} {...item} />)}
      </div>
    </section>
  </>
);

interface MemberPanelProps {
  user: Customer;
  memberSectionTab: MemberSectionTab;
  onTabChange: (tab: MemberSectionTab) => void;
  currentGrowthLevel: { tier: string; min: number; next: number | null };
  growthValue: number;
  growthProgress: number;
  growthRemaining: number;
  nextGrowthThreshold: number | null;
  memberBenefits: string[];
  metrics: { activeAppointmentsCount: number; pendingReviewCount: number };
  recommendationCards: RecommendationCard[];
  onBook: (serviceName?: string) => void;
}

export const MemberPanel: React.FC<MemberPanelProps> = ({ user, memberSectionTab, onTabChange, currentGrowthLevel, growthValue, growthProgress, growthRemaining, nextGrowthThreshold, memberBenefits, metrics, recommendationCards, onBook }) => (
  <section className="space-y-4">
    <div className="sticky top-[92px] z-[5] rounded-3xl border border-slate-100 bg-white/95 p-3 shadow-sm backdrop-blur-md">
      <div className="flex gap-2 overflow-x-auto custom-scrollbar">
        {[
          { key: 'overview' as const, label: '总览' },
          { key: 'growth' as const, label: '成长体系' },
          { key: 'benefits' as const, label: '权益说明' },
          { key: 'recommendations' as const, label: '个性推荐' },
        ].map((tab) => (
          <button key={tab.key} type="button" onClick={() => onTabChange(tab.key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${memberSectionTab === tab.key ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}>{tab.label}</button>
        ))}
      </div>
    </div>

    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      {memberSectionTab === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-xs text-amber-500">当前等级</p><p className="mt-1 text-base font-bold text-amber-700">{user.tier}</p></div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs text-emerald-500">积分余额</p><p className="mt-1 text-base font-bold text-emerald-700">{user.points} 分</p></div>
          </div>
          <div className="mt-3 rounded-[28px] bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 p-5 text-white shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs text-white/70">成长值</p><p className="mt-1 text-3xl font-bold tracking-tight">{growthValue}</p></div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur-sm border border-white/10"><p className="text-[11px] text-white/70">升级进度</p><p className="mt-1 text-sm font-semibold text-white">{nextGrowthThreshold ? `距下一等级 ${growthRemaining}` : '已达最高等级'}</p></div>
            </div>
            <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm"><Award size={13} className="mr-1.5 text-amber-300" />{currentGrowthLevel.tier}成长徽章</div>
            <div className="mt-5"><div className="flex items-center justify-between text-[11px] text-white/70 mb-2"><span>{currentGrowthLevel.tier}</span><span>{nextGrowthThreshold ? `下一等级门槛 ${nextGrowthThreshold}` : '铂金会员'}</span></div><div className="h-2.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300" style={{ width: `${growthProgress}%` }} /></div></div>
          </div>
          <div className="mt-3 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">当前可享权益</p><ul className="mt-2 space-y-2 text-sm text-slate-700">{memberBenefits.map((benefit) => <li key={benefit} className="flex items-start"><Sparkles size={14} className="mr-2 mt-0.5 text-indigo-500" /><span>{benefit}</span></li>)}</ul></div>
        </>
      )}
      {memberSectionTab === 'growth' && (
        <div className="space-y-3">
          <div className="rounded-[28px] bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 p-5 text-white shadow-xl">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-white/70">成长值总览</p><p className="mt-1 text-3xl font-bold tracking-tight">{growthValue}</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur-sm border border-white/10"><p className="text-[11px] text-white/70">当前等级</p><p className="mt-1 text-sm font-semibold text-white">{currentGrowthLevel.tier}</p></div></div>
            <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm"><Award size={13} className="mr-1.5 text-amber-300" />{currentGrowthLevel.tier}成长徽章</div>
            <div className="mt-5 h-2.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300" style={{ width: `${growthProgress}%` }} /></div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-white/70"><span>当前成长进度 {Math.round(growthProgress)}%</span><span>{nextGrowthThreshold ? `还差 ${growthRemaining}` : '已满级'}</span></div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">签到 / 任务获得积分</p><div className="mt-3 grid grid-cols-1 gap-3">{[
            { title: '每日签到', reward: '+10 成长值', desc: '保持活跃签到习惯，可持续积累会员成长值。', done: false },
            { title: '完成评价', reward: '+30 积分', desc: metrics.pendingReviewCount > 0 ? `当前仍有 ${metrics.pendingReviewCount} 条待评价预约，可立即前往完成。` : '当前暂无待评价预约，已达成今日评价任务条件。', done: metrics.pendingReviewCount === 0 },
            { title: '预约到店', reward: '+50 成长值', desc: metrics.activeAppointmentsCount > 0 ? '您已有预约进行中，到店完成服务后将自然累积成长值。' : '当前暂无进行中的预约，可先预约喜欢的服务项目。', done: metrics.activeAppointmentsCount > 0 },
            { title: '充值升级', reward: '1元≈1积分', desc: '充值与消费都会影响成长值和会员等级，适合长期护理与造型用户。', done: user.balance > 0 },
          ].map((task) => <div key={task.title} className="rounded-2xl bg-white px-4 py-3 border border-slate-100"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{task.title}</p><p className="mt-1 text-xs text-slate-500 leading-5">{task.desc}</p></div><div className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${task.done ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>{task.reward}</div></div></div>)}</div></div>
        </div>
      )}
      {memberSectionTab === 'benefits' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">等级权益说明</p><ul className="mt-2 space-y-2 text-sm text-slate-700">{MEMBERSHIP_GUIDE.rules.map((rule) => <li key={rule} className="flex items-start"><Award size={14} className="mr-2 mt-0.5 text-amber-500" /><span>{rule}</span></li>)}</ul></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">当前可享权益</p><ul className="mt-2 space-y-2 text-sm text-slate-700">{memberBenefits.map((benefit) => <li key={benefit} className="flex items-start"><Gift size={14} className="mr-2 mt-0.5 text-indigo-500" /><span>{benefit}</span></li>)}</ul></div>
        </div>
      )}
      {memberSectionTab === 'recommendations' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><TrendingUp size={16} className="text-indigo-500" /><h4 className="text-sm font-bold text-slate-800">个性化推荐 / 复购提醒</h4></div>
          <div className="grid grid-cols-1 gap-3">{recommendationCards.map((card) => <div key={card.title} className="rounded-2xl bg-slate-50 p-4 border border-slate-100"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm border border-slate-100"><card.icon size={18} /></div><p className="text-sm font-semibold text-slate-800">{card.title}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-600 border border-indigo-100">{card.tag}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{card.description}</p><button type="button" onClick={() => onBook(card.targetServiceName)} className="mt-3 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">立即预约</button></div>)}</div>
        </div>
      )}
    </div>
  </section>
);

interface AfterSalesPanelProps {
  requestTypes: { type: ServiceRequestType; icon: React.ElementType; description: string }[];
  submitSuccess: string;
  loadingRequests: boolean;
  requests: ServiceRequestRecord[];
  onOpenRequest: (type: ServiceRequestType) => void;
  onRefresh: () => void;
}

export const AfterSalesPanel: React.FC<AfterSalesPanelProps> = ({ requestTypes, submitSuccess, loadingRequests, requests, onOpenRequest, onRefresh }) => (
  <section className="space-y-4">
    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        {requestTypes.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.type} type="button" onClick={() => onOpenRequest(item.type)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50">
              <div className="inline-flex rounded-xl bg-white p-2 text-indigo-600 shadow-sm"><Icon size={18} /></div>
              <p className="mt-3 text-sm font-semibold text-slate-800">{item.type}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
            </button>
          );
        })}
        <button type="button" onClick={onRefresh} className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:bg-slate-50">
          <div className="inline-flex rounded-xl bg-slate-100 p-2 text-slate-600 shadow-sm"><BadgeHelp size={18} /></div>
          <p className="mt-3 text-sm font-semibold text-slate-800">处理结果</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">刷新并查看门店最新处理状态与处理备注</p>
        </button>
      </div>
      {submitSuccess && <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{submitSuccess}</div>}
    </div>
    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-slate-800">最近处理记录</h4><button type="button" onClick={onRefresh} className="text-xs font-medium text-indigo-600">刷新</button></div>
      <div className="mt-4 space-y-4">
        {loadingRequests ? <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin" /></div> : requests.length === 0 ? <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center"><p className="text-sm font-medium text-slate-500">暂无售后记录</p><p className="mt-1 text-xs text-slate-400">您可在上方发起投诉、申诉或售后咨询</p></div> : requests.map((request, index) => {
          const status = getStatusMeta(request.request_status);
          return (
            <div key={request.id} className="relative pl-8">
              {index !== requests.length - 1 && <div className="absolute left-[11px] top-8 h-[calc(100%+12px)] w-px bg-slate-200" />}
              <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-slate-100"><div className="h-2.5 w-2.5 rounded-full bg-indigo-500" /></div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">{request.type}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span></div><p className="mt-2 text-sm leading-6 text-slate-700">{request.content}</p>{request.handling_note && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-500">处理备注：{request.handling_note}</p>}</div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span className="inline-flex items-center"><Clock3 size={12} className="mr-1" />{new Date(request.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span><span>{request.handled_at ? `最近处理：${new Date(request.handled_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '等待门店处理'}</span></div></div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);
