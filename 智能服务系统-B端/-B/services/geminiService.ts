import { AnalysisResult, Customer } from '../types';

// 1. 获取环境变量（请确保 .env 中有这两项并已重启项目）
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 后端函数完整地址
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/gemini-proxy`;

/**
 * 通用 AI 请求封装 (适配老王 API 所需的 OpenAI 格式)
 */
async function callAiBackend(messages: any[]) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("环境变量 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY 缺失");
  }

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash", // 对应老王提供的模型名
      messages: messages
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "后端函数调用失败");
  }

  const result = await response.json();
  // 返回 OpenAI 格式中的文本内容
  return result.choices[0].message.content;
}

// ==========================================
// 1. 图片分析 (多模态分析)
// ==========================================
export const analyzeCustomerImage = async (base64Image: string): Promise<AnalysisResult> => {
  const prompt = `Analyze this image of a person entering a luxury service store. 
  Provide a JSON object with the following fields:
  - estimatedAge: string (e.g., "25-30岁")
  - gender: string (Return in Chinese, e.g., "男", "女")
  - mood: string (Return in Chinese, e.g., "开心", "匆忙", "平静")
  - clothingStyle: string (Return in Chinese, e.g., "商务西装", "休闲运动", "复古搭配")
  - distinctiveFeatures: string (A comma-separated list of highly specific visual features that can help identify this person later. Examples: "黑框眼镜, 红色羊毛围巾, 银色耳环, Nike白色板鞋". If nothing distinctive, describe hair or specific colors.)
  - suggestedAction: string (A high-EQ, personalized greeting suggestion for the staff. Use the visual features to make it specific. Example: "赞美她的红色围巾很衬肤色，询问是否需要热茶。")
  `;

  // 确保图片带有正确的 Data URL 前缀
  const imageUrl = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;

  try {
    const content = await callAiBackend([
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }
    ]);

    // 清理 AI 可能返回的 Markdown 标签 (如 ```json ...)
    const jsonString = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonString) as AnalysisResult;
    
  } catch (error) {
    console.error("图片分析失败:", error);
    return {
      estimatedAge: "未知",
      gender: "未知",
      mood: "平静",
      clothingStyle: "未知",
      distinctiveFeatures: "无法识别",
      suggestedAction: "请热情接待客户。",
    };
  }
};

// ==========================================
// 2. 智能店长助理 (上下文对话)
// ==========================================
export const askServiceAssistant = async (
  question: string, 
  context: string
): Promise<string> => {
  
  const systemInstruction = `你并不是一个普通的聊天机器人，你是高端服务店 "Lumina Services" 的**智能店长助理**。
  你拥有查看店铺实时数据库的权限。你的任务是基于提供的数据快照，回答用户（店员/老板）关于店铺运营、客户情况、财务状况的问题。

  ### 你的核心能力：
  1. **数据查询**：准确回答“今天谁预约了？”、“谁是消费最高的客户？”等问题。
  2. **商业分析**：分析店铺运营健康度。
  3. **客户洞察**：提供接待建议。

  ### 实时数据库快照：
  ${context}

  ### 回复规则：
  1. 基于事实回答。2. 专业简洁。3. 始终使用中文。
  `;

  try {
    return await callAiBackend([
      { role: "system", content: systemInstruction },
      { role: "user", content: question }
    ]);
  } catch (error) {
    console.error("助手对话失败:", error);
    return "抱歉，AI 服务暂时不可用。";
  }
};

// ==========================================
// 3. 情感分析 (JSON输出)
// ==========================================
export const analyzeFeedbackSentiment = async (text: string) => {
  const prompt = `分析以下客户反馈。返回一个包含以下内容的 JSON 对象：
  1. sentiment: "positive" (积极), "neutral" (中性), 或 "negative" (消极)
  2. summary: 5-10个字的中文总结，概括关键点。
  
  反馈内容: "${text}"`;

  try {
    const content = await callAiBackend([{ role: "user", content: prompt }]);
    const jsonString = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("情感分析失败:", e);
    return { sentiment: 'neutral', summary: '无法分析' };
  }
};

// ==========================================
// 4. 营销短信生成 (个性化文案)
// ==========================================
export const generateMarketingMessage = async (customer: Customer): Promise<string> => {
  const prompt = `你是一位高端服务店的营销专家。请为以下客户撰写一条简短、温馨且极具吸引力的营销短信。
  
  客户资料：
  - 姓名: ${customer.name}
  - 会员等级: ${customer.tier}
  - 余额: $${customer.balance}
  - 最近消费: ${customer.history.length > 0 ? customer.history[0].service : '无'}
  - 标签/偏好: ${customer.tags.join(', ')}
  - 备注: ${customer.notes}
  
  要求：
  1. 语气亲切、尊贵。
  2. 根据客户偏好推荐服务。
  3. 提供专属限时优惠。
  4. 60字以内。
  5. 直接输出内容。`;

  try {
    return await callAiBackend([{ role: "user", content: prompt }]);
  } catch (e) {
    console.error("生成营销短信失败:", e);
    return `亲爱的${customer.name}，Lumina 诚邀您回店体验最新服务，享专属优惠！`;
  }
};