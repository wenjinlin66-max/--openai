import { supabase, isSupabaseConfigured, getSession } from '../lib/supabaseClient';
import { 
  Customer, 
  VisitorLog, 
  FeedbackItem, 
  Transaction, 
  Appointment, 
  ChatMessage, 
  DashboardStats, 
  CustomerTier, 
  Campaign, 
  NotificationItem, 
  SlotConfig,
  ServiceCatalogItem,
  RechargePackageItem 
} from '../types';

const parseFeedbackType = (
  text: string | null | undefined,
  requestType?: string | null
): 'review' | 'complaint' | 'appeal' | 'after_sales' => {
  if (requestType === '投诉') return 'complaint';
  if (requestType === '申诉') return 'appeal';
  if (requestType === '售后咨询') return 'after_sales';
  const content = text?.trim() || '';
  if (content.startsWith('【投诉】')) return 'complaint';
  if (content.startsWith('【申诉】')) return 'appeal';
  if (content.startsWith('【售后咨询】')) return 'after_sales';
  return 'review';
};

const mapRequestStatusToLabel = (status?: string | null) => {
  switch (status) {
    case 'processing':
      return '处理中';
    case 'resolved':
      return '已回访';
    case 'rejected':
      return '已驳回';
    case 'pending':
    default:
      return '待受理';
  }
};

// ==========================================
// 1. 仪表盘与统计 (Dashboard Stats)
// ==========================================

/**
 * 获取仪表盘统计数据，聚合客户、营收、满意度及等级分布
 */
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  if (!isSupabaseConfigured()) {
    return { totalCustomers: 0, totalRevenue: 0, totalVisits: 0, avgSatisfaction: "0", tierDistribution: [] };
  }

  try {
    const [customersRes, feedbacksRes] = await Promise.all([
      supabase.from('customers').select('tier, total_spent, visit_count'),
      supabase.from('feedbacks').select('sentiment')
    ]);

    const customers = customersRes.data || [];
    const feedbacks = feedbacksRes.data || [];

    const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
    const totalVisits = customers.reduce((sum, c) => sum + (c.visit_count || 0), 0);

    // 计算平均满意度分数 (5分制)
    let avgSatisfaction = "0";
    if (feedbacks.length > 0) {
      const positive = feedbacks.filter(f => f.sentiment === 'positive').length;
      const neutral = feedbacks.filter(f => f.sentiment === 'neutral').length;
      const score = (positive * 5 + neutral * 3 + (feedbacks.length - positive - neutral) * 1) / feedbacks.length;
      avgSatisfaction = score.toFixed(1);
    }

    // 初始化所有等级的计数为 0
    const tiers: Record<string, number> = {
      [CustomerTier.BRONZE]: 0,
      [CustomerTier.SILVER]: 0,
      [CustomerTier.GOLD]: 0,
      [CustomerTier.PLATINUM]: 0,
    };

    customers.forEach(c => {
      if (tiers[c.tier] !== undefined) tiers[c.tier]++;
    });

    const tierDistribution = Object.keys(tiers).map(key => ({
      name: key,
      count: tiers[key]
    }));

    return { totalCustomers: customers.length, totalRevenue, totalVisits, avgSatisfaction, tierDistribution };
  } catch (e: any) {
    console.error("Error fetching dashboard stats:", e);
    return { totalCustomers: 0, totalRevenue: 0, totalVisits: 0, avgSatisfaction: "0", tierDistribution: [] };
  }
};

// ==========================================
// 2. 客户档案管理 (Customer Management)
// ==========================================

/**
 * 分页获取客户列表，支持搜索和关联查询
 */
export const fetchCustomers = async (
  page: number = 1, 
  pageSize: number = 10, 
  searchQuery: string = ''
): Promise<{ data: Customer[], total: number }> => {
  if (!isSupabaseConfigured()) return { data: [], total: 0 };
  
  try {
    let query = supabase.from('customers').select('*', { count: 'exact' });
    
    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: customersData, count, error } = await query
      .order('last_visit', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!customersData) return { data: [], total: 0 };

    const customerIds = customersData.map(c => c.id);

    // 并行获取关联的交易和钱包信息
    const [transactionsRes, walletsRes] = await Promise.all([
      supabase.from('transactions')
        .select('*')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false }),
      supabase.from('wallets')
        .select('*')
        .in('customer_id', customerIds)
    ]);

    // 映射数据到前端模型
    const mapped = customersData.map(row => {
      const wallet = walletsRes.data?.find(w => w.customer_id === row.id);
      const txns = transactionsRes.data?.filter(t => t.customer_id === row.id) || [];
      
      return {
        id: row.id,
        name: row.name,
        nickname: row.nickname || '',
        avatarUrl: row.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}`,
        phone: row.phone || '',
        tier: row.tier,
        tags: row.tags || [],
        visitCount: row.visit_count || 0,
        totalSpent: row.total_spent || 0,
        balance: wallet?.balance || 0,
        points: wallet?.points || 0,
        lastVisit: row.last_visit ? row.last_visit.split('T')[0] : '',
        notes: row.notes || '',
        preferences: row.preferences || [],
        history: txns.map(t => ({
          id: t.id,
          date: t.created_at.split('T')[0],
          service: t.service,
          amount: t.amount,
          rating: t.rating || 5
        }))
      };
    });

    return { data: mapped, total: count || 0 };
  } catch (e) {
    console.error("Error fetching customers:", e);
    return { data: [], total: 0 };
  }
};

/**
 * 创建新客户并初始化钱包
 */
export const createCustomer = async (customer: Partial<Customer>): Promise<Customer | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const payload = {
    name: customer.name,
    nickname: customer.nickname || customer.name,
    tier: customer.tier,
    tags: customer.tags,
    notes: customer.notes,
    avatar_url: customer.avatarUrl,
    phone: customer.phone || null,
    visit_count: 1,
    total_spent: 0,
    last_visit: new Date().toISOString()
  };

  let data: any = null;
  let error: any = null;

  ({ data, error } = await supabase.from('customers').insert(payload).select().single());

  if (error && String(error.message || '').includes('phone')) {
    ({ data, error } = await supabase
      .from('customers')
      .insert({
        name: customer.name,
        nickname: customer.nickname || customer.name,
        tier: customer.tier,
        tags: customer.tags,
        notes: customer.notes,
        avatar_url: customer.avatarUrl,
        visit_count: 1,
        total_spent: 0,
        last_visit: new Date().toISOString()
      })
      .select()
      .single());
  }

  if (error) {
    console.error("Create customer error:", error);
    return null;
  }

  // 为新客户初始化钱包
  await supabase.from('wallets').insert({
    customer_id: data.id,
    balance: 0,
    points: 0
  });

  return { ...customer, id: data.id } as Customer;
};

/**
 * 更新客户基本信息
 */
export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  let { error } = await supabase
    .from('customers')
    .update({
      name: updates.name,
      nickname: updates.nickname,
      tier: updates.tier,
      tags: updates.tags,
      notes: updates.notes,
      preferences: updates.preferences,
      phone: updates.phone
    })
    .eq('id', id);

  if (error && String(error.message || '').includes('phone')) {
    ({ error } = await supabase
      .from('customers')
      .update({
        name: updates.name,
        nickname: updates.nickname,
        tier: updates.tier,
        tags: updates.tags,
        notes: updates.notes,
        preferences: updates.preferences
      })
      .eq('id', id));
  }

  if (error) console.error("Update customer error:", error);
  return !error;
};

/**
 * 删除客户记录
 */
export const deleteCustomer = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  return !error;
};

// ==========================================
// 3. 财务与交易 (Financials & Transactions)
// ==========================================

/**
 * 客户余额充值并记录交易
 */
export const rechargeCustomer = async (customerId: string, amount: number): Promise<Transaction | null> => {
  if (!isSupabaseConfigured()) return null;

  // 1. 更新余额和积分
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance, points')
    .eq('customer_id', customerId)
    .single();

  const newBalance = (wallet?.balance || 0) + amount;
  const newPoints = (wallet?.points || 0) + Math.floor(amount);

  await supabase
    .from('wallets')
    .update({ balance: newBalance, points: newPoints })
    .eq('customer_id', customerId);

  // 2. 记录充值交易
  return addTransaction(customerId, '账户充值', amount);
};

/**
 * 添加一条服务/消费记录
 */
export const addTransaction = async (customerId: string, service: string, amount: number): Promise<Transaction | null> => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      customer_id: customerId,
      service,
      amount,
      rating: 5
    })
    .select()
    .single();

  if (error) {
    console.error("Add transaction error:", error);
    return null;
  }

  // 同时也更新客户的“累计消费”和“到店次数”
  if (!service.includes('充值')) {
    const { data: cust } = await supabase.from('customers').select('total_spent, visit_count').eq('id', customerId).single();
    await supabase.from('customers').update({
      total_spent: (cust?.total_spent || 0) + amount,
      visit_count: (cust?.visit_count || 0) + 1,
      last_visit: new Date().toISOString()
    }).eq('id', customerId);
  }

  return {
    id: data.id,
    date: data.created_at.split('T')[0],
    service: data.service,
    amount: data.amount
  };
};

// ==========================================
// 4. 反馈与通知 (Feedbacks & Notifications)
// ==========================================

export const fetchFeedbacks = async (): Promise<FeedbackItem[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('feedbacks')
    .select('*')
    .order('created_at', { ascending: false });

  return (data || []).map(f => {
    const feedbackType = parseFeedbackType(f.text, f.request_type);
    return {
      feedbackType,
      id: f.id,
      customerName: f.customer_name || '匿名',
      date: f.created_at.split('T')[0],
      text: f.text,
      sentiment: f.sentiment,
      aiSummary: f.ai_summary,
      rating: f.rating,
      serviceName: f.service_name,
      requestStatus: f.request_status || undefined,
      handlingNote: f.handling_note || undefined,
      handledAt: f.handled_at || undefined,
      handledBy: f.handled_by || undefined,
      statusLabel: feedbackType === 'review' ? undefined : mapRequestStatusToLabel(f.request_status),
    };
  });
};

export const updateFeedbackHandling = async (
  feedbackId: string,
  requestStatus: 'pending' | 'processing' | 'resolved' | 'rejected',
  handlingNote: string
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  const { session } = await getSession();
  const handledAt = requestStatus === 'resolved' || requestStatus === 'rejected' ? new Date().toISOString() : null;

  const { error } = await supabase
    .from('feedbacks')
    .update({
      request_status: requestStatus,
      handling_note: handlingNote.trim() || null,
      handled_at: handledAt,
      handled_by: session?.user?.id || null,
    })
    .eq('id', feedbackId);

  if (error) {
    console.error('Update feedback handling error:', error);
    return false;
  }

  return true;
};

export const fetchNotifications = async (): Promise<NotificationItem[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .is('customer_id', null)
    .order('created_at', { ascending: false });

  return (data || []).map(n => ({
    id: n.id,
    title: n.title,
    message: n.message,
    time: new Date(n.created_at).toLocaleTimeString(),
    type: n.type,
    read: n.is_read
  }));
};

export const markNotificationRead = async (id: string) => {
  if (!isSupabaseConfigured()) return;
  if (id === 'ALL') {
    await supabase.from('notifications').update({ is_read: true }).is('customer_id', null);
  } else {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }
};

export const deleteNotification = async (id: string) => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  return !error;
};

export const deleteAllNotifications = async (ids: string[]) => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('notifications').delete().in('id', ids);
  return !error;
};

// ==========================================
// 5. 充值套餐 (Recharge Packages)
// ==========================================

const mapRechargePackageRow = (row: any): RechargePackageItem => ({
  id: row.id,
  name: row.name,
  price: Number(row.price),
  value: Number(row.value),
  benefits: row.benefits || [],
  description: row.description || '',
  scenes: row.scenes || [],
  isPopular: row.is_popular ?? false,
  isActive: row.is_active ?? true,
  sortOrder: row.sort_order ?? 0,
});

export const fetchRechargePackages = async (): Promise<RechargePackageItem[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('recharge_packages')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapRechargePackageRow);
  } catch (e) {
    console.error('Fetch recharge packages error:', e);
    return [];
  }
};

export const createRechargePackage = async (item: Omit<RechargePackageItem, 'id'>): Promise<RechargePackageItem | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('recharge_packages')
    .insert({
      name: item.name,
      price: item.price,
      value: item.value,
      benefits: item.benefits,
      description: item.description || null,
      scenes: item.scenes || [],
      is_popular: item.isPopular ?? false,
      is_active: item.isActive ?? true,
      sort_order: item.sortOrder ?? 100,
    })
    .select()
    .single();

  if (error) {
    console.error('Create recharge package error:', error);
    return null;
  }
  return mapRechargePackageRow(data);
};

export const updateRechargePackage = async (id: string, item: Partial<RechargePackageItem>): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase
    .from('recharge_packages')
    .update({
      name: item.name,
      price: item.price,
      value: item.value,
      benefits: item.benefits,
      description: item.description,
      scenes: item.scenes,
      is_popular: item.isPopular,
      is_active: item.isActive,
      sort_order: item.sortOrder,
    })
    .eq('id', id);

  if (error) {
    console.error('Update recharge package error:', error);
    return false;
  }
  return true;
};

export const deleteRechargePackage = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('recharge_packages').delete().eq('id', id);
  if (error) {
    console.error('Delete recharge package error:', error);
    return false;
  }
  return true;
};

// ==========================================
// 6. 服务目录 (Service Catalog)
// ==========================================

const mapServiceRow = (row: any): ServiceCatalogItem => ({
  id: row.id,
  name: row.name,
  price: row.price,
  durationMinutes: row.duration_minutes || 0,
  description: row.description || '',
  suitableFor: row.suitable_for || '',
  category: row.category || '基础服务',
  isActive: row.is_active ?? true,
  sortOrder: row.sort_order ?? 0,
});

export const fetchServiceCatalog = async (): Promise<ServiceCatalogItem[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('services_catalog')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapServiceRow);
  } catch (e) {
    console.error('Fetch service catalog error:', e);
    return [];
  }
};

export const createServiceCatalogItem = async (item: Omit<ServiceCatalogItem, 'id'>): Promise<ServiceCatalogItem | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('services_catalog')
    .insert({
      name: item.name,
      price: item.price,
      duration_minutes: item.durationMinutes || null,
      description: item.description || null,
      suitable_for: item.suitableFor || null,
      category: item.category || '基础服务',
      is_active: item.isActive ?? true,
      sort_order: item.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Create service catalog item error:', error);
    return null;
  }

  return mapServiceRow(data);
};

export const updateServiceCatalogItem = async (id: string, item: Partial<ServiceCatalogItem>): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase
    .from('services_catalog')
    .update({
      name: item.name,
      price: item.price,
      duration_minutes: item.durationMinutes,
      description: item.description,
      suitable_for: item.suitableFor,
      category: item.category,
      is_active: item.isActive,
      sort_order: item.sortOrder,
    })
    .eq('id', id);

  if (error) {
    console.error('Update service catalog item error:', error);
    return false;
  }

  return true;
};

export const deleteServiceCatalogItem = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('services_catalog').delete().eq('id', id);
  if (error) {
    console.error('Delete service catalog item error:', error);
    return false;
  }
  return true;
};

// ==========================================
// 5. 营销中心 (Campaigns)
// ==========================================

export const fetchCampaigns = async (): Promise<Campaign[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  return (data || []).map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    type: c.type,
    status: c.status,
    startDate: c.start_date,
    endDate: c.end_date,
    createdAt: c.created_at,
    targetAudience: c.target_audience || ['all'],
    clicks: c.clicks || 0
  }));
};

export const createCampaign = async (campaign: any) => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase
    .from('campaigns')
    .insert({
      title: campaign.title,
      description: campaign.description,
      type: campaign.type,
      start_date: campaign.startDate,
      end_date: campaign.endDate,
      status: campaign.status,
      target_audience: campaign.targetAudience
    });
  return !error;
};

export const updateCampaignStatus = async (id: string, status: string) => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('campaigns').update({ status }).eq('id', id);
  return !error;
};

export const deleteCampaign = async (id: string) => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  return !error;
};

// ==========================================
// 6. 访客扫描与预约 (Visits & Appointments)
// ==========================================

export const logVisitor = async (log: VisitorLog) => {
  if (!isSupabaseConfigured()) return;
  await supabase.from('visits').insert({
    customer_id: log.customer?.id,
    estimated_age: log.analysis.estimatedAge,
    gender: log.analysis.gender,
    mood: log.analysis.mood,
    clothing_style: log.analysis.clothingStyle,
    suggested_action: log.analysis.suggestedAction,
    is_new: !log.customer
  });
};

export const fetchAppointments = async (): Promise<Appointment[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('appointments')
    .select('*, customers(name)')
    .order('appointment_time', { ascending: true });

  return (data || []).map((a: any) => ({
    id: a.id,
    customerId: a.customer_id,
    customerName: a.customers?.name || '未知',
    serviceName: a.service_name,
    time: a.appointment_time,
    status: a.status,
    notes: a.notes
  }));
};

export const updateAppointmentStatus = async (id: string, status: string) => {
  if (!isSupabaseConfigured()) return;
  await supabase.from('appointments').update({ status }).eq('id', id);
};

export const settleAppointment = async (id: string, custId: string, svc: string, amt: number) => {
  const txn = await addTransaction(custId, svc, amt);
  if (txn) {
    await updateAppointmentStatus(id, 'completed');
    return { success: true, message: '结算成功' };
  }
  return { success: false, message: '结算失败' };
};

export const deleteAppointment = async (id: string) => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('appointments').delete().eq('id', id);
  return !error;
};

export const bulkDeleteAppointments = async (ids: string[]) => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('appointments').delete().in('id', ids);
  return !error;
};

export const fetchSlotConfigs = async (): Promise<Record<string, number>> => {
  if (!isSupabaseConfigured()) return {};
  const { data } = await supabase.from('slot_configs').select('time_slot, capacity');
  const configs: Record<string, number> = {};
  (data || []).forEach(item => { configs[item.time_slot] = item.capacity; });
  return configs;
};

export const updateSlotCapacity = async (slot: string, capacity: number): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('slot_configs').upsert({ time_slot: slot, capacity }, { onConflict: 'time_slot' });
  return !error;
};

// ==========================================
// 7. 客服聊天 (Customer Chat)
// ==========================================

export const fetchChatMessages = async (id: string): Promise<ChatMessage[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: true });

  return (data || []).map(m => ({
    id: m.id,
    customerId: m.customer_id,
    sender: m.sender,
    text: m.text,
    createdAt: m.created_at
  }));
};

export const sendAdminMessage = async (id: string, text: string) => {
  if (!isSupabaseConfigured()) return;
  await supabase.from('chat_messages').insert({ customer_id: id, sender: 'admin', text });
};

// ==========================================
// 8. AI 助理模块 (AI Assistant Cloud Ops)
// ==========================================

/**
 * 获取 AI 助手的云端历史对话记录
 */
export const fetchAssistantHistory = async (): Promise<{sender: 'user' | 'bot', text: string, timestamp: string}[]> => {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('assistant_chat_messages')
    .select('sender, text, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Fetch assistant history error:", error);
    return [];
  }

  return data.map(m => ({
    sender: m.sender as 'user' | 'bot',
    text: m.text,
    timestamp: m.created_at
  }));
};

/**
 * 将 AI 助理的一条对话保存到数据库
 */
export const saveAssistantMessage = async (sender: 'user' | 'bot', text: string) => {
  if (!isSupabaseConfigured()) return;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase
    .from('assistant_chat_messages')
    .insert({
      user_id: session.user.id,
      sender,
      text
    });

  if (error) console.error("Save assistant message error:", error);
};

/**
 * 清空当前登录用户的 AI 助手所有历史记录
 */
export const clearAssistantHistory = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { error } = await supabase
    .from('assistant_chat_messages')
    .delete()
    .eq('user_id', session.user.id);

  if (error) console.error("Clear history error:", error);
  return !error;
};

/**
 * 获取实时业务上下文快照，为 AI 提供决策背景。
 * 包含：核心指标、最近活跃客户、待办预约。
 */
export const getBusinessContextForAI = async (): Promise<string> => {
  if (!isSupabaseConfigured()) return "数据库未连接";
  
  try {
    const stats = await fetchDashboardStats();
    
    // 获取最近 5 位消费客户的活跃动态
    const { data: recentCustomers } = await supabase
      .from('customers')
      .select('name, tier, total_spent')
      .order('last_visit', { ascending: false })
      .limit(5);

    // 获取即将开始的 5 个确认预约
    const { data: upcomingAppointments } = await supabase
      .from('appointments')
      .select('*, customers(name)')
      .eq('status', 'confirmed')
      .order('appointment_time', { ascending: true })
      .limit(5);

    let context = `--- Lumina Services 实时业务数据快照 (${new Date().toLocaleString()}) ---\n`;
    context += `[统计概览] 客户总量: ${stats.totalCustomers}位, 累计营收: $${stats.totalRevenue}, 平均满意度: ${stats.avgSatisfaction}/5\n`;
    
    if (recentCustomers && recentCustomers.length > 0) {
      context += `[活跃动态] 最近光顾: ${recentCustomers.map(c => `${c.name}(${c.tier})`).join(', ')}\n`;
    }
    
    if (upcomingAppointments && upcomingAppointments.length > 0) {
      context += `[待办预约] 即将到店: ${upcomingAppointments.map((a: any) => `${a.customers?.name} 预约了 ${a.service_name} @ ${new Date(a.appointment_time).toLocaleTimeString()}`).join('; ')}\n`;
    }

    return context;
  } catch (e) {
    console.error("Context build error:", e);
    return "系统当前处于高负载或无法连接到业务快照。请根据通用店务经验和既往聊天记录回答。";
  }
};
