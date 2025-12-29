import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Customer, ChatMessage } from '../types';
import { getChatResponse } from '../services/geminiService';

interface ChatPageProps {
  user: Customer;
  onBack: () => void;
}

const ChatPage: React.FC<ChatPageProps> = ({ user, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial Load & Realtime Subscription
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: true });
      
      if (data) setMessages(data);
    };

    fetchMessages();

    const channel = supabase
      .channel('chat-room')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            // Prevent duplicate if we optimistically added it (though IDs usually differ if optimistic has temp ID)
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput('');
    setSending(true);

    try {
      // 1. Save User Message
      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          customer_id: user.id,
          sender: 'user',
          text: userText
        });

      if (userMsgError) throw userMsgError;

      // 2. Check for "Human" keyword
      if (userText.includes('人工')) {
         // Insert system notice, but don't call AI
         // We just wait for admin (via realtime)
         // Optionally insert a bot message saying "Waiting for human"
         await supabase.from('chat_messages').insert({
            customer_id: user.id,
            sender: 'bot',
            text: '已为您转接人工客服，请稍候...'
         });
      } else {
         // 3. Call AI
         const aiReply = await getChatResponse(userText);
         
         // 4. Save Bot Message
         await supabase.from('chat_messages').insert({
            customer_id: user.id,
            sender: 'bot',
            text: aiReply
         });
      }

    } catch (err) {
      console.error('Chat Error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Header */}
      <div className="px-4 py-3 bg-white shadow-sm flex items-center sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
        </button>
        <div className="ml-2">
            <h1 className="text-lg font-bold text-slate-900">智能客服</h1>
            <div className="flex items-center text-xs text-green-500">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                在线中
            </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
            <div className="text-center text-gray-400 text-xs mt-10">
                <p>您可以询问服务项目、价格或要求人工服务。</p>
            </div>
        )}
        
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isAdmin = msg.sender === 'admin';
          
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 text-white shadow-sm ${isAdmin ? 'bg-indigo-600' : 'bg-blue-500'}`}>
                  {isAdmin ? <User size={14} /> : <Bot size={16} />}
                </div>
              )}
              
              <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${
                isUser 
                  ? 'bg-slate-900 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 rounded-tl-none border border-gray-100'
              }`}>
                {msg.text}
              </div>

              {isUser && (
                 <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ml-2 overflow-hidden shadow-sm">
                    {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover"/> : <User size={16} className="text-gray-500"/>}
                 </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-200 pb-safe-area">
        <form onSubmit={handleSend} className="flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入消息..."
              className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
            />
            <button 
                type="submit" 
                disabled={sending || !input.trim()}
                className="p-2.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:scale-95 transition-all shadow-md"
            >
                {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;