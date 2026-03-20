import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeHelp,
  CheckCheck,
  MessageSquare,
  RefreshCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Minus,
  PieChart,
} from 'lucide-react';
import { fetchFeedbacks, updateFeedbackHandling } from '../services/dataService';
import { FeedbackItem } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

type FeedbackFilter = 'all' | 'review' | 'afterSales';
type RequestStatus = 'pending' | 'processing' | 'resolved' | 'rejected';

const FILTER_OPTIONS: { key: FeedbackFilter; label: string }[] = [
  { key: 'all', label: '全部记录' },
  { key: 'review', label: '服务评价' },
  { key: 'afterSales', label: '售后工单' },
];

const STATUS_OPTIONS: { key: RequestStatus; label: string }[] = [
  { key: 'pending', label: '待受理' },
  { key: 'processing', label: '处理中' },
  { key: 'resolved', label: '已回访' },
  { key: 'rejected', label: '已驳回' },
];

const SENTIMENT_ROWS: Array<{
  label: string;
  barClass: string;
  textClass: string;
  key: 'positive' | 'neutral' | 'negative';
}> = [
  { label: '积极评价', key: 'positive', barClass: 'bg-green-500', textClass: 'text-green-600' },
  { label: '中性评价', key: 'neutral', barClass: 'bg-slate-400', textClass: 'text-slate-500' },
  { label: '消极评价', key: 'negative', barClass: 'bg-red-500', textClass: 'text-red-500' },
];

const FeedbackView: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FeedbackFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<RequestStatus>('pending');
  const [draftNote, setDraftNote] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadFeedbacks = async () => {
    setLoading(true);
    const data = await fetchFeedbacks();
    setFeedbacks(data);
    setLoading(false);
  };

  useEffect(() => {
    loadFeedbacks();

    if (isSupabaseConfigured()) {
      setIsRealtime(true);
      const channel = supabase
        .channel('public:feedbacks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feedbacks' }, () => {
          loadFeedbacks();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const filteredFeedbacks = useMemo(() => {
    if (activeFilter === 'review') return feedbacks.filter((item) => item.feedbackType === 'review');
    if (activeFilter === 'afterSales') return feedbacks.filter((item) => item.feedbackType !== 'review');
    return feedbacks;
  }, [activeFilter, feedbacks]);

  const sentimentStats = {
    positive: feedbacks.filter((item) => item.sentiment === 'positive').length,
    neutral: feedbacks.filter((item) => item.sentiment === 'neutral').length,
    negative: feedbacks.filter((item) => item.sentiment === 'negative').length,
    total: feedbacks.length || 1,
  };

  const afterSalesStats = {
    total: feedbacks.filter((item) => item.feedbackType !== 'review').length,
    pending: feedbacks.filter((item) => item.requestStatus === 'pending').length,
    processing: feedbacks.filter((item) => item.requestStatus === 'processing').length,
    resolved: feedbacks.filter((item) => item.requestStatus === 'resolved').length,
  };

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

  const getFeedbackTypeLabel = (item: FeedbackItem) => {
    if (item.feedbackType === 'complaint') return '投诉';
    if (item.feedbackType === 'appeal') return '申诉';
    if (item.feedbackType === 'after_sales') return '售后咨询';
    return '服务评价';
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'processing': return 'bg-blue-50 text-blue-600';
      case 'resolved': return 'bg-emerald-50 text-emerald-600';
      case 'rejected': return 'bg-rose-50 text-rose-500';
      default: return 'bg-amber-50 text-amber-600';
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} className={`w-3.5 h-3.5 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
        ))}
      </div>
    );
  };

  const startEditing = (item: FeedbackItem) => {
    setEditingId(item.id);
    setDraftStatus((item.requestStatus || 'pending') as RequestStatus);
    setDraftNote(item.handlingNote || '');
  };

  const saveHandling = async (feedbackId: string) => {
    setSavingId(feedbackId);
    const success = await updateFeedbackHandling(feedbackId, draftStatus, draftNote);
    setSavingId(null);
    if (!success) {
      alert('保存售后处理失败，请稍后重试。');
      return;
    }
    setEditingId(null);
    await loadFeedbacks();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">客户反馈中心</h2>
          {isRealtime && (
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              实时数据连接中
            </p>
          )}
        </div>
        <button onClick={loadFeedbacks} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />刷新列表
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setActiveFilter(option.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${activeFilter === option.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 md:col-span-1 h-fit space-y-6">
          <div>
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChart className="w-5 h-5 text-indigo-600" />情感倾向概览</h3>
            <div className="space-y-4">
              {SENTIMENT_ROWS.map(({ label, key, barClass, textClass }) => {
                const count = sentimentStats[key];
                return (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{label}</span>
                    <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden"><div className={`${barClass} h-full`} style={{ width: `${(count / sentimentStats.total) * 100}%` }}></div></div>
                    <span className={`text-sm font-bold ${textClass}`}>{Math.round((count / sentimentStats.total) * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-rose-500" />售后处理概览</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"><div className="text-xs text-slate-400">售后总数</div><div className="mt-1 text-lg font-bold text-slate-800">{afterSalesStats.total}</div></div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3"><div className="text-xs text-amber-500">待受理</div><div className="mt-1 text-lg font-bold text-amber-700">{afterSalesStats.pending}</div></div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3"><div className="text-xs text-blue-500">处理中</div><div className="mt-1 text-lg font-bold text-blue-700">{afterSalesStats.processing}</div></div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3"><div className="text-xs text-emerald-500">已回访</div><div className="mt-1 text-lg font-bold text-emerald-700">{afterSalesStats.resolved}</div></div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-100">正在加载反馈数据...</div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-100">当前分类下暂无记录</div>
          ) : (
            filteredFeedbacks.map((item) => {
              const isAfterSales = item.feedbackType !== 'review';
              const isEditing = editingId === item.id;
              return (
                <div key={item.id} className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md animate-slide-in-right ${getSentimentColor(item.sentiment)}`}>
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                        {isAfterSales ? <BadgeHelp className="w-4 h-4 text-indigo-600" /> : getSentimentIcon(item.sentiment)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                          {item.customerName}
                          {renderStars(item.rating)}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-slate-100 text-slate-600">{getFeedbackTypeLabel(item)}</span>
                          {item.statusLabel && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusClass(item.requestStatus)}`}>{item.statusLabel}</span>}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                          <span>{item.date}</span>
                          {item.serviceName && <><span>•</span><span className="font-medium bg-white/60 px-1.5 rounded text-indigo-900/70 border border-indigo-100/50">项目: {item.serviceName}</span></>}
                          {item.handledAt && <><span>•</span><span>处理时间：{new Date(item.handledAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-1 bg-white rounded border border-slate-100 shadow-sm whitespace-nowrap">
                        {item.sentiment === 'positive' ? '满意' : item.sentiment === 'negative' ? '不满意' : '一般'}
                      </span>
                      {isAfterSales && (
                        <button type="button" onClick={() => startEditing(item)} className="inline-flex items-center rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                          <CheckCheck size={13} className="mr-1" />处理工单
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-700 text-sm mb-3 pl-11 break-words">“{item.text}”</p>

                  {item.aiSummary && (
                    <div className="pl-11 flex items-start gap-2 mb-3">
                      <Sparkles className="w-3 h-3 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-indigo-600 font-medium bg-white/50 p-1.5 rounded">AI 摘要: {item.aiSummary}</p>
                    </div>
                  )}

                  {item.handlingNote && !isEditing && (
                    <div className="pl-11">
                      <div className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-slate-600 border border-slate-100">处理备注：{item.handlingNote}</div>
                    </div>
                  )}

                  {isAfterSales && isEditing && (
                    <div className="mt-4 pl-11 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setDraftStatus(option.key)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${draftStatus === option.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={draftNote}
                        onChange={(event) => setDraftNote(event.target.value)}
                        placeholder="填写售后处理备注，例如已电话回访、已退款说明、已预约补救服务等..."
                        className="w-full h-28 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-300"
                      />
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">取消</button>
                        <button
                          type="button"
                          onClick={() => saveHandling(item.id)}
                          disabled={savingId === item.id}
                          className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {savingId === item.id ? <RefreshCcw size={14} className="mr-2 animate-spin" /> : <Send size={14} className="mr-2" />}保存处理
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackView;
