import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { askServiceAssistant } from '../services/geminiService';
import { getBusinessContextForAI } from '../services/dataService'; // Import RAG function
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

const ServiceAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      sender: 'bot',
      text: "您好！我是您的智能店长助理。我可以实时查询店铺数据。您可以问我：\n- **“今天有哪些预约？”**\n- **“谁是消费最高的 VIP？”**\n- **“最近收到了什么差评？”**",
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
        // 1. 获取最新业务数据快照 (Parallel fetch inside)
        const dbContext = await getBusinessContextForAI();
        
        // 2. 发送给 Gemini
        const responseText = await askServiceAssistant(userMsg.text, dbContext);

        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: responseText,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, botMsg]);
    } catch (e) {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: "抱歉，系统连接出现问题。",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
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

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">AI 店长助理 (Data-Aware)</h2>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span> 数据库已实时连接
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/30">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1
                ${msg.sender === 'user' ? 'bg-slate-200' : 'bg-indigo-600'}`}>
                {msg.sender === 'user' ? <User className="w-5 h-5 text-slate-600" /> : <Bot className="w-5 h-5 text-white" />}
              </div>

              <div className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm
                ${msg.sender === 'user' 
                  ? 'bg-white text-slate-800 rounded-tr-none border border-slate-100' 
                  : 'bg-indigo-600 text-white rounded-tl-none'
                }`}>
                {msg.sender === 'bot' ? (
                   <div className="prose prose-invert prose-sm max-w-none">
                     <ReactMarkdown>{msg.text}</ReactMarkdown>
                   </div>
                ) : (
                  msg.text
                )}
                <div className={`text-[10px] mt-1 opacity-70 ${msg.sender === 'bot' ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-pulse">
             <div className="flex gap-3 max-w-[80%]">
               <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center mt-1">
                 <Bot className="w-5 h-5 text-white" />
               </div>
               <div className="bg-indigo-600 p-3 rounded-2xl rounded-tl-none">
                 <div className="flex gap-1">
                   <span className="w-2 h-2 bg-white rounded-full opacity-75 animate-bounce"></span>
                   <span className="w-2 h-2 bg-white rounded-full opacity-75 animate-bounce delay-75"></span>
                   <span className="w-2 h-2 bg-white rounded-full opacity-75 animate-bounce delay-150"></span>
                 </div>
               </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题，例如：“今天预约情况如何？”"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-14 text-sm text-slate-700"
          />
          <button 
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
           {['今天有多少预约?', '最近的差评是什么?', '目前营收状况如何?', '谁是VVIP?'].map(hint => (
             <button 
               key={hint}
               onClick={() => setInputText(hint)}
               className="whitespace-nowrap px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full transition-colors border border-slate-200"
             >
               {hint}
             </button>
           ))}
        </div>
      </div>
    </div>
  );
};

export default ServiceAssistant;