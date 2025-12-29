
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, User, Bot, Search } from 'lucide-react';
import { fetchCustomers, fetchChatMessages, sendAdminMessage } from '../services/dataService';
import { Customer, ChatMessage } from '../types';
import { supabase } from '../lib/supabaseClient';

const ChatCenter: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load customers with debounced search
  useEffect(() => {
    const loadCustomers = async () => {
      setLoadingList(true);
      // Load first 10 by default, or search results. 10 is enough for sidebar.
      const { data } = await fetchCustomers(1, 10, searchQuery);
      setCustomers(data);
      setLoadingList(false);
    };

    const timeoutId = setTimeout(() => {
      loadCustomers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Load messages when customer is selected
  useEffect(() => {
    if (!selectedCustomerId) return;

    const loadMsgs = async () => {
      const msgs = await fetchChatMessages(selectedCustomerId);
      setMessages(msgs);
    };
    loadMsgs();

    // Subscribe to new messages
    const channel = supabase.channel(`chat:${selectedCustomerId}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `customer_id=eq.${selectedCustomerId}` 
      }, (payload) => {
        const newMsg = payload.new as any;
        setMessages(prev => [...prev, {
          id: newMsg.id,
          customerId: newMsg.customer_id,
          sender: newMsg.sender,
          text: newMsg.text,
          createdAt: newMsg.created_at
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedCustomerId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!selectedCustomerId || !inputText.trim()) return;
    await sendAdminMessage(selectedCustomerId, inputText);
    setInputText('');
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Customer List Sidebar */}
      <div className="w-64 border-r border-slate-100 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-100">
           <h3 className="font-bold text-slate-700 mb-2">客户列表</h3>
           <div className="relative">
             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input 
               type="text" 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               placeholder="搜索客户..."
               className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
             />
           </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
             <div className="p-4 text-center text-slate-400 text-xs">加载中...</div>
          ) : customers.length === 0 ? (
             <div className="p-4 text-center text-slate-400 text-xs">未找到客户</div>
          ) : (
            customers.map(c => (
              <div 
                key={c.id}
                onClick={() => setSelectedCustomerId(c.id)}
                className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-white transition-colors ${selectedCustomerId === c.id ? 'bg-white border-l-4 border-indigo-600 shadow-sm' : 'border-l-4 border-transparent'}`}
              >
                <img src={c.avatarUrl} className="w-8 h-8 rounded-full bg-slate-200" />
                <div className="overflow-hidden">
                  <div className="font-bold text-sm text-slate-800 truncate">{c.name}</div>
                  <div className="text-xs text-slate-500 truncate">{c.tier}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedCustomerId ? (
          <>
             <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">
                  与 {customers.find(c => c.id === selectedCustomerId)?.name} 的对话
                </h3>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30" ref={scrollRef}>
                {messages.length === 0 && <div className="text-center text-slate-400 mt-10">暂无消息记录</div>}
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[70%] p-3 rounded-xl text-sm ${
                       msg.sender === 'admin' ? 'bg-indigo-600 text-white rounded-tr-none' : 
                       msg.sender === 'bot' ? 'bg-slate-200 text-slate-600 rounded-tl-none border border-slate-300' :
                       'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                     }`}>
                       {msg.sender === 'bot' && <span className="text-[10px] font-bold text-slate-500 block mb-1">AI 助手</span>}
                       {msg.text}
                     </div>
                  </div>
                ))}
             </div>

             <div className="p-4 border-t border-slate-100 bg-white flex gap-2">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="输入回复内容..."
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
                />
                <button onClick={handleSend} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700">
                   <Send className="w-5 h-5" />
                </button>
             </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
             <MessageSquare className="w-16 h-16 mb-4" />
             <p>请选择左侧客户开始对话</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatCenter;
