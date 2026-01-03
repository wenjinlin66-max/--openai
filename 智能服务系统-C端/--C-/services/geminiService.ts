export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

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
export const getChatResponse = async (userMessage: string): Promise<string> => {
  try {
    const systemPrompt = "你是一个高端服务会所的智能客服。请用礼貌、专业、热情的语气回答用户问题。你的回答应该简短（50字以内）。如果用户要求人工服务、投诉或遇到你无法回答的问题，请回复'已为您转接人工服务，请稍候...'。";

    return await callAiBackend([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ]);

  } catch (error) {
    console.error("智能客服响应失败:", error);
    return "系统繁忙，请稍后再试。";
  }
};