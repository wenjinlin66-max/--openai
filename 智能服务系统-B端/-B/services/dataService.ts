import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Customer, VisitorLog, FeedbackItem, Transaction, Appointment, ChatMessage, DashboardStats, CustomerTier, Campaign, NotificationItem } from '../types';
import { SERVICES_LIST } from '../constants';

// 优化：单独获取仪表盘统计数据 (轻量级查询)
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  if (!isSupabaseConfigured()) {
    return { totalCustomers: 0, totalRevenue: 0, totalVisits: 0, avgSatisfaction: "0", tierDistribution: [] };
  }

  try {
    // 并行请求数据，只查询需要的字段
    const [customersRes, feedbacksRes] = await Promise.all([
      supabase.from('customers').select('tier, total_spent, visit_count'),
      supabase.from('feedbacks').select('sentiment')
    ]);

    const customers = customersRes.data || [];
    const feedbacks = feedbacksRes.data || [];

    // 1. 计算营收和访问量
    const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
    const totalVisits = customers.reduce((sum, c) => sum + (c.visit_count || 0), 0);

    // 2. 计算满意度
    let avgSatisfaction = "0";
    if (feedbacks.length > 0) {
      const positive = feedbacks.filter(f => f.sentiment === 'positive').length;
      const neutral = feedbacks.filter(f => f.sentiment === 'neutral').length;
      const score = (positive * 5 + neutral * 3 + (feedbacks.length - positive - neutral) * 1) / feedbacks.length;
      avgSatisfaction = score.toFixed(1);
    }

    // 3. 计算会员分布
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

    return {
      totalCustomers: customers.length,
      totalRevenue,
      totalVisits,
      avgSatisfaction,
      tierDistribution
    };
  } catch (e) {
    console.error("Error fetching stats:", e);
    return { totalCustomers: 0, totalRevenue: 0, totalVisits: 0, avgSatisfaction: "0", tierDistribution: [] };
  }
};

// 服务端分页获取客户
export const fetchCustomers = async (
  page: number = 1, 
  pageSize: number = 10, 
  searchQuery: string = ''
): Promise<{ data: Customer[], total: number }> => {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase 未配置");
    return { data: [], total: 0 };
  }

  try {
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' });

    if (searchQuery) {
      query = supabase.from('customers').select('*', { count: 'exact' }).ilike('name', `%${searchQuery}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data: customersData, count, error: customersError } = await query
      .order('last_visit', { ascending: false })
      .range(from, to);

    if (customersError) throw customersError;
    if (!customersData || customersData.length === 0) return { data: [], total: 0 };

    const customerIds = customersData.map(c => c.id);

    const [transactionsRes, walletsRes] = await Promise.all([
      supabase.from('transactions').select('*').in('customer_id', customerIds).order('created_at', { ascending: false }),
      supabase.from('wallets').select('*').in('customer_id', customerIds)
    ]);

    const transactionsData = transactionsRes.data || [];
    const walletsData = walletsRes.data || [];

    const mappedCustomers = customersData.map((row: any) => {
      const customerTxns = transactionsData.filter((t: any) => t.customer_id === row.id);
      const wallet = walletsData.find((w: any) => w.customer_id === row.id);

      return {
        id: row.id,
        name: row.name,
        avatarUrl: row.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=random`,
        tier: row.tier,
        tags: row.tags || [],
        visitCount: row.visit_count || 0,
        totalSpent: row.total_spent || 0,
        balance: wallet ? wallet.balance : 0,
        points: wallet ? wallet.points : 0,
        lastVisit: row.last_visit ? row.last_visit.split('T')[0] : new Date().toISOString().split('T')[0],
        notes: row.notes || '',
        preferences: row.preferences || [],
        history: customerTxns.map((t: any) => ({
          id: t.id,
          date: t.created_at.split('T')[0],
          service: t.service,
          amount: t.amount,
          rating: t.rating || 5
        }))
      };
    });

    return { data: mappedCustomers, total: count || 0 };

  } catch (error: any) {
    console.error("Error in fetchCustomers:", error.message || error);
    return { data: [], total: 0 };
  }
};

export const createCustomer = async (customer: Partial<Customer>): Promise<Customer | null> => {
  if (!isSupabaseConfigured()) return null;

  const dbPayload = {
    name: customer.name,
    tier: customer.tier,
    tags: customer.tags,
    notes: customer.notes,
    avatar_url: customer.avatarUrl,
    visit_count: 1,
    total_spent: 0,
    last_visit: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('customers')
    .insert(dbPayload)
    .select()
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    return null;
  }

  await supabase.from('wallets').insert({ customer_id: data.id, balance: 0, points: 0 });

  return {
    ...customer,
    id: data.id,
    visitCount: data.visit_count,
    totalSpent: data.total_spent,
    balance: 0,
    points: 0,
    lastVisit: data.last_visit,
    preferences: [],
    history: []
  } as Customer;
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  const dbPayload: any = {};
  if (updates.name) dbPayload.name = updates.name;
  if (updates.tier) dbPayload.tier = updates.tier;
  if (updates.tags) dbPayload.tags = updates.tags;
  if (updates.notes) dbPayload.notes = updates.notes;

  const { error } = await supabase
    .from('customers')
    .update(dbPayload)
    .eq('id', id);

  if (error) return false;
  return true;
};

export const deleteCustomer = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  try {
    await supabase.from('visits').delete().eq('customer_id', id);
    await supabase.from('feedbacks').delete().eq('customer_id', id);
    await supabase.from('transactions').delete().eq('customer_id', id);
    await supabase.from('wallets').delete().eq('customer_id', id);
    await supabase.from('notifications').delete().eq('customer_id', id);
    await supabase.from('appointments').delete().eq('customer_id', id);
    await supabase.from('chat_messages').delete().eq('customer_id', id);
    
    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (error) return false;
    return true;
  } catch (e) {
    console.error("Exception during deleteCustomer:", e);
    return false;
  }
};

export const rechargeCustomer = async (customerId: string, amount: number): Promise<Transaction | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: txnData, error: txnError } = await supabase
      .from('transactions')
      .insert({
        customer_id: customerId,
        service: '柜台充值',
        amount: amount,
        rating: 5
      })
      .select()
      .single();

    if (txnError) throw txnError;

    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance, points')
      .eq('customer_id', customerId)
      .single();

    const newBalance = Number(wallet?.balance || 0) + amount;
    const newPoints = (wallet?.points || 0) + Math.floor(amount);

    if (wallet) {
      await supabase.from('wallets')
        .update({ 
          balance: newBalance,
          points: newPoints
        })
        .eq('customer_id', customerId);
    }

    // 充值成功通知 (仅写入数据库供C端看，B端不再展示)
    await supabase.from('notifications').insert({
      customer_id: customerId,
      title: '充值成功',
      message: `您的账户已成功充值 ¥${amount}，当前余额 ¥${newBalance}。`,
      type: 'success',
      is_read: false
    });

    return {
      id: txnData.id,
      date: txnData.created_at.split('T')[0],
      service: txnData.service,
      amount: txnData.amount,
      rating: txnData.rating
    };
  } catch (error) {
    console.error('Error processing recharge:', error);
    return null;
  }
};

export const addTransaction = async (customerId: string, service: string, amount: number): Promise<Transaction | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: txnData, error: txnError } = await supabase
      .from('transactions')
      .insert({
        customer_id: customerId,
        service: service,
        amount: amount,
        rating: 5
      })
      .select()
      .single();

    if (txnError) throw txnError;

    const { data: currentCustomer } = await supabase
      .from('customers')
      .select('total_spent, visit_count')
      .eq('id', customerId)
      .single();
    
    if (currentCustomer) {
      await supabase.from('customers').update({
        total_spent: (currentCustomer.total_spent || 0) + amount,
        visit_count: (currentCustomer.visit_count || 0) + 1,
        last_visit: new Date().toISOString()
      }).eq('id', customerId);
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance, points')
      .eq('customer_id', customerId)
      .single();

    if (wallet) {
      await supabase.from('wallets')
        .update({ 
          balance: wallet.balance - amount,
        })
        .eq('customer_id', customerId);
    }

    await supabase.from('notifications').insert({
      customer_id: customerId,
      title: '消费提醒',
      message: `您刚刚在 ${service} 中消费 ¥${amount}。`,
      type: 'info',
      is_read: false
    });

    return {
      id: txnData.id,
      date: txnData.created_at.split('T')[0],
      service: txnData.service,
      amount: txnData.amount,
      rating: txnData.rating
    };
  } catch (error) {
    console.error('Error processing transaction:', error);
    return null;
  }
};

export const settleAppointment = async (
  appointmentId: string, 
  customerId: string, 
  serviceName: string,
  amount: number
): Promise<{ success: boolean, message: string }> => {
  if (!isSupabaseConfigured()) return { success: false, message: '数据库未连接' };

  try {
    if (!customerId) return { success: false, message: '客户信息缺失，无法结算' };

    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('customer_id', customerId)
      .single();

    if (!wallet) {
      return { success: false, message: '未找到该客户的钱包账户。' };
    }

    if (wallet.balance < amount) {
      return { success: false, message: `余额不足 (需 $${amount}, 当前 $${wallet.balance})。` };
    }

    const txn = await addTransaction(customerId, `预约服务: ${serviceName}`, amount);
    if (!txn) return { success: false, message: '交易记录创建失败' };

    const { error } = await supabase.from('appointments')
      .update({ status: 'completed' })
      .eq('id', appointmentId);

    if (error) throw error;

    return { success: true, message: `结算成功，已扣除 $${amount}。` };
  } catch (e: any) {
    return { success: false, message: e.message || '系统错误' };
  }
};

export const logVisitor = async (log: VisitorLog) => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('visits').insert({
    customer_id: log.customer?.id,
    estimated_age: log.analysis.estimatedAge,
    gender: log.analysis.gender,
    mood: log.analysis.mood,
    clothing_style: log.analysis.clothingStyle,
    suggested_action: log.analysis.suggestedAction,
    is_new: !log.customer
  });
  if (error) console.error('Error logging visitor:', error);
};

export const fetchFeedbacks = async (): Promise<FeedbackItem[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('feedbacks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data.map((row: any) => ({
    id: row.id,
    customerName: row.customer_name || '匿名',
    date: row.created_at.split('T')[0],
    text: row.text,
    sentiment: row.sentiment,
    aiSummary: row.ai_summary
  }));
};

export const fetchNotifications = async (): Promise<NotificationItem[]> => {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .is('customer_id', null) // Admin notifications only
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      time: new Date(row.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      type: row.type,
      read: row.is_read
    }));
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
};

export const markNotificationRead = async (id: string) => {
  if (!isSupabaseConfigured()) return;
  
  if (id === 'ALL') {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .is('customer_id', null);
  } else {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  }
};

export const deleteNotification = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  return !error;
};

export const deleteAllNotifications = async (ids?: string[]): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  let query = supabase.from('notifications').delete();
  
  // 如果提供了具体ID列表，则删除这些ID；否则删除所有管理员通知
  if (ids && ids.length > 0) {
    query = query.in('id', ids);
  } else {
    query = query.is('customer_id', null);
  }

  const { error } = await query;
  return !error;
};

// --- 全景业务上下文 (AI) ---
export const getBusinessContextForAI = async (): Promise<string> => {
  if (!isSupabaseConfigured()) return "数据库连接未就绪，无法获取实时数据。";

  try {
    const [
      topCustomersRes,
      recentFeedbacksRes,
      customerCountRes,
      upcomingApptsRes,
      recentChatsRes,
      financialRes
    ] = await Promise.all([
      supabase.from('customers').select('name, tier, total_spent, notes, last_visit').order('total_spent', { ascending: false }).limit(10),
      supabase.from('feedbacks').select('text, sentiment, customer_name, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('appointments').select('appointment_time, service_name, status, customers(name)').gte('appointment_time', new Date().toISOString()).order('appointment_time', { ascending: true }).limit(10),
      supabase.from('chat_messages').select('text, created_at, sender, customers(name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('transactions').select('amount, created_at').order('created_at', { ascending: false }).limit(20)
    ]);

    const recentTransactions = financialRes.data || [];
    const recentRevenue = recentTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

    let context = `
    === 业务全景快照 (Generated at ${new Date().toLocaleString()}) ===

    【经营概况】
    - 客户总数: ${customerCountRes.count || 0} 人
    - 最近20笔交易总额: $${recentRevenue}
    - 提供的服务项目: ${SERVICES_LIST.join(', ')}

    【VIP 客户列表 (Top 10)】
    ${topCustomersRes.data?.map(c => `- ${c.name} [${c.tier}]: 累计消费$${c.total_spent}, 最近到店: ${c.last_visit?.split('T')[0] || '未知'}, 备注: ${c.notes || '无'}`).join('\n') || '无数据'}

    【即将到来的预约 (未来10条)】
    ${upcomingApptsRes.data?.map((a: any) => `- 时间: ${new Date(a.appointment_time).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'})} | 客户: ${a.customers?.name || '未知'} | 项目: ${a.service_name} | 状态: ${a.status}`).join('\n') || '无预约'}

    【最近客户反馈 (Top 10)】
    ${recentFeedbacksRes.data?.map(f => `- [${f.sentiment}] ${f.customer_name} (${f.created_at.split('T')[0]}): "${f.text}"`).join('\n') || '无反馈'}

    【最近沟通记录 (客服中心)】
    ${recentChatsRes.data?.map((c: any) => `- ${c.sender === 'admin' ? '店员' : c.customers?.name || '客户'}: "${c.text}"`).join('\n') || '无记录'}
    `;

    return context;
  } catch (e) {
    return "系统提示：获取业务数据失败。";
  }
};

export const fetchAppointments = async (): Promise<Appointment[]> => {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, customer_id, service_name, appointment_time, status, notes,
      customers ( name )
    `)
    .order('appointment_time', { ascending: true });

  if (error) return [];

  return data.map((row: any) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customers?.name || '未知客户',
    serviceName: row.service_name,
    time: row.appointment_time,
    status: row.status,
    notes: row.notes
  }));
};

export const updateAppointmentStatus = async (id: string, status: string) => {
  if (!isSupabaseConfigured()) return;
  await supabase.from('appointments').update({ status }).eq('id', id);
};

export const deleteAppointment = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('appointments').delete().eq('id', id);
  return !error;
};

export const bulkDeleteAppointments = async (ids: string[]): Promise<boolean> => {
  if (!isSupabaseConfigured() || ids.length === 0) return false;
  const { error } = await supabase.from('appointments').delete().in('id', ids);
  return !error;
};

export const fetchChatMessages = async (customerId: string): Promise<ChatMessage[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  if (error) return [];

  return data.map((row: any) => ({
    id: row.id,
    customerId: row.customer_id,
    sender: row.sender,
    text: row.text,
    createdAt: row.created_at
  }));
};

export const sendAdminMessage = async (customerId: string, text: string) => {
  if (!isSupabaseConfigured()) return;
  await supabase.from('chat_messages').insert({
    customer_id: customerId,
    sender: 'admin',
    text: text,
    is_read: false
  });
};

// --- 营销中心 (Campaigns) API ---

export const fetchCampaigns = async (): Promise<Campaign[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Fetch campaigns error:", error);
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at
  }));
};

export const createCampaign = async (campaign: Partial<Campaign>): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  // 修复：不再强制 'draft'，允许前端传入 active
  const { error } = await supabase.from('campaigns').insert({
    title: campaign.title,
    description: campaign.description,
    type: campaign.type,
    start_date: campaign.startDate,
    end_date: campaign.endDate,
    status: campaign.status || 'draft' 
  });

  if (error) {
    console.error("Create campaign error:", error);
    return false;
  }
  return true;
};

export const updateCampaignStatus = async (id: string, status: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('campaigns').update({ status }).eq('id', id);
  return !error;
};

export const deleteCampaign = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) {
    console.error("Delete campaign error:", error);
    return false;
  }
  return true;
};