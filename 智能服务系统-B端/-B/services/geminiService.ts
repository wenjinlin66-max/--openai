import OpenAI from "openai";
import { AnalysisResult, Customer } from '../types';

// 1. 初始化 OpenAI 客户端 (用来连接老张 API)
// 注意：前端项目通常使用 import.meta.env，如果是 Next.js 服务端则用 process.env
const apiKey = import.meta.env.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const baseURL = import.meta.env.VITE_OPENAI_BASE_URL || process.env.VITE_OPENAI_BASE_URL;

if (!apiKey) {
  console.error("API Key is missing. Please check .env file.");
}
console.log("正在读取 Key:", import.meta.env.VITE_OPENAI_API_KEY);
console.log("正在读取 URL:", import.meta.env.VITE_OPENAI_BASE_URL);
const client = new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
  dangerouslyAllowBrowser: true // 允许在浏览器前端直接运行
});

// 定义模型名称，中转商通常支持 gemini-1.5-flash
const MODEL_NAME = "gemini-2.5-flash"; 

// ==========================================
// 1. 图片分析 (多模态)
// ==========================================
export const analyzeCustomerImage = async (base64Image: string): Promise<AnalysisResult> => {
  const prompt = `Analyze this image of a person entering a luxury service store. 
  Provide a JSON object with the following fields:
  - estimatedAge: string (e.g., "25-30岁")
  - gender: string (Return in Chinese)
  - mood: string (Return in Chinese)
  - clothingStyle: string (Return in Chinese)
  - distinctiveFeatures: string (Comma-separated visual features)
  - suggestedAction: string (High-EQ greeting suggestion)
  `;

  try {
    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                // OpenAI 格式要求必须带前缀
                url: base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      // 强制要求返回 JSON 格式
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (content) {
      return JSON.parse(content) as AnalysisResult;
    }
    throw new Error("Empty response");
  } catch (error) {
    console.error("Error analyzing image:", error);
    // 返回兜底数据，防止页面崩溃
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
  
  ### 实时数据库快照：
  ${context}

  ### 回复规则：
  1. 基于事实回答。
  2. 专业简洁，商务风格。
  3. 使用中文。
  `;

  try {
    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemInstruction }, // 系统设定放在这里
        { role: "user", content: question }
      ]
    });

    return response.choices[0].message.content || "AI 思考中...";
  } catch (error) {
    console.error("Error asking assistant:", error);
    return "抱歉，AI 服务暂时不可用，请检查网络或额度。";
  }
};

// ==========================================
// 3. 情感分析 (JSON输出)
// ==========================================
export const analyzeFeedbackSentiment = async (text: string) => {
  const prompt = `分析以下客户反馈。返回一个 JSON 对象，包含:
  1. sentiment: "positive", "neutral", 或 "negative"
  2. summary: 5-10个字的中文总结。
  
  反馈内容: "${text}"`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" } // 强制 JSON
    });

    const content = response.choices[0].message.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (e) {
    console.error(e);
    return { sentiment: 'neutral', summary: '无法分析' };
  }
};

// ==========================================
// 4. 营销短信生成 (文本生成)
// ==========================================
export const generateMarketingMessage = async (customer: Customer): Promise<string> => {
  const prompt = `你是一位高端服务店的营销专家。请为以下客户撰写一条简短、温馨的营销短信。
  
  客户资料：
  - 姓名: ${customer.name}
  - 会员等级: ${customer.tier}
  - 余额: $${customer.balance}
  - 最近消费: ${customer.history.length > 0 ? customer.history[0].service : '无'}
  
  要求：
  1. 语气尊贵，60字以内。
  2. 直接输出短信内容，不要加前缀。
  `;

  try {
    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }]
    });
    return response.choices[0].message.content || "无法生成内容。";
  } catch (e) {
    console.error(e);
    return `亲爱的${customer.name}，Lumina 诚邀您回店体验最新服务，享专属优惠！`;
  }
};