import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2 } from 'lucide-react';
import { askServiceAssistant } from '../services/geminiService';
import { getBusinessContextForAI } from '../services/dataService';
import { supabase } from '../lib/supabaseClient'; // 👈 确保这个路径正确
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

const ServiceAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. 初始化：从数据库加载历史记录
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('assistant_chat_messages')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const formattedMessages: Message[] = data.map(m => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
            timestamp: new Date(m.created_at)
          }));
          setMessages(formattedMessages);
        } else {
          // 如果数据库没数据，显示欢迎语
          setMessages([{
            id: 'welcome',
            sender: 'bot',
            text: "您好！我是您的智能店长助理。您可以问我关于店铺数据的问题。",
            timestamp: new Date()
          }]);
        }
      } catch (e) {
        console.error("加载历史记录失败:", e);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 2. 清空记录
  const clearChatHistory = async () => {
    if (!window.confirm("确定要清空所有聊天记录吗？")) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from('assistant_chat_messages').delete().eq('user_id', user.id);
      setMessages([{
        id: Date.now().toString(),
        sender: 'bot',
        text: "记录已清空。请问有什么我可以帮您的？",
        timestamp: new Date()
      }]);
    } catch (e) {
      console.error("清空失败:", e);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("请先登录");
        return;
    }

    const userText = inputText;
    setInputText('');
    
    // UI 立即反馈
    const userMsgLocal: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsgLocal]);
    setIsTyping(true);

    try {
        // A. 持久化用户消息到数据库
        await supabase.from('assistant_chat_messages').insert({
          user_id: user.id,
          sender: 'user',
          text: userText
        });

        // B. 获取业务上下文
        const dbContext = await getBusinessContextForAI();
        
        // C. 格式化历史记录给 AI (只转成 AI 认识的 role/content 格式)
       const historyForAI = messages.map(m => ({
  role: m.sender === 'user' ? 'user' : 'assistant',
  content: m.text
})) as { role: 'user' | 'assistant'; content: string }[];
        // 加上当前这一条
        historyForAI.push({ role: 'user', content: userText });

        // D. 调用 AI
        const responseText = await askServiceAssistant(historyForAI, dbContext);

        // E. 持久化 AI 回复到数据库
        const { data: savedBotMsg, error } = await supabase.from('assistant_chat_messages').insert({
          user_id: user.id,
          sender: 'bot',
          text: responseText
        }).select().single();

        if (savedBotMsg) {
          setMessages(prev => [...prev, {
            id: savedBotMsg.id,
            sender: 'bot',
            text: responseText,
            timestamp: new Date()
          }]);
        }
    } catch (e) {
        setMessages(prev => [...prev, {
          id: 'error-' + Date.now(),
          sender: 'bot',
          text: "抱歉，由于网络波动，我暂时无法回答。数据已保存，请刷新重试。",
          timestamp: new Date(),
        }]);
    } finally {
        setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isInitialLoading) {
    return <div className="flex items-center justify-center h-full text-slate-400 text-sm">正在加载历史记录...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center border border-blue-200">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">AI 店长助理</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> 数据库已连接
            </p>
          </div>
        </div>
        <button 
          onClick={clearChatHistory}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="清空记录"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 border
                ${msg.sender === 'user' ? 'bg-white border-slate-200' : 'bg-blue-600 border-blue-600'}`}>
                {msg.sender === 'user' ? <User className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={`p-3.5 rounded-lg text-sm leading-relaxed shadow-sm
                ${msg.sender === 'user' ? 'bg-white text-slate-800 border border-slate-200' : 'bg-blue-600 text-white border-blue-600'}`}>
                {msg.sender === 'bot' ? (
                   <div className="prose prose-invert prose-sm max-w-none">
                     <ReactMarkdown>{msg.text}</ReactMarkdown>
                   </div>
                ) : msg.text}
                <div className={`text-[10px] mt-1 opacity-70 text-right ${msg.sender === 'bot' ? 'text-blue-100' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-pulse">
             <div className="flex gap-3 max-w-[80%]">
               <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mt-1">
                 <Bot className="w-4 h-4 text-white" />
               </div>
               <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                 <div className="flex gap-1"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span></div>
               </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 h-12 text-sm resize-none"
          />
          <button 
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceAssistant;