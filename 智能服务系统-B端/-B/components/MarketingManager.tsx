
import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Calendar, Tag, Trash2, PlayCircle, StopCircle, Loader2, RefreshCw, LayoutTemplate, MessageSquare, Clock, AlertTriangle, X, Users, MousePointer2 } from 'lucide-react';
import { fetchCampaigns, createCampaign, updateCampaignStatus, deleteCampaign } from '../services/dataService';
import { Campaign, CustomerTier } from '../types';
import { supabase } from '../lib/supabaseClient';

const MarketingManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'draft' | 'ended'>('all');
  
  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{show: boolean, id: string | null}>({ show: false, id: null });

  const getTodayString = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const getFutureDateString = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'promotion',
    startDate: getTodayString(),
    endDate: getFutureDateString(7),
    targetAudience: ['all'] as string[]
  });

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const data = await fetchCampaigns();
      setCampaigns(data);
    } catch (error) {
      console.error("Failed to load campaigns", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
    const channel = supabase.channel('public:campaigns')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
        loadCampaigns();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleAudience = (tier: string) => {
    let newAudience = [...form.targetAudience];
    
    if (tier === 'all') {
      newAudience = ['all'];
    } else {
      // Remove 'all' if selecting specific tier
      if (newAudience.includes('all')) {
        newAudience = newAudience.filter(t => t !== 'all');
      }
      
      if (newAudience.includes(tier)) {
        newAudience = newAudience.filter(t => t !== tier);
      } else {
        newAudience.push(tier);
      }

      // If nothing selected, default to all? or enforce logic. Let's make it easy: empty = all.
      // Or safer: if empty after toggle, set to all.
      if (newAudience.length === 0) {
        newAudience = ['all'];
      }
    }
    setForm({ ...form, targetAudience: newAudience });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const startDate = new Date(form.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(form.endDate);
    endDate.setHours(23, 59, 59, 999);

    const payload = {
      ...form,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: 'active' // Force active status
    };

    const success = await createCampaign(payload as any);
    setIsSubmitting(false);
    if (success) {
      setShowCreateModal(false);
      setForm({
        title: '',
        description: '',
        type: 'promotion',
        startDate: getTodayString(),
        endDate: getFutureDateString(7),
        targetAudience: ['all']
      });
      loadCampaigns();
    } else {
      alert('创建失败，请重试');
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'active' | 'ended') => {
    await updateCampaignStatus(id, newStatus);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  const handleDeleteClick = (id: string) => {
    setDeleteModal({ show: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    const success = await deleteCampaign(deleteModal.id);
    if (success) {
      setCampaigns(prev => prev.filter(c => c.id !== deleteModal.id));
    } else {
      alert("删除失败，请检查数据库权限。");
    }
    setDeleteModal({ show: false, id: null });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (activeTab === 'all') return true;
    return c.status === activeTab;
  });

  const getCardColor = (type: string) => {
    switch (type) {
      case 'promotion': return 'border-t-orange-500';
      case 'event': return 'border-t-purple-500';
      case 'announcement': return 'border-t-blue-500';
      default: return 'border-t-slate-200';
    }
  };

  const getPlaceholder = () => {
    if (form.type === 'announcement') return "例如：系统将于今晚进行维护，请提前安排。注意：此内容将以【全屏弹窗】形式展示给用户。";
    if (form.type === 'promotion') return "例如：双11限时特惠，充值1000送200！";
    return "请输入活动具体内容...";
  };

  const getAudienceLabel = (audience: string[]) => {
    if (!audience || audience.includes('all')) return '全部客户';
    return audience.join(', ');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 w-full md:w-auto">
           <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
             <Sparkles className="w-6 h-6" />
           </div>
           <div>
             <h3 className="text-lg font-bold text-slate-900">营销活动中心</h3>
             <p className="text-xs text-slate-500 mt-0.5">管理 C 端小程序的 Banner、弹窗和通知推送</p>
           </div>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={loadCampaigns} className="px-3 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95"
          >
             <Plus className="w-5 h-5" /> 发布新活动
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['all', 'active', 'draft', 'ended'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab === 'all' ? '全部' : tab === 'active' ? '进行中' : tab === 'draft' ? '草稿箱' : '已结束'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
         {loading && campaigns.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
               <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600" />
               <p>正在加载活动数据...</p>
            </div>
         ) : campaigns.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                  <Sparkles className="w-10 h-10 text-slate-300" />
               </div>
               <h4 className="text-lg font-bold text-slate-700 mb-2">暂无营销活动</h4>
               <p className="max-w-xs text-center text-sm text-slate-500 mb-6">创建一个新活动来吸引客户。</p>
               <button onClick={() => setShowCreateModal(true)} className="text-indigo-600 font-bold text-sm hover:underline">立即创建</button>
            </div>
         ) : (
            <div className="overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCampaigns.map(campaign => {
                  const daysLeft = getDaysRemaining(campaign.endDate);
                  return (
                    <div key={campaign.id} className={`flex flex-col bg-white border border-slate-200 border-t-4 rounded-2xl hover:shadow-lg transition-all duration-300 group h-full ${getCardColor(campaign.type)}`}>
                        <div className="p-5 border-b border-slate-50 flex-1 relative">
                            <div className="flex justify-between items-start mb-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${
                                  campaign.type === 'promotion' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  campaign.type === 'event' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {campaign.type === 'promotion' ? '促销 Banner' : campaign.type === 'event' ? '线下活动' : '系统公告'}
                                </span>
                                {campaign.status === 'active' && (
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 进行中
                                  </span>
                                )}
                                {campaign.status === 'draft' && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">草稿</span>}
                                {campaign.status === 'ended' && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">已结束</span>}
                            </div>
                            
                            <h4 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{campaign.title}</h4>
                            <p className="text-sm text-slate-500 line-clamp-3 h-[60px] leading-relaxed">{campaign.description}</p>
                            
                            {campaign.status === 'active' && (
                              <div className={`mt-3 text-xs font-bold flex items-center gap-1 ${daysLeft <= 3 ? 'text-red-500' : 'text-slate-400'}`}>
                                <Clock className="w-3 h-3" /> 
                                {daysLeft > 0 ? `剩余 ${daysLeft} 天` : '即将结束'}
                              </div>
                            )}
                            
                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                               <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                 <Users className="w-3 h-3 text-indigo-500" />
                                 <span className="truncate max-w-[100px]">{getAudienceLabel(campaign.targetAudience)}</span>
                               </div>
                               <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                 <MousePointer2 className="w-3 h-3 text-indigo-500" />
                                 <span>{campaign.clicks} 点击</span>
                               </div>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-slate-50/50 rounded-b-2xl">
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                                <Calendar className="w-3 h-3 text-indigo-500" />
                                <span>{new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}</span>
                            </div>

                            <div className="flex gap-2">
                                {campaign.status === 'draft' && (
                                  <button onClick={() => handleStatusChange(campaign.id, 'active')} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1.5 shadow-sm transition-colors">
                                      <PlayCircle className="w-3.5 h-3.5" /> 发布
                                  </button>
                                )}
                                {campaign.status === 'active' && (
                                  <button onClick={() => handleStatusChange(campaign.id, 'ended')} className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center gap-1.5 transition-colors">
                                      <StopCircle className="w-3.5 h-3.5" /> 结束
                                  </button>
                                )}
                                <button onClick={() => handleDeleteClick(campaign.id)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            </div>
         )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm overflow-hidden animate-zoom-in">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">删除此活动?</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                此操作将永久删除该营销活动，所有已推送的 Banner 和弹窗也将失效。
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteModal({ show: false, id: null })}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden animate-zoom-in">
              <div className="w-full md:w-3/5 p-8 flex flex-col h-full overflow-y-auto border-r border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-bold text-2xl text-slate-900">发布新活动</h3>
                      <p className="text-slate-500 text-sm">填写内容，右侧可实时预览 C 端效果。</p>
                    </div>
                    <button onClick={() => setShowCreateModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-600" /></button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">活动类型</label>
                        <div className="grid grid-cols-3 gap-3">
                           {[
                             { id: 'promotion', label: '促销 Banner', icon: LayoutTemplate },
                             { id: 'announcement', label: '弹窗公告', icon: MessageSquare },
                             { id: 'event', label: '线下活动', icon: Calendar }
                           ].map(t => (
                             <div 
                               key={t.id}
                               onClick={() => setForm({...form, type: t.id})}
                               className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${form.type === t.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-indigo-200 text-slate-600'}`}
                             >
                                <t.icon className={`w-5 h-5 ${form.type === t.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span className="text-xs font-bold">{t.label}</span>
                             </div>
                           ))}
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">受众群体 (精准推送)</label>
                        <div className="flex flex-wrap gap-2">
                           <button type="button" onClick={() => toggleAudience('all')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${form.targetAudience.includes('all') ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                             全部客户
                           </button>
                           {Object.values(CustomerTier).map(tier => (
                              <button key={tier} type="button" onClick={() => toggleAudience(tier)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${form.targetAudience.includes(tier) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                {tier}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">活动标题</label>
                        <input required type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-900" placeholder="例如：夏季狂欢节" />
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">活动详情</label>
                        <textarea required rows={5} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-900" placeholder={getPlaceholder()} />
                     </div>

                     <div className="grid grid-cols-2 gap-5">
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">开始日期 (上线)</label>
                           <input required type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-900" />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">结束日期 (下线)</label>
                           <input required type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-900" />
                        </div>
                     </div>
                     
                     <div className="pt-4 mt-auto">
                        <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-transform active:scale-[0.98]">
                           {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '确认发布活动'}
                        </button>
                        <p className="text-[10px] text-slate-400 text-center mt-2">活动将在开始日期的 00:00 生效，于结束日期的 23:59 自动下线。</p>
                     </div>
                  </form>
              </div>

              {/* Right: Preview */}
              <div className="w-full md:w-2/5 bg-slate-50 p-8 flex flex-col items-center justify-center border-l border-slate-200 relative hidden md:flex">
                  <div className="absolute top-6 text-xs font-bold text-slate-400 uppercase tracking-widest">C 端实时预览</div>
                  
                  <div className="w-[280px] h-[580px] bg-white rounded-[3rem] border-8 border-slate-900 shadow-2xl relative overflow-hidden flex flex-col">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-xl z-20"></div>
                      <div className="h-10 bg-white w-full flex justify-between items-center px-6 pt-2 text-[10px] font-bold text-slate-800 z-10">
                         <span>9:41</span>
                         <div className="flex gap-1">
                           <div className="w-3 h-3 bg-slate-800 rounded-full opacity-20"></div>
                           <div className="w-3 h-3 bg-slate-800 rounded-full opacity-20"></div>
                         </div>
                      </div>
                      <div className="flex-1 bg-slate-50 relative overflow-y-auto no-scrollbar">
                         <div className="p-4 flex justify-between items-center bg-white">
                            <div className="w-8 h-8 bg-indigo-100 rounded-full"></div>
                            <div className="font-bold text-sm">CRIMS</div>
                            <div className="w-6 h-6 bg-slate-100 rounded-full"></div>
                         </div>
                         
                         {/* Audience Tag for Preview */}
                         <div className="px-4 pt-2 pb-0">
                           <span className="inline-block px-2 py-0.5 bg-slate-800 text-white text-[9px] rounded-md font-bold opacity-80">
                             预览模式: {form.targetAudience.includes('all') ? '所有用户可见' : `仅 ${form.targetAudience.length} 类会员可见`}
                           </span>
                         </div>

                         <div className="p-4 space-y-3 opacity-50 pointer-events-none">
                            <div className="h-32 bg-slate-200 rounded-xl w-full"></div>
                            <div className="flex gap-2">
                               <div className="h-20 bg-slate-200 rounded-xl w-1/2"></div>
                               <div className="h-20 bg-slate-200 rounded-xl w-1/2"></div>
                            </div>
                         </div>

                         {form.type === 'promotion' ? (
                            <div className="mx-4 h-32 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl shadow-lg p-4 text-white flex flex-col justify-center relative overflow-hidden animate-slide-in-right">
                               <div className="relative z-10">
                                  <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded uppercase">限时促销</span>
                                  <h4 className="font-bold text-lg leading-tight mt-1">{form.title || '活动标题'}</h4>
                                  <p className="text-[10px] opacity-90 mt-1 line-clamp-2">{form.description || '活动描述内容...'}</p>
                               </div>
                               <div className="absolute right-[-10px] bottom-[-10px] opacity-20">
                                  <Tag className="w-24 h-24" />
                               </div>
                            </div>
                         ) : form.type === 'announcement' ? (
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-6 z-30">
                               <div className="bg-white rounded-2xl p-5 shadow-2xl w-full animate-zoom-in">
                                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                                     <MessageSquare className="w-5 h-5 text-indigo-600" />
                                  </div>
                                  <h4 className="font-bold text-slate-900 text-base">{form.title || '公告标题'}</h4>
                                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{form.description || '例如：因系统维护，本店将于 12月1日 暂停营业一天，给您带来不便敬请谅解。'}</p>
                                  <button className="w-full mt-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">我知道了</button>
                               </div>
                            </div>
                         ) : (
                            <div className="mx-4 mt-2 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex gap-3 animate-slide-up">
                               <div className="w-16 h-16 bg-purple-100 rounded-lg flex-shrink-0 flex flex-col items-center justify-center text-purple-600">
                                  <span className="text-[10px] font-bold">NOV</span>
                                  <span className="text-xl font-bold">25</span>
                               </div>
                               <div>
                                  <h4 className="font-bold text-sm text-slate-800">{form.title || '活动名称'}</h4>
                                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{form.description || '线下活动详情...'}</p>
                               </div>
                            </div>
                         )}
                      </div>
                      <div className="h-14 bg-white border-t border-slate-100 flex justify-around items-center px-4">
                         <div className="w-6 h-6 bg-indigo-600 rounded-full opacity-80"></div>
                         <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                         <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                      </div>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MarketingManager;
