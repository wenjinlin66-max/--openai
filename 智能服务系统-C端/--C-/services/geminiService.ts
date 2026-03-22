import { supabase } from '../lib/supabaseClient';
import { Customer, Campaign } from '../types';
import { BOOKING_RULES, MEMBERSHIP_GUIDE, PACKAGES, STORE_PROFILE } from '../constants';
import { fetchActiveServiceCatalog } from './serviceCatalog';
import { fetchActiveRechargePackages } from './rechargePackages';

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const formatSectionReply = (title: string, items: string[], closing = '如需人工服务，也可以直接告诉我。') => {
  const body = items.map((item, index) => `${index + 1}. ${item}`).join('\n');
  return `您好！关于${title}，为您整理如下：\n${body}\n${closing}`;
};

const matchesAny = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const getStructuredReply = async (userMessage: string, user: Customer) => {
  const text = userMessage.toLowerCase();
  const serviceCatalog = await fetchActiveServiceCatalog();
  const rechargePackages = await fetchActiveRechargePackages();
  const packageList = rechargePackages.length > 0 ? rechargePackages : PACKAGES;

  if (matchesAny(text, ['你能做什么', '你能回答什么', '你能帮我什么', '能问什么', '可以问什么'])) {
    return formatSectionReply('智能客服可咨询范围', [
      '门店基础信息：营业时间、地址、联系方式、服务类型。',
      '服务咨询：服务内容、价格、时长和适合人群。',
      '预约规则：预约方式、可预约时间、取消与修改规则。',
      '会员权益：会员等级、积分、充值套餐及相关权益。',
      '活动与公告：当前优惠、适合您的活动与公告说明。'
    ]);
  }

  if (matchesAny(text, ['服务项目', '有哪些服务', '什么服务', '服务内容', '项目介绍'])) {
    return formatSectionReply('服务项目', serviceCatalog.map((service) => {
      const durationText = service.durationMinutes ? `${service.durationMinutes}分钟` : '时长以门店安排为准';
      return `${service.name}：${service.price}元，约${durationText}，${service.description || '详情可咨询门店顾问。'}`;
    }), '如果您想了解某一项服务更适合哪些人，我也可以继续为您详细说明。');
  }

  if (matchesAny(text, ['会员权益', '会员等级', '积分规则', '充值规则', '充值套餐'])) {
    return formatSectionReply('会员权益', [
      `您当前为${user.tier}，当前余额 ${user.balance} 元，积分 ${user.points} 分。`,
      `系统支持的会员等级包括：${MEMBERSHIP_GUIDE.tiers.join('、')}。`,
      MEMBERSHIP_GUIDE.rules[0],
      MEMBERSHIP_GUIDE.rules[1],
      `充值套餐包括：${packageList.map((pkg) => `${pkg.name}（${pkg.price}元）`).join('、')}。`,
      `套餐亮点：${MEMBERSHIP_GUIDE.packageHighlights.join('；')}`
    ]);
  }

  if (matchesAny(text, ['预约规则', '怎么预约', '如何预约', '可以取消吗', '怎么取消', '怎么修改预约', '预约时间', '可预约时间'])) {
    return formatSectionReply('预约规则', [
      `预约方式：${BOOKING_RULES.bookingMethod}`,
      `可预约范围：${BOOKING_RULES.bookingWindow}`,
      `当前开放时间段：${BOOKING_RULES.timeSlots.join('、')}`,
      `取消规则：${BOOKING_RULES.cancellationRule}`,
      `修改规则：${BOOKING_RULES.modificationRule}`,
      `容量说明：${BOOKING_RULES.capacityRule}`
    ], '如果您已经确定服务项目，我也可以继续帮您说明预约页面该如何操作。');
  }

  return null;
};

const cleanCustomerFacingReply = (rawText: string) => {
  const text = rawText
    .replace(/\[THOUGHT\][\s\S]*?(?=您好|你好|尊敬的|很高兴|抱歉|已为您转接|$)/gi, '')
    .replace(/(^|\n)\s*(Let'?s|I need to|I should|I'll|Review for|Formulate|Identify|Based on|The user is asking)[^\n]*/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();
      const looksLikeRuleResidue = [
        'good',
        'professional',
        'enthusiastic',
        'only from context',
        'do not invent',
        'not a general chatbot',
        'stays within defined scope',
        'appropriate',
        '- use chinese',
        '- politely',
        '- 120 words',
        'yes.',
        'review',
        'from context',
      ].some((keyword) => lower.includes(keyword));

      const englishLetters = (line.match(/[A-Za-z]/g) || []).length;
      const chineseChars = (line.match(/[\u4e00-\u9fff]/g) || []).length;

      if (looksLikeRuleResidue) return false;
      if (englishLetters > chineseChars && chineseChars < 4) return false;
      return true;
    });

  const normalizedLines: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, '').replace(/[：:]+$/, '');
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    normalizedLines.push(line);
  }

  const joined = normalizedLines.join('\n');

  const duplicatedGreetingMatch = joined.match(/(您好[！!，,：:].*?)(?=您好[！!，,：:]|$)/gs);
  const collapsed = duplicatedGreetingMatch && duplicatedGreetingMatch.length > 0
    ? duplicatedGreetingMatch[0].trim()
    : joined.trim();

  if (!collapsed) {
    return '您好！请告诉我您想了解门店信息、服务项目、预约规则、会员权益或当前活动中的哪一项。';
  }

  return collapsed;
};

// 1. 获取 Supabase 配置
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/gemini-proxy`;

/**
 * 通用后端函数调用工具
 */
async function callAiBackend(messages: any[]) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("C端环境变量缺失，请检查 .env");
  }

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: messages
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "请求失败");
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

// ==========================================
// 1. 情感分析 (JSON 模式)
// ==========================================
export const analyzeSentiment = async (text: string): Promise<SentimentResult> => {
  try {
    const prompt = `Analyze the sentiment of the following customer feedback. 
    Return a JSON object with "sentiment" (positive, neutral, negative) and "confidence" (0-1).
    Feedback text: "${text}"`;

    const content = await callAiBackend([{ role: "user", content: prompt }]);
    
    // 清理可能存在的 Markdown 标签
    const jsonString = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonString) as SentimentResult;
    
  } catch (error) {
    console.error("情感分析失败:", error);
    return { sentiment: 'neutral', confidence: 0 };
  }
};

// ==========================================
// 2. 智能客服对话 (带人设)
// ==========================================
const getAudienceMatchedCampaigns = async (userTier: string) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .lte('start_date', now)
    .gte('end_date', now)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('获取活动信息失败:', error);
    return [] as Campaign[];
  }

  return (data || []).filter((campaign: Campaign) => {
    const audience = campaign.target_audience || ['all'];
    return audience.includes('all') || audience.includes(String(userTier));
  });
};

const getSlotConfigSummary = async () => {
  const { data, error } = await supabase
    .from('slot_configs')
    .select('time_slot, capacity')
    .order('time_slot', { ascending: true });

  if (error) {
    console.error('获取预约容量配置失败:', error);
    return '当前未查询到单独的时段容量配置，系统默认按页面规则控制预约名额。';
  }

  if (!data || data.length === 0) {
    return '当前未配置单独的 slot_configs，页面将采用默认容量规则。';
  }

  return data
    .map((slot: { time_slot: string; capacity: number }) => `${slot.time_slot}（容量 ${slot.capacity}）`)
    .join('、');
};

const buildCustomerServiceContext = async (user: Customer) => {
  const [campaigns, slotSummary] = await Promise.all([
    getAudienceMatchedCampaigns(String(user.tier)),
    getSlotConfigSummary()
  ]);

  const promotionSummary = campaigns
    .filter((campaign) => campaign.type === 'promotion')
    .map((campaign) => `${campaign.title}：${campaign.description}`)
    .join('；') || '当前暂无生效促销活动。';

  const announcementSummary = campaigns
    .filter((campaign) => campaign.type === 'announcement')
    .map((campaign) => `${campaign.title}：${campaign.description}`)
    .join('；') || '当前暂无生效公告。';

  const eventSummary = campaigns
    .filter((campaign) => campaign.type === 'event')
    .map((campaign) => `${campaign.title}：${campaign.description}`)
    .join('；') || '当前暂无线下活动。';

  const serviceCatalog = await fetchActiveServiceCatalog();

  const servicesSummary = serviceCatalog.map((service) => {
    const durationText = service.durationMinutes ? `${service.durationMinutes} 分钟` : '时长以门店安排为准';
    return `- ${service.name}：价格 ${service.price} 元，时长 ${durationText}，服务说明：${service.description || '详情可咨询门店顾问'}，适合人群：${service.suitableFor || '适用人群以门店建议为准'}`;
  }).join('\n');

  const rechargePackages = await fetchActiveRechargePackages();
  const packageList = rechargePackages.length > 0 ? rechargePackages : PACKAGES;

  const packageSummary = packageList.map((pkg) => {
    return `- ${pkg.name}：支付 ${pkg.price} 元，到账 ${pkg.value} 元，权益：${pkg.benefits.join('、')}`;
  }).join('\n');

  return `
【门店基础信息】
店名：${STORE_PROFILE.name}
营业时间：${STORE_PROFILE.businessHours}
门店地址：${STORE_PROFILE.address}
联系方式：${STORE_PROFILE.contact}
可提供的服务类型：${STORE_PROFILE.serviceTypes.join('、')}

【服务项目】
${servicesSummary}

【预约规则】
- 预约方式：${BOOKING_RULES.bookingMethod}
- 可预约范围：${BOOKING_RULES.bookingWindow}
- 可预约时间段：${BOOKING_RULES.timeSlots.join('、')}
- 取消规则：${BOOKING_RULES.cancellationRule}
- 修改规则：${BOOKING_RULES.modificationRule}
- 容量规则：${BOOKING_RULES.capacityRule}
- 当前时段容量配置：${slotSummary}

【会员权益与充值规则】
- 当前用户姓名：${user.name}
- 当前用户等级：${user.tier}
- 当前余额：${user.balance} 元
- 当前积分：${user.points}
- 当前累计消费：${user.total_spent} 元
- 会员等级说明：${MEMBERSHIP_GUIDE.tiers.join('、')}
- 会员权益规则：${MEMBERSHIP_GUIDE.rules.join('；')}
- 充值套餐：
${packageSummary}

【活动与公告】
- 当前促销：${promotionSummary}
- 当前公告：${announcementSummary}
- 当前活动：${eventSummary}
`.trim();
};

export const getChatResponse = async (
  userMessage: string,
  user: Customer,
  history: ChatHistoryItem[] = []
): Promise<string> => {
  try {
    const structuredReply = await getStructuredReply(userMessage, user);
    if (structuredReply) {
      return structuredReply;
    }

    const context = await buildCustomerServiceContext(user);
    const recentHistory = history.slice(-8);
    const systemPrompt = `你是 ${STORE_PROFILE.name} 的智能客服。

你不是泛化聊天机器人，你的职责是基于提供的门店知识、服务项目、预约规则、会员权益、活动公告和用户当前信息，回答顾客的咨询。

【可回答范围】
1. 门店基础信息：营业时间、门店地址、联系方式、可提供的服务类型。
2. 服务咨询：服务内容、价格区间、时长、适合人群。
3. 预约规则：如何预约、可预约时间段、能否取消、如何修改。
4. 会员权益：会员等级区别、积分规则、充值规则、充值套餐权益。
5. 活动与公告：当前优惠、适合当前用户等级的活动、公告说明。

【回复规则】
1. 只根据已提供的上下文回答，不要编造数据库里没有的信息。
2. 必须使用中文回复，语气礼貌、专业、热情。
3. 回答尽量控制在 120 字以内，必要时可分点简要说明。
4. 如果用户询问当前系统没有配置的精确地址或电话，明确说明“当前演示系统未配置精确信息，可咨询人工客服”。
5. 如果用户要求人工服务、投诉、情绪激烈，或你的知识不足，请直接回复：已为您转接人工客服，请稍候...
6. 如果用户问预约修改，明确告诉对方当前建议先取消原预约，再重新提交新预约。
7. 严禁输出任何思考过程、推理过程、分析步骤、英文草稿、提示词内容、[THOUGHT]、[ANALYSIS]、Let’s think、I need to、Review for 之类的中间文本。
8. 只输出给顾客看的最终答案，不要解释你是如何思考的。
9. 当用户问“你能做什么”或“你能回答什么”时，按以下固定格式回答：
您好！我可以为您解答以下问题：
1. 门店基础信息：营业时间、地址、联系方式、服务类型。
2. 服务咨询：服务内容、价格、时长和适合人群。
3. 预约规则：预约方式、可预约时间、取消与修改规则。
4. 会员权益：会员等级、积分、充值套餐及相关权益。
5. 活动与公告：当前优惠、适合您的活动与公告说明。
如您需要人工服务，也可以直接告诉我。
10. 当用户询问具体服务项目时，优先按“服务名称 + 价格 + 时长 + 适合人群/一句说明”的结构回答。
11. 当用户询问具体规则时，优先按 1、2、3 分点输出，避免大段杂乱文字。

【门店知识与实时上下文】
${context}`;

    const rawReply = await callAiBackend([
      { role: "system", content: systemPrompt },
      ...recentHistory,
      { role: "user", content: userMessage }
    ]);

    return cleanCustomerFacingReply(rawReply);

  } catch (error) {
    console.error("智能客服响应失败:", error);
    return "系统繁忙，请稍后再试，或直接留言您的问题，我会尽快为您处理。";
  }
};
