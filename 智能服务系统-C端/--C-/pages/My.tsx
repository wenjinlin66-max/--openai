import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeHelp,
  Bell,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Gem,
  Gift,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MessageCircleMore,
  Phone,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Target,
  TrendingUp,
  Wand2,
  UserCircle2,
  UserRound,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Appointment, Customer, CustomerSettings, Feedback, ServiceCatalogItem, TabType } from '../types';
import { MEMBERSHIP_GUIDE, STORE_PROFILE, TIER_STYLES } from '../constants';
import { analyzeSentiment } from '../services/geminiService';
import { fetchActiveServiceCatalog } from '../services/serviceCatalog';
import {
  AppointmentRecordTab,
  DEFAULT_SETTINGS,
  EditModalType,
  GROWTH_LEVELS,
  getMaskedPhone,
  getStatusMeta,
  MemberSectionTab,
  MyMetrics,
  MyPanelKey,
  normalizeSettings,
  PANEL_META,
  parseRequestType,
  ProfileState,
  RecommendationCard,
  RequestStatus,
  ServiceRequestRecord,
  ServiceRequestType,
  stripRequestPrefix,
  buildPreferenceDraft,
} from './my/shared';
import { EditDialog, RequestDialog } from './my/MyDialogs';
import { AfterSalesPanel, HomePanel, MemberPanel } from './my/MyPanels';

interface MyPageProps {
  user: Customer;
  onNavigate: (tab: TabType) => void;
  onLogout: () => void;
  unreadCount?: number;
  onProfileUpdated: () => Promise<void> | void;
}

const REQUEST_TYPES: { type: ServiceRequestType; icon: React.ElementType; description: string }[] = [
  { type: '投诉', icon: CircleAlert, description: '针对服务体验、沟通态度或流程问题发起投诉' },
  { type: '申诉', icon: RefreshCcw, description: '对账单、预约结果或处理结论提出申诉' },
  { type: '售后咨询', icon: MessageCircleMore, description: '对护理建议、复约安排或售后保障进行咨询' },
];

const MyPage: React.FC<MyPageProps> = ({ user, onNavigate, onLogout, unreadCount = 0, onProfileUpdated }) => {
  const [activePanel, setActivePanel] = useState<MyPanelKey>('home');
  const [profileState, setProfileState] = useState<ProfileState>({
    nickname: user.nickname || '',
    phone: user.phone || '',
    preferredServices: user.preferences || [],
  });
  const [settingsState, setSettingsState] = useState<CustomerSettings>(normalizeSettings(user.settings));
  const [draftNickname, setDraftNickname] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftPreferences, setDraftPreferences] = useState<string[]>([]);
  const [draftSettings, setDraftSettings] = useState<CustomerSettings>(DEFAULT_SETTINGS);
  const [editModalType, setEditModalType] = useState<EditModalType>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [requestType, setRequestType] = useState<ServiceRequestType>('投诉');
  const [requestContent, setRequestContent] = useState('');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requests, setRequests] = useState<ServiceRequestRecord[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [activeCampaignTitles, setActiveCampaignTitles] = useState<string[]>([]);
  const [recentServiceNames, setRecentServiceNames] = useState<string[]>([]);
  const [memberSectionTab, setMemberSectionTab] = useState<MemberSectionTab>('overview');
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);

  const [metrics, setMetrics] = useState<MyMetrics>({
    activeAppointmentsCount: 0,
    transactionCount: 0,
    pendingReviewCount: 0,
  });

  const gradientClass = TIER_STYLES[String(user.tier)] || 'from-indigo-500 via-indigo-600 to-purple-600';
  const memberBenefits = useMemo(() => MEMBERSHIP_GUIDE.packageHighlights.slice(0, 2), []);
  const displayName = profileState.nickname.trim() || user.nickname?.trim() || user.name || '未命名会员';
  const profileCompletionCount = [displayName, profileState.phone, profileState.preferredServices.length > 0].filter(Boolean).length;
  const unresolvedRequestCount = requests.filter((request) => request.request_status === 'pending' || request.request_status === 'processing').length;
  const growthValue = Math.floor((user.total_spent || 0) / 10) + (user.points || 0);

  const currentGrowthLevel =
    GROWTH_LEVELS.find((level) => level.tier === String(user.tier)) ||
    GROWTH_LEVELS.find((level, index) => {
      const nextLevel = GROWTH_LEVELS[index + 1];
      return growthValue >= level.min && (!nextLevel || growthValue < nextLevel.min);
    }) ||
    GROWTH_LEVELS[0];

  const nextGrowthThreshold = currentGrowthLevel.next;
  const growthProgress = nextGrowthThreshold
    ? Math.min(100, ((growthValue - currentGrowthLevel.min) / (nextGrowthThreshold - currentGrowthLevel.min)) * 100)
    : 100;
  const growthRemaining = nextGrowthThreshold ? Math.max(0, nextGrowthThreshold - growthValue) : 0;

  const recommendationCards = useMemo<RecommendationCard[]>(() => {
    const preferredService = serviceCatalog.find((service) => profileState.preferredServices.includes(service.name)) || serviceCatalog[0];
    const recentService = serviceCatalog.find((service) => recentServiceNames.includes(service.name));
    const serviceSuggestion = preferredService || recentService || serviceCatalog[0];
    const reminderTime = metrics.activeAppointmentsCount > 0 ? '您已有预约在进行中，建议优先关注当前预约提醒。' : '推荐选择工作日晚间或周末上午时段，通常更适合护理与造型安排。';
    const campaignTitle = activeCampaignTitles[0] || '当前会员活动已更新，可前往首页查看最新权益。';

    if (!serviceSuggestion) {
      return [
        {
          title: '推荐适合的服务',
          description: '当前暂未加载到服务目录，请稍后重试或联系门店顾问。',
          tag: '服务推荐',
          icon: Wand2,
        },
      ];
    }

    return [
      {
        title: '推荐适合的服务',
        description: `${serviceSuggestion.name}：${serviceSuggestion.suitableFor}`,
        tag: '服务推荐',
        targetServiceName: serviceSuggestion.name,
        icon: Wand2,
      },
      {
        title: '到期提醒 / 复购提醒',
        description: recentService
          ? `您最近关注过 ${recentService.name}，如已完成服务可在 2-4 周后再次复购保持效果。`
          : '您最近暂无高频服务记录，可优先体验基础护理或剪裁项目建立个人服务档案。',
        tag: '复购提醒',
        targetServiceName: recentService?.name || serviceSuggestion.name,
        icon: RefreshCcw,
      },
      {
        title: '合适时段推荐',
        description: reminderTime,
        tag: '时间建议',
        targetServiceName: serviceSuggestion.name,
        icon: CalendarClock,
      },
      {
        title: '当前可享活动推荐',
        description: campaignTitle,
        tag: '活动推荐',
        targetServiceName: serviceSuggestion.name,
        icon: Gift,
      },
    ];
  }, [activeCampaignTitles, metrics.activeAppointmentsCount, profileState.preferredServices, recentServiceNames, serviceCatalog]);

  const navigateToRecommendedBooking = (serviceName?: string) => {
    if (serviceName) {
      localStorage.setItem('crims-preselected-service', serviceName);
    }
    onNavigate('appointment');
  };

  useEffect(() => {
    setProfileState({
      nickname: user.nickname || '',
      phone: user.phone || '',
      preferredServices: user.preferences || [],
    });
    setSettingsState(normalizeSettings(user.settings));
  }, [user]);

  useEffect(() => {
    fetchActiveServiceCatalog().then(setServiceCatalog);
  }, []);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('id, text, sentiment, created_at, request_type, request_status, handling_note, handled_at')
        .eq('customer_id', user.id)
        .not('request_type', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const mapped: ServiceRequestRecord[] = (data || []).reduce<ServiceRequestRecord[]>((acc, item) => {
        const type = parseRequestType(item as Feedback);
        if (!type || !item.id || !item.created_at) return acc;

        acc.push({
          id: item.id,
          type,
          content: stripRequestPrefix(item.text || ''),
          sentiment: item.sentiment,
          created_at: item.created_at,
          request_status: (item.request_status || 'pending') as RequestStatus,
          handling_note: item.handling_note || '',
          handled_at: item.handled_at || undefined,
        });

        return acc;
      }, []);

      setRequests(mapped);
    } catch (error) {
      console.error('加载售后记录失败:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const [{ data: appointmentRows, error: appointmentError }, { count: transactionCount, error: transactionError }, { data: feedbackRows, error: feedbackError }, { data: campaignsRows, error: campaignsError }] = await Promise.all([
        supabase.from('appointments').select('id, status').eq('customer_id', user.id),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('customer_id', user.id),
        supabase.from('feedbacks').select('appointment_id').eq('customer_id', user.id).not('appointment_id', 'is', null),
        supabase.from('campaigns').select('title, target_audience, status, start_date, end_date').eq('status', 'active'),
      ]);

      if (appointmentError) throw appointmentError;
      if (transactionError) throw transactionError;
      if (feedbackError) throw feedbackError;
      if (campaignsError) throw campaignsError;

      const appointments = (appointmentRows || []) as Pick<Appointment, 'id' | 'status'>[];
      const reviewedIds = new Set((feedbackRows || []).map((row: { appointment_id: string | null }) => String(row.appointment_id)));
      const now = new Date().toISOString();
      const availableCampaignTitles = (campaignsRows || [])
        .filter((campaign: { title: string; target_audience?: string[]; start_date?: string; end_date?: string }) => {
          const audience = campaign.target_audience || ['all'];
          const withinTime = (!campaign.start_date || campaign.start_date <= now) && (!campaign.end_date || campaign.end_date >= now);
          return withinTime && (audience.includes('all') || audience.includes(String(user.tier)));
        })
        .map((campaign: { title: string }) => campaign.title);

      setActiveCampaignTitles(availableCampaignTitles);

      setMetrics({
        activeAppointmentsCount: appointments.filter((appointment) => ['pending', 'confirmed'].includes(appointment.status)).length,
        transactionCount: transactionCount || 0,
        pendingReviewCount: appointments.filter((appointment) => appointment.status === 'completed' && !reviewedIds.has(appointment.id)).length,
      });
    } catch (error) {
      console.error('加载我的页统计失败:', error);
    }
  };

  const fetchRecentServices = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('service_name')
        .eq('customer_id', user.id)
        .order('appointment_time', { ascending: false })
        .limit(5);

      if (error) throw error;

      setRecentServiceNames((data || []).map((row: { service_name: string }) => row.service_name));
    } catch (error) {
      console.error('加载个性化推荐数据失败:', error);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchMetrics();
    fetchRecentServices();
  }, [user.id]);

  const openEditModal = (type: EditModalType) => {
    setEditModalType(type);
    setDraftNickname(profileState.nickname);
    setDraftPhone(profileState.phone);
    setDraftPreferences(buildPreferenceDraft(serviceCatalog, profileState.preferredServices));
    setDraftSettings(settingsState);
    setSaveMessage('');
  };

  const persistCustomerFields = async (updates: Partial<Customer>) => {
    const { error } = await supabase.from('customers').update(updates).eq('id', user.id);
    if (error) throw error;
    await onProfileUpdated();
  };

  const saveEditModal = async () => {
    if (!editModalType) return;

    setIsSavingEdit(true);
    try {
      if (editModalType === 'nickname') {
        await persistCustomerFields({ nickname: draftNickname.trim() || user.name });
        setProfileState((prev) => ({ ...prev, nickname: draftNickname.trim() || user.name }));
      }

      if (editModalType === 'phone') {
        await persistCustomerFields({ phone: draftPhone.trim() });
        setProfileState((prev) => ({ ...prev, phone: draftPhone.trim() }));
      }

      if (editModalType === 'preferences') {
        await persistCustomerFields({ preferences: draftPreferences });
        setProfileState((prev) => ({ ...prev, preferredServices: draftPreferences }));
      }

      if (editModalType === 'privacy' || editModalType === 'security' || editModalType === 'notifications') {
        await persistCustomerFields({ settings: draftSettings });
        setSettingsState(draftSettings);
      }

      setSaveMessage('已同步到云端档案');
      setTimeout(() => {
        setEditModalType(null);
        setSaveMessage('');
      }, 500);
    } catch (error) {
      console.error('保存我的页信息失败:', error);
      alert('保存失败，请稍后重试。');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const togglePreference = (serviceName: string) => {
    setDraftPreferences((prev) => (prev.includes(serviceName) ? prev.filter((item) => item !== serviceName) : [...prev, serviceName]));
  };

  const openRequestModal = (type: ServiceRequestType) => {
    setRequestType(type);
    setRequestContent('');
    setSubmitSuccess('');
    setIsRequestModalOpen(true);
  };

  const handleSubmitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestContent.trim()) return;

    setIsSubmittingRequest(true);
    try {
      const sentiment = await analyzeSentiment(requestContent.trim());
      const { error } = await supabase.from('feedbacks').insert({
        customer_id: user.id,
        customer_name: displayName,
        text: requestContent.trim(),
        sentiment: sentiment.sentiment || 'neutral',
        request_type: requestType,
        request_status: 'pending',
      });

      if (error) throw error;

      setSubmitSuccess(`${requestType}已提交，当前状态为“待受理”。`);
      setRequestContent('');
      setIsRequestModalOpen(false);
      setActivePanel('afterSales');
      await fetchRequests();
    } catch (error) {
      console.error('提交售后请求失败:', error);
      alert('提交失败，请稍后重试。');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const navigateToAppointmentWithTab = (tab: AppointmentRecordTab, serviceName?: string) => {
    localStorage.setItem('crims-appointment-record-tab', tab);
    if (serviceName) {
      localStorage.setItem('crims-preselected-service', serviceName);
    }
    onNavigate('appointment');
  };

  const quickNodes: { key: Exclude<MyPanelKey, 'home'>; label: string; icon: React.ElementType; desc: string; badge?: string }[] = [
    { key: 'profile', label: '个人资料', icon: UserRound, desc: '头像、昵称、手机号', badge: `${profileCompletionCount}/3` },
    { key: 'member', label: '会员信息', icon: Gem, desc: '等级、积分、权益', badge: `${user.points}` },
    { key: 'settings', label: '账号设置', icon: ShieldCheck, desc: '隐私与提醒设置', badge: unreadCount > 0 ? `${unreadCount}` : undefined },
    { key: 'store', label: '联系门店', icon: Store, desc: '地址、电话、在线客服', badge: '在线' },
    { key: 'afterSales', label: '售后服务', icon: BadgeHelp, desc: '投诉、申诉、处理结果', badge: unresolvedRequestCount > 0 ? `${unresolvedRequestCount}` : undefined },
  ];

  const quickShortcuts: { label: string; action: () => void; icon: React.ElementType; badge?: string }[] = [
    { label: '我的预约', action: () => navigateToAppointmentWithTab('all'), icon: CalendarClock, badge: metrics.activeAppointmentsCount > 0 ? `${metrics.activeAppointmentsCount}` : undefined },
    { label: '我的账单', action: () => onNavigate('history'), icon: CreditCard, badge: metrics.transactionCount > 0 ? `${metrics.transactionCount}` : undefined },
    { label: '联系客服', action: () => onNavigate('chat'), icon: MessageCircleMore, badge: unreadCount > 0 ? `${unreadCount}` : '在线' },
    { label: '写评价', action: () => navigateToAppointmentWithTab('completedPendingReview'), icon: Star, badge: metrics.pendingReviewCount > 0 ? `${metrics.pendingReviewCount}` : undefined },
  ];

  const renderNodeCard = (item: { label: string; desc?: string; icon: React.ElementType; badge?: string; onClick: () => void }) => {
    const Icon = item.icon;
    return (
      <button key={item.label} type="button" onClick={item.onClick} className="relative rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4 text-center transition-all hover:border-indigo-200 hover:bg-indigo-50">
        {item.badge && (
          <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.badge === '在线' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
            {item.badge}
          </span>
        )}
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
          <Icon size={20} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800">{item.label}</p>
        {item.desc && <p className="mt-1 text-[11px] leading-4 text-slate-400">{item.desc}</p>}
      </button>
    );
  };

  const renderProfilePanel = () => (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
        <button type="button" onClick={() => openEditModal('nickname')} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left">
          <div>
            <p className="text-xs text-slate-400">昵称</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{displayName}</p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>
        <button type="button" onClick={() => openEditModal('phone')} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left">
          <div>
            <p className="text-xs text-slate-400">手机号</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{getMaskedPhone(profileState.phone)}</p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>
        <button type="button" onClick={() => openEditModal('preferences')} className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-left">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">偏好服务</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">已选择 {profileState.preferredServices.length} 项</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {profileState.preferredServices.length > 0 ? profileState.preferredServices.map((service) => (
              <span key={service} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">{service}</span>
            )) : <span className="text-xs text-slate-400">尚未设置偏好服务</span>}
          </div>
        </button>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-slate-600">
            {user.avatar_url ? <img src={user.avatar_url} alt={displayName} className="h-full w-full object-cover" /> : <UserCircle2 size={28} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">个人资料已完善</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">您可以在上方继续完善昵称、手机号和偏好服务，获得更贴合的服务推荐。</p>
          </div>
        </div>
      </div>
    </section>
  );

  const renderSettingsPanel = () => (
    <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="space-y-2">
        {[
          { key: 'privacy' as const, icon: ShieldCheck, title: '隐私说明', desc: '查看并设置个性化服务数据使用方式' },
          { key: 'security' as const, icon: Lock, title: '账号安全', desc: '管理登录保护与安全偏好' },
          { key: 'notifications' as const, icon: Bell, title: '消息提醒', desc: '预约、活动与售后进度提醒设置' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.title} type="button" onClick={() => openEditModal(item.key)} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white p-2 text-slate-600 shadow-sm"><Icon size={16} /></div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          );
        })}
      </div>
    </section>
  );

  const renderStorePanel = () => (
    <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="space-y-3 text-sm text-slate-600">
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"><MapPin size={16} className="mt-0.5 text-indigo-500" /><div><p className="font-medium text-slate-800">门店地址</p><p className="mt-1 text-xs leading-5 text-slate-500">{STORE_PROFILE.address}</p></div></div>
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"><Clock3 size={16} className="mt-0.5 text-indigo-500" /><div><p className="font-medium text-slate-800">营业时间</p><p className="mt-1 text-xs leading-5 text-slate-500">{STORE_PROFILE.businessHours}</p></div></div>
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"><Phone size={16} className="mt-0.5 text-indigo-500" /><div><p className="font-medium text-slate-800">联系方式</p><p className="mt-1 text-xs leading-5 text-slate-500">{STORE_PROFILE.contact}</p></div></div>
      </div>
      <button type="button" onClick={() => onNavigate('chat')} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-slate-800">
        <MessageCircleMore size={16} className="mr-2" />联系在线客服 / 门店顾问
      </button>
    </section>
  );

  const renderActivePanel = () => {
    if (activePanel === 'home') {
      return <HomePanel user={user} displayName={displayName} gradientClass={gradientClass} quickNodes={quickNodes} quickShortcuts={quickShortcuts} onSelectPanel={setActivePanel} onLogout={onLogout} />;
    }
    if (activePanel === 'profile') return renderProfilePanel();
    if (activePanel === 'member') {
      return <MemberPanel user={user} memberSectionTab={memberSectionTab} onTabChange={setMemberSectionTab} currentGrowthLevel={currentGrowthLevel} growthValue={growthValue} growthProgress={growthProgress} growthRemaining={growthRemaining} nextGrowthThreshold={nextGrowthThreshold} memberBenefits={memberBenefits} metrics={metrics} recommendationCards={recommendationCards} onBook={navigateToRecommendedBooking} />;
    }
    if (activePanel === 'settings') return renderSettingsPanel();
    if (activePanel === 'store') return renderStorePanel();
    return <AfterSalesPanel requestTypes={REQUEST_TYPES} submitSuccess={submitSuccess} loadingRequests={loadingRequests} requests={requests} onOpenRequest={openRequestModal} onRefresh={fetchRequests} />;
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <div className="sticky top-0 z-10 bg-white/95 px-6 pb-4 pt-12 shadow-sm backdrop-blur-md">
        {activePanel === 'home' ? (
          <><h1 className="text-2xl font-bold text-slate-900">我的</h1><p className="mt-1 text-sm text-slate-500">管理个人资料、会员权益与售后服务</p></>
        ) : (
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setActivePanel('home')} className="mt-0.5 rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200"><ArrowLeft size={16} /></button>
            <div><h1 className="text-2xl font-bold text-slate-900">{PANEL_META[activePanel].title}</h1><p className="mt-1 text-sm text-slate-500">{PANEL_META[activePanel].subtitle}</p></div>
          </div>
        )}
      </div>

      <div className="space-y-5 p-4 pb-32">{renderActivePanel()}</div>

      <RequestDialog
        isOpen={isRequestModalOpen}
        requestType={requestType}
        requestContent={requestContent}
        isSubmitting={isSubmittingRequest}
        requestTypes={REQUEST_TYPES}
        onClose={() => setIsRequestModalOpen(false)}
        onTypeChange={setRequestType}
        onContentChange={setRequestContent}
        onSubmit={handleSubmitRequest}
      />

      <EditDialog
        editModalType={editModalType}
        draftNickname={draftNickname}
        draftPhone={draftPhone}
        draftPreferences={draftPreferences}
        draftSettings={draftSettings}
        serviceCatalog={serviceCatalog}
        isSavingEdit={isSavingEdit}
        saveMessage={saveMessage}
        onClose={() => setEditModalType(null)}
        onSave={saveEditModal}
        onDraftNicknameChange={setDraftNickname}
        onDraftPhoneChange={setDraftPhone}
        onTogglePreference={togglePreference}
        onDraftSettingsChange={setDraftSettings}
      />
    </div>
  );
};

export default MyPage;
