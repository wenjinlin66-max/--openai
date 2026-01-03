import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Clock, CheckCircle, Loader2, CalendarClock, ChevronRight, AlertTriangle, MessageSquare, Star, X, Send, Ban } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Customer, Appointment } from '../types';
import { SERVICES_LIST } from '../constants';

interface AppointmentPageProps {
  user: Customer;
}

const DEFAULT_CAPACITY = 2;

// Helper: Generate Time Slots (Static)
const generateTimeSlots = () => {
  const morningSlots = [];
  const afternoonSlots = [];
  // Morning: 9:00 - 11:30
  for (let i = 9; i < 12; i++) {
    morningSlots.push(`${i.toString().padStart(2, '0')}:00`);
    if (i !== 11) morningSlots.push(`${i.toString().padStart(2, '0')}:30`);
    else morningSlots.push(`${i.toString().padStart(2, '0')}:30`);
  }
  // Afternoon: 15:00 - 16:30
  for (let i = 15; i < 17; i++) {
    afternoonSlots.push(`${i.toString().padStart(2, '0')}:00`);
    if (i !== 16) afternoonSlots.push(`${i.toString().padStart(2, '0')}:30`);
    else afternoonSlots.push(`${i.toString().padStart(2, '0')}:30`);
  }
  return { morningSlots, afternoonSlots };
};

const { morningSlots, afternoonSlots } = generateTimeSlots();

// Helper: Create a UTC ISO string from local YYYY-MM-DD and HH:MM
const getISOFromLocal = (dateStr: string, timeStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hr, min] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hr, min, 0, 0).toISOString();
};

const getStatusBadge = (status: string) => {
  const badges: Record<string, React.ReactNode> = {
    confirmed: <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">已确认</span>,
    cancelled: <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-400 text-xs font-medium">已取消</span>,
    completed: <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium flex items-center"><CheckCircle size={12} className="mr-1" /> 已完成</span>,
    pending: <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-medium">待确认</span>
  };
  return badges[status] || badges.pending;
};

const AppointmentPage: React.FC<AppointmentPageProps> = ({ user }) => {
  const [service, setService] = useState(SERVICES_LIST[0].name);
  const [date, setDate] = useState<string>(''); 
  const [time, setTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Cancellation State
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Booking Logic State
  const [bookedCounts, setBookedCounts] = useState<Record<string, number>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotConfigs, setSlotConfigs] = useState<Record<string, number>>({});

  // Review/Feedback State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewAppointment, setReviewAppointment] = useState<Appointment | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());

  const next7Days = useMemo(() => {
    const days = [];
    const today = new Date();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      let label = weekDays[d.getDay()];
      if (i === 0) label = '今天';
      if (i === 1) label = '明天';

      days.push({
        fullDate: `${year}-${month}-${day}`,
        label,
        dateStr: `${month}/${day}`
      });
    }
    return days;
  }, []);

  useEffect(() => {
    if (next7Days.length > 0 && !date) {
      setDate(next7Days[0].fullDate);
    }
  }, [next7Days, date]);

  // Fetch Slot Configs (Capacity)
  useEffect(() => {
    const fetchSlotConfigs = async () => {
        try {
            const { data, error } = await supabase.from('slot_configs').select('time_slot, capacity');
            if (error) {
                console.warn("Failed to fetch slot configs, using default.", error);
                return;
            }
            if (data) {
                const configMap: Record<string, number> = {};
                data.forEach((row: any) => {
                    configMap[row.time_slot] = row.capacity;
                });
                setSlotConfigs(configMap);
            }
        } catch (err) {
            console.error("Error fetching slot configs:", err);
        }
    };
    fetchSlotConfigs();
  }, []);

  // Fetch Appointments and Feedback Status
  const fetchAppointments = useCallback(async () => {
    try {
      // 1. Fetch Appointments
      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (apptError) throw apptError;
      setAppointments(apptData || []);

      // 2. Fetch Feedback IDs for this user to know what is reviewed
      // We only care about feedbacks that have an appointment_id linked
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedbacks')
        .select('appointment_id')
        .eq('customer_id', user.id)
        .not('appointment_id', 'is', null);

      if (!feedbackError && feedbackData) {
        const ids = new Set<string>(feedbackData.map((f: any) => String(f.appointment_id)));
        setReviewedAppointmentIds(ids);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchAppointments();

    const channel = supabase
      .channel('appointments-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Appointment;
          setAppointments(prev => prev.map(apt => apt.id === updated.id ? updated : apt));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAppointments, user.id]);

  // Fetch Availability Logic
  useEffect(() => {
    if (!date) {
        setBookedCounts({});
        return;
    }

    const fetchAvailability = async () => {
        setLoadingSlots(true);
        try {
            const [y, m, d] = date.split('-').map(Number);
            const startISO = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
            const endISO = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();

            const { data, error } = await supabase
                .from('appointments')
                .select('appointment_time')
                .neq('status', 'cancelled')
                .gte('appointment_time', startISO)
                .lte('appointment_time', endISO);

            if (error) throw error;

            const counts: Record<string, number> = {};
            data?.forEach((apt) => {
                const aptDate = new Date(apt.appointment_time);
                const timePart = `${String(aptDate.getHours()).padStart(2, '0')}:${String(aptDate.getMinutes()).padStart(2, '0')}`;
                counts[timePart] = (counts[timePart] || 0) + 1;
            });

            setBookedCounts(counts);
            
            // Check if currently selected time is now full based on updated dynamic capacity
            if (time) {
                const maxCap = slotConfigs[time] !== undefined ? slotConfigs[time] : DEFAULT_CAPACITY;
                if ((counts[time] || 0) >= maxCap || maxCap === 0) {
                    setTime('');
                }
            }

        } catch (err) {
            console.error("Error fetching availability:", err);
        } finally {
            setLoadingSlots(false);
        }
    };

    fetchAvailability();
  }, [date, time, slotConfigs]);

  // Submit New Appointment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) return alert('请选择日期和时间');
    
    setIsSubmitting(true);
    try {
      const isoAppointmentTime = getISOFromLocal(date, time);
      const maxCap = slotConfigs[time] !== undefined ? slotConfigs[time] : DEFAULT_CAPACITY;

      if (maxCap <= 0) {
          alert("该时段暂不开放预约");
          setIsSubmitting(false);
          return;
      }

      const { count, error: checkError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'cancelled')
        .eq('appointment_time', isoAppointmentTime);

      if (checkError) throw checkError;

      if ((count || 0) >= maxCap) {
        alert(`手慢了！${time} 的名额刚刚被抢光，请选择其他时间。`);
        setBookedCounts(prev => ({ ...prev, [time]: (count || 0) }));
        setTime('');
        return;
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          customer_id: user.id,
          service_name: service,
          appointment_time: isoAppointmentTime,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      setSuccessMsg('预约已提交，等待确认');
      setAppointments([data, ...appointments]);
      setBookedCounts(prev => ({ ...prev, [time]: (prev[time] || 0) + 1 }));
      setTime('');
      setTimeout(() => setSuccessMsg(''), 3000);

    } catch (err) {
      console.error('Appointment Error:', err);
      alert('预约提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Appointment Logic
  const executeCancel = async () => {
    if (!appointmentToCancel) return;
    
    const dateCheck = new Date(appointmentToCancel.appointment_time);
    if (isNaN(dateCheck.getTime())) {
        alert("预约数据异常，无法取消");
        setAppointmentToCancel(null);
        return;
    }

    setIsCancelling(true);
    try {
        const { error } = await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', appointmentToCancel.id);
        
        if (error) throw error;

        setAppointments(prev => prev.map(item => 
            item.id === appointmentToCancel.id ? { ...item, status: 'cancelled' } : item
        ));

        const aptDateObj = new Date(appointmentToCancel.appointment_time);
        const year = aptDateObj.getFullYear();
        const month = String(aptDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(aptDateObj.getDate()).padStart(2, '0');
        
        if (`${year}-${month}-${day}` === date) {
            const timePart = `${String(aptDateObj.getHours()).padStart(2, '0')}:${String(aptDateObj.getMinutes()).padStart(2, '0')}`;
            setBookedCounts(prev => ({ ...prev, [timePart]: Math.max(0, (prev[timePart] || 1) - 1) }));
        }
        
        setAppointmentToCancel(null);
    } catch (err) {
        console.error("Error cancelling appointment:", err);
        alert("取消失败，请稍后重试");
    } finally {
        setIsCancelling(false);
    }
  };

  // --- REVIEW LOGIC ---
  const openReviewModal = (apt: Appointment) => {
    setReviewAppointment(apt);
    setReviewRating(5);
    setReviewText('');
    setReviewModalOpen(true);
  };

  const submitReview = async () => {
    if (!reviewAppointment) return;
    setIsSubmittingReview(true);

    try {
      // Determine sentiment based on rating (Simple logic to avoid API cost/latency for this feature)
      // >=4 Positive, 3 Neutral, <=2 Negative
      const sentiment = reviewRating >= 4 ? 'positive' : reviewRating === 3 ? 'neutral' : 'negative';

      const { error } = await supabase.from('feedbacks').insert({
        customer_id: user.id,
        customer_name: user.name,
        text: reviewText || '默认好评', // If empty text
        sentiment: sentiment,
        appointment_id: reviewAppointment.id,
        rating: reviewRating
      });

      if (error) throw error;

      // Update local state to show "Reviewed"
      setReviewedAppointmentIds(prev => new Set(prev).add(reviewAppointment.id));
      
      setSuccessMsg('感谢您的评价！');
      setTimeout(() => setSuccessMsg(''), 3000);
      setReviewModalOpen(false);
    } catch (err) {
      console.error('Review submit error:', err);
      alert('评价提交失败，请重试');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const renderTimeGrid = (slots: string[], label: string) => (
    <div className="mb-4">
        <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{label}</h4>
        <div className="grid grid-cols-4 gap-2">
            {slots.map((slot) => {
                const maxCap = slotConfigs[slot] !== undefined ? slotConfigs[slot] : DEFAULT_CAPACITY;
                const count = bookedCounts[slot] || 0;
                const isFull = count >= maxCap;
                const isClosed = maxCap === 0;
                const isSelected = time === slot;
                const isDisabled = isFull || isClosed || !date;

                return (
                    <button
                        key={slot}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setTime(slot)}
                        className={`
                            relative flex flex-col items-center justify-center py-2.5 rounded-lg border text-xs transition-all
                            ${!date ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-400' : ''}
                            ${isDisabled
                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' 
                                : isSelected
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-105'
                                    : 'bg-white border-gray-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                            }
                        `}
                    >
                        {isClosed ? (
                           <span className="flex items-center text-gray-400"><Ban size={12} className="mr-1"/> 休息</span>
                        ) : (
                           <>
                             <span className="font-bold text-sm">{slot}</span>
                             {date && (
                                 <span className="text-[10px] mt-0.5 scale-90 origin-center">
                                     {isFull ? '已满' : `余 ${maxCap - count}`}
                                 </span>
                             )}
                           </>
                        )}
                    </button>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-gray-50 relative">
      <div className="px-6 pt-12 pb-4 bg-white sticky top-0 z-10 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">在线预约</h1>
        <p className="text-sm text-gray-500 mt-1">提前预约，尊享优先服务</p>
      </div>

      <div className="p-4 space-y-6">
        {/* Booking Form */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">选择服务</label>
              <div className="relative">
                <select 
                    value={service} 
                    onChange={(e) => setService(e.target.value)}
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 appearance-none"
                  >
                    {SERVICES_LIST.map(s => <option key={s.name} value={s.name}>{s.name} (¥{s.price})</option>)}
                </select>
                <ChevronRight className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
              </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">选择日期</label>
                <div className="flex space-x-3 overflow-x-auto pb-4 -mx-1 px-1 custom-scrollbar snap-x">
                    {next7Days.map((dayItem) => {
                        const isSelected = date === dayItem.fullDate;
                        return (
                            <button
                                key={dayItem.fullDate}
                                type="button"
                                onClick={() => { setDate(dayItem.fullDate); setTime(''); }}
                                className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border transition-all duration-200 snap-start ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105' : 'bg-white border-gray-200 text-slate-600 hover:border-indigo-300'}`}
                            >
                                <span className={`text-xs mb-1 ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>{dayItem.label}</span>
                                <span className="text-lg font-bold">{dayItem.dateStr}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-800">选择时间</label>
                    {loadingSlots && <div className="flex items-center text-xs text-indigo-500"><Loader2 size={12} className="animate-spin mr-1"/>加载中...</div>}
                </div>
                <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                    {renderTimeGrid(morningSlots, '上午时段')}
                    {renderTimeGrid(afternoonSlots, '下午时段')}
                </div>
            </div>

            {successMsg && (
              <div className="flex items-center text-green-600 text-sm bg-green-50 p-3 rounded-lg animate-in fade-in border border-green-100">
                <CheckCircle size={16} className="mr-2" /> {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !time}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-2 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : '立即预约'}
            </button>
          </form>
        </div>

        {/* Appointment List */}
        <div className="pb-20">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center text-lg">
            <CalendarClock size={20} className="mr-2 text-indigo-600" /> 我的预约记录
          </h3>
          
          {loadingHistory ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-400 w-8 h-8" /></div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200"><p>暂无预约记录</p></div>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => {
                const isFuture = new Date(apt.appointment_time) > new Date();
                const canCancel = (apt.status === 'pending' || apt.status === 'confirmed') && isFuture;
                const isCompleted = apt.status === 'completed';
                const hasReviewed = reviewedAppointmentIds.has(apt.id);

                return (
                    <div key={apt.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                                <h4 className="font-bold text-slate-800 text-sm mb-1">{apt.service_name}</h4>
                                <div className="flex items-center text-xs text-gray-500">
                                    <Calendar size={12} className="mr-1" />
                                    {new Date(apt.appointment_time).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                    <Clock size={12} className="ml-2 mr-1" />
                                    {new Date(apt.appointment_time).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            <div className="flex flex-col items-end">{getStatusBadge(apt.status)}</div>
                        </div>
                        
                        {/* Actions: Cancel OR Review */}
                        <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                             {canCancel && (
                                <button onClick={() => setAppointmentToCancel(apt)} className="flex items-center px-3 py-1.5 text-xs font-medium border border-red-200 text-red-500 rounded-full hover:bg-red-50 hover:border-red-300 transition-all active:scale-95">取消预约</button>
                             )}

                             {isCompleted && (
                                hasReviewed ? (
                                    <span className="flex items-center px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-400 rounded-full cursor-default">
                                        <CheckCircle size={12} className="mr-1"/> 已评价
                                    </span>
                                ) : (
                                    <button 
                                        onClick={() => openReviewModal(apt)}
                                        className="flex items-center px-3 py-1.5 text-xs font-medium border border-indigo-200 text-indigo-600 rounded-full hover:bg-indigo-50 hover:border-indigo-300 transition-all active:scale-95"
                                    >
                                        <MessageSquare size={12} className="mr-1"/> 去评价
                                    </button>
                                )
                             )}
                        </div>
                    </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {appointmentToCancel && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 mb-safe">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500"><AlertTriangle size={24} /></div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">取消预约确认</h3>
                    <p className="text-sm text-gray-500 mb-6 leading-relaxed">您确定要取消 <span className="font-bold text-slate-800 block mt-1">{appointmentToCancel.service_name}</span> 的预约吗？此操作无法撤销。</p>
                    <div className="flex space-x-3 w-full">
                        <button onClick={() => setAppointmentToCancel(null)} disabled={isCancelling} className="flex-1 py-3 rounded-xl border border-gray-200 text-slate-700 font-bold hover:bg-gray-50 transition-colors">暂不取消</button>
                        <button onClick={executeCancel} disabled={isCancelling} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-200 hover:bg-red-600 transition-colors flex items-center justify-center">{isCancelling ? <Loader2 className="animate-spin w-5 h-5" /> : '确认取消'}</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModalOpen && reviewAppointment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-4 bg-indigo-600 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center"><Star size={18} className="mr-2 fill-white"/> 服务评价</h3>
                    <button onClick={() => setReviewModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6">
                    <p className="text-center text-sm text-gray-500 mb-4">
                        请为 <span className="font-bold text-slate-800">{reviewAppointment.service_name}</span> 评分
                    </p>

                    <div className="flex justify-center space-x-2 mb-6">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button key={star} onClick={() => setReviewRating(star)} className="focus:outline-none transform transition-transform active:scale-110">
                                <Star size={36} className={`${star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} transition-colors`} />
                            </button>
                        ))}
                    </div>

                    <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="服务还满意吗？有没有什么建议？"
                        className="w-full h-28 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none mb-4"
                    />

                    <button 
                        onClick={submitReview}
                        disabled={isSubmittingReview}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 flex items-center justify-center transition-all active:scale-95"
                    >
                        {isSubmittingReview ? <Loader2 className="animate-spin w-5 h-5"/> : <><Send size={16} className="mr-2"/> 提交评价</>}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentPage;