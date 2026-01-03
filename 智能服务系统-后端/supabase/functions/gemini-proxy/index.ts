// 1. 使用 @ts-ignore 忽略 URL 导入报错
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// 2. 手动声明 Deno 全局变量，消除“找不到名称 Deno”的报错
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 3. 为 req 显式指定 Request 类型
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    const baseURL = Deno.env.get('OPENAI_BASE_URL') || "https://api.laozhang.ai/v1"

    if (!apiKey) {
      throw new Error("云端配置缺失：请设置 OPENAI_API_KEY");
    }

    const { messages, model = "gemini-2.5-flash" } = await req.json()

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
      }),
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})