
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Check, X, User, List, DollarSign, Loader2, Ban, Trash2, AlertTriangle, CheckCircle, Circle, CheckSquare, Settings, Edit2, Save } from 'lucide-react';
import { fetchAppointments, updateAppointmentStatus, settleAppointment, deleteAppointment, bulkDeleteAppointments, fetchSlotConfigs, updateSlotCapacity } from '../services/dataService';
import { Appointment } from '../types';
import { SERVICES_CATALOG } from '../constants';
import { supabase } from '../lib/supabaseClient';

const DEFAULT_CAPACITY = 2;

interface AppointmentManagerProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

// Static helpers
const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 9; h < 12; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  for (let h = 15; h < 17; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
})();

const getNextSevenDays = () => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
};

const AppointmentManager: React.FC<AppointmentManagerProps> = ({ showToast = (_msg, _type) => {} }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState('all');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [slotConfigs, setSlotConfigs] = useState<Record<string, number>>({});
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [activeAppt, setActiveAppt] = useState<Appointment | null>(null);
  const [settleAmount, setSettleAmount] = useState<number | string>(0);
  const [isSettling, setIsSettling] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    id: string | null;
  }>({ show: false, id: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Capacity Edit State
  const [editingSlot, setEditingSlot] = useState<{slot: string, capacity: number} | null>(null);
  const [isSavingCapacity, setIsSavingCapacity] = useState(false);

  const next7Days = useMemo(() => getNextSevenDays(), []);

  const loadData = async () => {
    const [apptData, configData] = await Promise.all([
      fetchAppointments(),
      fetchSlotConfigs()
    ]);
    setAppointments(apptData);
    setSlotConfigs(configData);
  };

  useEffect(() => {
    loadData();
    const apptChannel = supabase.channel('public:appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAppointments().then(setAppointments);
      })
      .subscribe();
      
    const configChannel = supabase.channel('public:slot_configs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slot_configs' }, () => {
        fetchSlotConfigs().then(setSlotConfigs);
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(apptChannel); 
      supabase.removeChannel(configChannel);
    };
  }, []);

  const handleStatusChange = async (id: string, newStatus: 'confirmed' | 'cancelled') => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    await updateAppointmentStatus(id, newStatus);
    showToast(`预约状态更新为: ${newStatus === 'confirmed' ? '已确认' : '已取消'}`, 'success');
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set()); 
  };

  const toggleSelectId = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredList.map(a => a.id)));
    }
  };

  const handleSingleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteModal({ show: true, id: id });
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setDeleteModal({ show: true, id: null });
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteModal.id) {
        const success = await deleteAppointment(deleteModal.id);
        if (success) {
          setAppointments(prev => prev.filter(a => a.id !== deleteModal.id));
          showToast('预约已删除', 'success');
        } else {
          showToast("删除失败，请检查网络或权限", 'error');
        }
      } else {
        const ids = Array.from(selectedIds) as string[];
        const success = await bulkDeleteAppointments(ids);
        if (success) {
          setAppointments(prev => prev.filter(a => !selectedIds.has(a.id)));
          setIsSelectionMode(false);
          setSelectedIds(new Set());
          showToast(`已批量删除 ${ids.length} 条预约`, 'success');
        } else {
          showToast("批量删除失败，请重试", 'error');
        }
      }
    } catch (e) {
      console.error(e);
      showToast("发生未知错误", 'error');
    } finally {
      setIsDeleting(false);
      setDeleteModal({ show: false, id: null });
    }
  };

  const handleOpenSettleModal = (e: React.MouseEvent, appt: Appointment) => {
    e.stopPropagation();
    setActiveAppt(appt);
    const service = SERVICES_CATALOG.find(s => s.name === appt.serviceName);
    setSettleAmount(service ? service.price : 0);
    setShowSettleModal(true);
  };

  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppt) return;
    setIsSettling(true);
    try {
       const amount = Number(settleAmount);
       const result = await settleAppointment(activeAppt.id, activeAppt.customerId, activeAppt.serviceName, amount);
       if (result.success) {
          showToast(`结算成功，已扣款 $${amount}`, 'success');
          setAppointments(prev => prev.map(a => a.id === activeAppt.id ? { ...a, status: 'completed' } : a));
          setShowSettleModal(false);
       } else {
          showToast(result.message, 'error');
       }
    } catch (e) {
       showToast("系统错误", 'error');
    } finally {
       setIsSettling(false);
    }
  };

  const handleEditCapacity = (e: React.MouseEvent, slot: string) => {
    e.stopPropagation();
    const currentCap = slotConfigs[slot] ?? DEFAULT_CAPACITY;
    setEditingSlot({ slot, capacity: currentCap });
  };

  const saveCapacity = async () => {
    if (!editingSlot) return;
    setIsSavingCapacity(true);
    const success = await updateSlotCapacity(editingSlot.slot, editingSlot.capacity);
    if (success) {
       setSlotConfigs(prev => ({...prev, [editingSlot.slot]: editingSlot.capacity}));
       showToast(`时间段 ${editingSlot.slot} 容量已更新`, 'success');
       setEditingSlot(null);
    } else {
       showToast('更新失败', 'error');
    }
    setIsSavingCapacity(false);
  };

  // Optimized Stats Calculation
  const slotStats = useMemo(() => {
    const stats: Record<string, number> = {};
    TIME_SLOTS.forEach(s => stats[s] = 0);
    if (!selectedDate) return stats;
    const targetDateStr = selectedDate.toDateString();
    
    appointments.forEach(appt => {
        if (appt.status !== 'cancelled') {
            const apptDate = new Date(appt.time);
            if (apptDate.toDateString() === targetDateStr) {
                const timeStr = apptDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
                if (stats[timeStr] !== undefined) stats[timeStr]++;
            }
        }
    });
    return stats;
  }, [appointments, selectedDate]);

  // Optimized Filtering
  const filteredList = useMemo(() => {
    return appointments.filter(a => {
      const matchesStatus = filter === 'all' || a.status === filter;
      let matchesDate = true;
      if (selectedDate) {
        const apptDate = new Date(a.time);
        matchesDate = apptDate.toDateString() === selectedDate.toDateString();
      }
      let matchesSlot = true;
      if (selectedDate && selectedSlot) {
          const apptDate = new Date(a.time);
          const timeStr = apptDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
          matchesSlot = timeStr === selectedSlot;
      }
      return matchesStatus && matchesDate && matchesSlot;
    });
  }, [appointments, filter, selectedDate, selectedSlot]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'confirmed': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">已确认</span>;
      case 'pending': return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">待确认</span>;
      case 'cancelled': return <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-bold">已取消</span>;
      case 'completed': return <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">已完成</span>;
      default: return null;
    }
  };

  const formatDateShort = (date: Date) => {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return '今天';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return '明天';
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] relative">
      {/* Left Sidebar: Calendar & Slots */}
      <div className="w-full lg:w-1/4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" /> 档期概览
        </h3>
        
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
           <button onClick={() => { setSelectedDate(null); setSelectedSlot(null); }} className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${!selectedDate ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>全部日期</button>
           {next7Days.map(date => (
             <button key={date.toDateString()} onClick={() => { setSelectedDate(date); setSelectedSlot(null); }} className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold border transition-colors text-center min-w-[60px] ${selectedDate?.toDateString() === date.toDateString() ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
               <div className="opacity-70 text-[10px] font-normal">{['周日','周一','周二','周三','周四','周五','周六'][date.getDay()]}</div>
               <div>{formatDateShort(date)}</div>
             </button>
           ))}
        </div>

        {selectedDate ? (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
             <div className="text-xs text-slate-400 mb-2 flex justify-between items-center">
               <span>点击时段筛选，点击 <Edit2 className="w-3 h-3 inline" /> 修改容量</span>
             </div>
             {TIME_SLOTS.map(slot => {
                const count = slotStats[slot] || 0;
                const capacity = slotConfigs[slot] ?? DEFAULT_CAPACITY;
                const isFull = count >= capacity;
                
                return (
                  <div key={slot} onClick={() => setSelectedSlot(selectedSlot === slot ? null : slot)} className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all group ${selectedSlot === slot ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <span className="text-sm font-medium text-slate-700">{slot}</span>
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isFull ? 'bg-red-100 border-red-200 text-red-700' : count > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-100 text-green-700'}`}>{count}/{capacity}</span>
                       <button 
                         onClick={(e) => handleEditCapacity(e, slot)}
                         className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                         title="修改容量"
                       >
                          <Edit2 className="w-3 h-3" />
                       </button>
                    </div>
                  </div>
                );
             })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">请选择日期查看</div>
        )}
      </div>

      {/* Main List */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
           <div className="flex items-center gap-2">
              <List className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-slate-800">{selectedDate ? `${selectedDate.toLocaleDateString()} 预约` : '全部预约'}</h3>
           </div>
           
           {isSelectionMode ? (
             <div className="flex items-center gap-2 animate-fade-in">
               <button onClick={handleSelectAll} className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1 transition-colors">
                 <CheckSquare className="w-3 h-3" /> {selectedIds.size === filteredList.length ? '取消全选' : '全选'}
               </button>
               <button onClick={toggleSelectionMode} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-transparent flex items-center gap-1 transition-colors">
                 <X className="w-3 h-3" /> 退出管理
               </button>
             </div>
           ) : (
             <div className="flex flex-wrap items-center gap-2">
                {['all','pending','confirmed','completed','cancelled'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {f === 'all' ? '全部' : f === 'pending' ? '待确认' : f === 'confirmed' ? '已确认' : f === 'completed' ? '已完成' : '已取消'}
                  </button>
                ))}
                {filteredList.length > 0 && (
                  <button onClick={toggleSelectionMode} className="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 transition-colors">
                     <CheckSquare className="w-3 h-3" /> 批量管理
                  </button>
                )}
             </div>
           )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 pb-20">
           {filteredList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                 <Calendar className="w-12 h-12 mb-2 opacity-20" />
                 <p>暂无数据</p>
              </div>
           ) : (
             filteredList.map(appt => (
               <div 
                 key={appt.id} 
                 onClick={() => isSelectionMode && toggleSelectId(appt.id)}
                 className={`bg-white p-4 rounded-xl border shadow-sm transition-all flex items-center justify-between group ${isSelectionMode ? 'cursor-pointer hover:bg-indigo-50/50' : 'hover:shadow-md'} ${selectedIds.has(appt.id) ? 'border-indigo-300 bg-indigo-50/30 ring-1 ring-indigo-300' : 'border-slate-100'}`}
               >
                  <div className="flex items-center gap-4">
                     <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg border ${selectedIds.has(appt.id) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                        <span className="text-xs font-bold uppercase">{new Date(appt.time).toDateString().split(' ')[0]}</span>
                        <span className="text-xl font-bold">{new Date(appt.time).getDate()}</span>
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                           {appt.serviceName} {getStatusBadge(appt.status)}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                           <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(appt.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           <span className="flex items-center gap-1"><User className="w-3 h-3" /> {appt.customerName}</span>
                        </div>
                        {appt.notes && <p className="text-xs text-slate-400 mt-1 italic">"{appt.notes}"</p>}
                     </div>
                  </div>
                  
                  {isSelectionMode ? (
                    <div className="ml-4">
                       {selectedIds.has(appt.id) ? <CheckCircle className="w-6 h-6 text-indigo-600 fill-indigo-50" /> : <Circle className="w-6 h-6 text-slate-300" />}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                       {appt.status === 'pending' && (
                          <>
                            <button onClick={() => handleStatusChange(appt.id, 'cancelled')} className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="取消"><X className="w-4 h-4" /></button>
                            <button onClick={() => handleStatusChange(appt.id, 'confirmed')} className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm" title="确认"><Check className="w-4 h-4" /></button>
                          </>
                       )}
                       {appt.status === 'confirmed' && (
                          <button onClick={(e) => handleOpenSettleModal(e, appt)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1 shadow-sm"><DollarSign className="w-3 h-3" /> 结单</button>
                       )}
                       <button onClick={(e) => handleSingleDeleteClick(e, appt.id)} className="ml-2 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
               </div>
             ))
           )}
        </div>

        {isSelectionMode && selectedIds.size > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center animate-slide-up z-10">
             <span className="text-sm font-bold text-slate-700">已选择 {selectedIds.size} 项</span>
             <div className="flex gap-3">
                <button onClick={() => setSelectedIds(new Set())} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">清空选择</button>
                <button onClick={handleBulkDeleteClick} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 flex items-center gap-2 shadow-lg shadow-red-200">
                  <Trash2 className="w-4 h-4" /> 确认删除 ({selectedIds.size})
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Capacity Edit Modal */}
      {editingSlot && (
         <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-xs overflow-hidden animate-zoom-in">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800">调整客流容量</h3>
                 <button onClick={() => setEditingSlot(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6">
                 <p className="text-sm text-slate-500 mb-4">
                   设置 <strong>{editingSlot.slot}</strong> 时段的最大可预约人数。
                 </p>
                 <div className="flex items-center gap-3 justify-center mb-6">
                    <button onClick={() => setEditingSlot(prev => prev ? {...prev, capacity: Math.max(0, prev.capacity - 1)} : null)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-600 font-bold">-</button>
                    <span className="text-3xl font-bold text-indigo-600 w-12 text-center">{editingSlot.capacity}</span>
                    <button onClick={() => setEditingSlot(prev => prev ? {...prev, capacity: prev.capacity + 1} : null)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-600 font-bold">+</button>
                 </div>
                 <button onClick={saveCapacity} disabled={isSavingCapacity} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                    {isSavingCapacity ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存设置'}
                 </button>
              </div>
            </div>
         </div>
      )}

      {/* Delete Modal */}
      {deleteModal.show && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm overflow-hidden animate-zoom-in">
               <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                     <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{deleteModal.id ? '删除此记录?' : '批量删除记录?'}</h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                     {deleteModal.id ? '此操作将永久删除该预约，无法恢复。' : `您即将永久删除选中的 ${selectedIds.size} 条预约记录。`}
                  </p>
                  <div className="flex gap-3">
                     <button onClick={() => setDeleteModal({ show: false, id: null })} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50">取消</button>
                     <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 flex items-center justify-center gap-2">
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认删除'}
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {showSettleModal && activeAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm overflow-hidden animate-fade-in-up">
              <div className="bg-indigo-600 p-4 flex justify-between items-center">
                 <h3 className="text-white font-bold flex items-center gap-2"><DollarSign className="w-5 h-5" /> 预约结算</h3>
                 <button onClick={() => setShowSettleModal(false)} className="text-indigo-100 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleConfirmSettle} className="p-6 space-y-4">
                 <div className="text-center mb-4">
                    <h4 className="font-bold text-slate-800">{activeAppt.serviceName}</h4>
                    <p className="text-sm text-slate-500">{activeAppt.customerName}</p>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">扣款金额 ($)</label>
                    <input type="number" min="0" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} className="w-full px-4 py-3 text-lg font-bold text-center bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900" autoFocus />
                 </div>
                 <div className="flex gap-3 mt-2">
                    <button type="button" onClick={() => setShowSettleModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-50">取消</button>
                    <button type="submit" disabled={isSettling} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-70">
                      {isSettling ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认扣款'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentManager;