
import React, { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, Minus, Sparkles, PieChart, RefreshCcw, Star } from 'lucide-react';
import { fetchFeedbacks } from '../services/dataService';
import { FeedbackItem } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const FeedbackView: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);

  const loadFeedbacks = async () => {
    setLoading(true);
    const data = await fetchFeedbacks();
    setFeedbacks(data);
    setLoading(false);
  };

  useEffect(() => {
    loadFeedbacks();

    // 开启 Realtime 订阅
    if (isSupabaseConfigured()) {
      const channel = supabase.channel('public:feedbacks')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedbacks' }, (payload) => {
          // 注意：Realtime 推送的 payload 通常不包含 joined table 的数据
          // 简单起见，这里直接触发重新获取
          loadFeedbacks();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <ThumbsUp className="w-5 h-5 text-green-500" />;
      case 'negative': return <ThumbsDown className="w-5 h-5 text-red-500" />;
      default: return <Minus className="w-5 h-5 text-slate-400" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
     switch (sentiment) {
      case 'positive': return 'bg-green-50 border-green-100';
      case 'negative': return 'bg-red-50 border-red-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            className={`w-3.5 h-3.5 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} 
          />
        ))}
      </div>
    );
  };

  // 计算统计数据
  const stats = {
    positive: feedbacks.filter(f => f.sentiment === 'positive').length,
    neutral: feedbacks.filter(f => f.sentiment === 'neutral').length,
    negative: feedbacks.filter(f => f.sentiment === 'negative').length,
    total: feedbacks.length || 1
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold text-slate-800">客户反馈中心</h2>
           {isRealtime && <p className="text-xs text-green-600 flex items-center gap-1 mt-1"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span> 实时数据连接中</p>}
        </div>
        <button 
          onClick={loadFeedbacks}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新列表
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sentiment Overview */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 md:col-span-1 h-fit">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-600" />
            情感倾向概览
          </h3>
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">积极评价</span>
                <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: `${(stats.positive / stats.total) * 100}%` }}></div>
                </div>
                <span className="text-sm font-bold text-green-600">{Math.round((stats.positive / stats.total) * 100)}%</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">中性评价</span>
                <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-slate-400 h-full" style={{ width: `${(stats.neutral / stats.total) * 100}%` }}></div>
                </div>
                <span className="text-sm font-bold text-slate-500">{Math.round((stats.neutral / stats.total) * 100)}%</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">消极评价</span>
                <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-red-500 h-full" style={{ width: `${(stats.negative / stats.total) * 100}%` }}></div>
                </div>
                <span className="text-sm font-bold text-red-500">{Math.round((stats.negative / stats.total) * 100)}%</span>
             </div>
          </div>
        </div>

        {/* Feedback Stream */}
        <div className="md:col-span-2 space-y-4">
            {loading ? (
               <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-100">正在加载反馈数据...</div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-100">暂无反馈记录</div>
            ) : (
              feedbacks.map((item) => (
                <div key={item.id} className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md animate-slide-in-right ${getSentimentColor(item.sentiment)}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                                {getSentimentIcon(item.sentiment)}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                  {item.customerName}
                                  {renderStars(item.rating)}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                   <span>{item.date}</span>
                                   {item.serviceName && (
                                     <>
                                      <span>•</span>
                                      <span className="font-medium bg-white/60 px-1.5 rounded text-indigo-900/70 border border-indigo-100/50">
                                        项目: {item.serviceName}
                                      </span>
                                     </>
                                   )}
                                </div>
                            </div>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 bg-white rounded border border-slate-100 shadow-sm">
                            {item.sentiment === 'positive' ? '满意' : item.sentiment === 'negative' ? '不满意' : '一般'}
                        </span>
                    </div>
                    
                    <p className="text-slate-700 text-sm mb-3 pl-11">"{item.text}"</p>
                    
                    {item.aiSummary && (
                      <div className="pl-11 flex items-start gap-2">
                          <Sparkles className="w-3 h-3 text-indigo-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-indigo-600 font-medium bg-white/50 p-1.5 rounded">
                              AI 摘要: {item.aiSummary}
                          </p>
                      </div>
                    )}
                </div>
              ))
            )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackView;
