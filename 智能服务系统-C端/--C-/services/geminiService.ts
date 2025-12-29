import OpenAI from "openai";

// 1. 初始化客户端 (使用中转配置)
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const baseURL = import.meta.env.VITE_OPENAI_BASE_URL;

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
  dangerouslyAllowBrowser: true // 允许前端直接调用
});

// 2. 模型选择 (建议用最新的 Flash)
const MODEL_ID = 'gemini-2.5-flash';

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

// ==========================================
// 1. 情感分析 (JSON 模式)
// ==========================================
export const analyzeSentiment = async (text: string): Promise<SentimentResult> => {
  if (!apiKey) {
    console.warn("API Key 缺失，跳过 AI 分析。");
    return { sentiment: 'neutral', confidence: 0 };
  }

  try {
    const prompt = `Analyze the sentiment of the following customer feedback. 
    Return a JSON object with "sentiment" (positive, neutral, negative) and "confidence" (0-1).
    Feedback text: "${text}"`;

    const response = await client.chat.completions.create({
      model: MODEL_ID,
      messages: [{ role: "user", content: prompt }],
      // 强制让 AI 返回 JSON 格式
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (content) {
      return JSON.parse(content) as SentimentResult;
    }
    return { sentiment: 'neutral', confidence: 0 };
    
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return { sentiment: 'neutral', confidence: 0 };
  }
};

// ==========================================
// 2. 智能客服对话 (带人设)
// ==========================================
export const getChatResponse = async (userMessage: string): Promise<string> => {
  if (!apiKey) return "系统暂时无法连接到 AI，请稍后再试。";

  try {
    const systemPrompt = "你是一个高端服务会所的智能客服。请用礼貌、专业、热情的语气回答用户问题。你的回答应该简短（50字以内）。如果用户要求人工服务、投诉或遇到你无法回答的问题，请回复'已为您转接人工服务，请稍候...'。";

    const response = await client.chat.completions.create({
      model: MODEL_ID,
      messages: [
        { role: "system", content: systemPrompt }, // 人设放在这里
        { role: "user", content: userMessage }
      ]
    });

    return response.choices[0].message.content || "抱歉，我没有听清，请再说一遍。";
  } catch (error) {
    console.error("Error generating chat response:", error);
    return "系统繁忙，请稍后再试。";
  }
};