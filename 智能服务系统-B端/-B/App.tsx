
import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  ScanFace, 
  MessageSquareMore, 
  Users, 
  Settings,
  Search,
  Sparkles,
  LogOut,
  Database,
  Loader2,
  Calendar,
  Headphones,
  Menu,
  Zap,
  CheckCircle,
  XCircle,
  Info,
  Bell,
  Trash2,
  Check,
  Inbox,
  X
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import CustomerScanner from './components/CustomerScanner';
import ServiceAssistant from './components/ServiceAssistant';
import CustomerList from './components/CustomerList';
import FeedbackView from './components/FeedbackView';
import AppointmentManager from './components/AppointmentManager';
import ChatCenter from './components/ChatCenter';
import MarketingManager from './components/MarketingManager';
import LoginScreen from './components/LoginScreen';
// NotificationCenter import removed to force inline rendering
import { ViewState, Customer, FeedbackItem, DashboardStats, NotificationItem } from './types';
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer, fetchFeedbacks, addTransaction, rechargeCustomer, fetchDashboardStats, fetchNotifications, markNotificationRead, deleteNotification, deleteAllNotifications } from './services/dataService';
import { isSupabaseConfigured, supabase, getSession, signOut } from './lib/supabaseClient';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ totalCustomers: 0, totalRevenue: 0, totalVisits: 0, avgSatisfaction: "0", tierDistribution: [] });
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [identifiedCustomer, setIdentifiedCustomer] = useState<Customer | null>(null);
  
  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomersCount, setTotalCustomersCount] = useState(0);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // New state for clear confirmation modal
  const [showClearNotifModal, setShowClearNotifModal] = useState(false);

  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const notifRef = React.useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Toast Handler
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // Play a notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1); // Drop to A4
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  // Check Session on Mount
  useEffect(() => {
    const checkSession = async () => {
      setAuthLoading(true);
      const { session } = await getSession();
      setSession(session);
      setAuthLoading(false);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initial Data Load
  useEffect(() => {
    if (!session) return;

    const loadInitialData = async () => {
      setLoading(true);
      const connected = isSupabaseConfigured();
      setIsDbConnected(connected);
      
      if (connected) {
        try {
          const [stats, dbFeedbacks, dbNotifications] = await Promise.all([
            fetchDashboardStats(),
            fetchFeedbacks(),
            fetchNotifications()
          ]);

          setDashboardStats(stats);
          setFeedbacks(dbFeedbacks);
          setNotifications(dbNotifications);
        } catch (e) {
          console.error("Failed to load data", e);
        }
      }
      setLoading(false);
    };
    loadInitialData();
  }, [session]);

  // Fetch Customers with Pagination & Search
  useEffect(() => {
    if (!session || !isDbConnected) return;

    const loadCustomers = async () => {
      const { data, total } = await fetchCustomers(currentPage, 10, searchQuery);
      setCustomers(data);
      setTotalCustomersCount(total);
    };

    const timeoutId = setTimeout(() => {
      loadCustomers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [session, isDbConnected, currentPage, searchQuery]);

  // Realtime Notifications Subscription
  useEffect(() => {
    if (!isDbConnected || !session) return;

    const channel = supabase.channel('public:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const newNotif = payload.new as any;
        
        // B-side admins ignore customer-specific notifications
        if (newNotif.customer_id) {
          return; 
        }

        const item: NotificationItem = {
          id: newNotif.id,
          title: newNotif.title,
          message: newNotif.message,
          type: newNotif.type,
          read: newNotif.is_read,
          time: '刚刚'
        };
        setNotifications(prev => [item, ...prev]);
        playNotificationSound();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDbConnected, session]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleLogout = useCallback(async () => {
    await signOut();
    setSession(null);
  }, []);

  const handleCustomerIdentified = useCallback((customer: Customer) => {
    setIdentifiedCustomer(customer);
  }, []);

  const handleAddCustomer = useCallback(async (newCustomer: Customer) => {
    await createCustomer(newCustomer);
    setCurrentPage(1);
    const { data, total } = await fetchCustomers(1, 10, searchQuery);
    setCustomers(data);
    setTotalCustomersCount(total);
    setIdentifiedCustomer(newCustomer);
    showToast(`客户档案 ${newCustomer.name} 创建成功`, 'success');
  }, [searchQuery, showToast]);

  const handleUpdateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    await updateCustomer(id, updates);
    showToast('客户信息已更新', 'success');
  }, [showToast]);

  const handleDeleteCustomer = useCallback(async (id: string) => {
    const success = await deleteCustomer(id);
    if (success) {
      setCustomers(prev => prev.filter(c => c.id !== id));
      if (identifiedCustomer?.id === id) {
        setIdentifiedCustomer(null);
      }
      const { total } = await fetchCustomers(currentPage, 10, searchQuery);
      setTotalCustomersCount(total);
      showToast('客户已删除', 'success');
    } else {
      showToast('删除失败：请检查数据库权限', 'error');
    }
  }, [currentPage, searchQuery, identifiedCustomer, showToast]);

  const handleAddTransaction = useCallback(async (customerId: string, service: string, amount: number) => {
    const newTxn = await addTransaction(customerId, service, amount);
    if (newTxn) {
      setCustomers(prev => prev.map(c => {
        if (c.id === customerId) {
          return {
            ...c,
            totalSpent: c.totalSpent + amount,
            visitCount: c.visitCount + 1,
            balance: c.balance - amount,
            lastVisit: new Date().toISOString().split('T')[0],
            history: [newTxn, ...c.history]
          };
        }
        return c;
      }));
      showToast(`消费记录已添加 (-$${amount})`, 'success');
    }
  }, [showToast]);

  const handleRechargeCustomer = useCallback(async (customerId: string, amount: number) => {
    const newTxn = await rechargeCustomer(customerId, amount);
    if (newTxn) {
      setCustomers(prev => prev.map(c => {
        if (c.id === customerId) {
          return {
            ...c,
            totalSpent: c.totalSpent, 
            balance: c.balance + amount,
            points: c.points + Math.floor(amount), 
            history: [newTxn, ...c.history]
          };
        }
        return c;
      }));
      showToast(`充值成功 (+$${amount})`, 'success');
    }
  }, [showToast]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await markNotificationRead(id);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await markNotificationRead('ALL');
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const originalNotifications = [...notifications];
    setNotifications(prev => prev.filter(n => n.id !== id));

    const success = await deleteNotification(id);
    if (!success) {
      setNotifications(originalNotifications);
      showToast('删除失败，请重试', 'error');
    } else {
      showToast('通知已删除', 'success');
    }
  };

  const handleDeleteAllNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (notifications.length === 0) return;
    
    // Close the dropdown so the modal is the focus and no UI glitch
    setShowNotifications(false);
    // Show confirmation modal
    setShowClearNotifModal(true);
  };

  const confirmClearAllNotifications = async () => {
    setShowClearNotifModal(false);
    const originalNotifications = [...notifications];
    // Collect IDs currently visible
    const idsToDelete = notifications.map(n => n.id);
    
    // Optimistic update
    setNotifications([]);
    
    const success = await deleteAllNotifications(idsToDelete);
    if (!success) {
       setNotifications(originalNotifications);
       showToast('清空失败，请重试', 'error');
    } else {
       showToast('所有通知已清空', 'success');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600" />
          <p>正在连接数据库并同步数据...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard stats={dashboardStats} onNavigate={setCurrentView} />;
      case 'scanner':
        return (
          <CustomerScanner 
            onCustomerIdentified={handleCustomerIdentified}
            customers={customers} 
            onAddCustomer={handleAddCustomer}
            showToast={showToast}
          />
        );
      case 'assistant':
        return <ServiceAssistant />;
      case 'customers':
        return (
          <CustomerList 
            searchQuery={searchQuery} 
            customers={customers} 
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onAddTransaction={handleAddTransaction}
            onRechargeCustomer={handleRechargeCustomer}
            currentPage={currentPage}
            totalPages={Math.ceil(totalCustomersCount / 10)}
            onPageChange={setCurrentPage}
            totalCount={totalCustomersCount}
          />
        );
      case 'appointments': 
        return <AppointmentManager showToast={showToast} />;
      case 'chat': 
        return <ChatCenter />;
      case 'marketing': 
        return <MarketingManager />;
      case 'feedback':
        return <FeedbackView />;
      default:
        return null;
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: React.ComponentType<any>; label: string }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
        ${currentView === view 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
        }`}
    >
      <Icon className={`w-5 h-5 ${currentView === view ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'}`} />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  const getHeaderTitle = () => {
    switch (currentView) {
      case 'dashboard': return '仪表盘';
      case 'scanner': return '生物特征识别';
      case 'assistant': return 'AI 助手';
      case 'customers': return '客户管理';
      case 'appointments': return '预约管理';
      case 'chat': return '客服中心'; 
      case 'marketing': return '营销活动中心';
      case 'feedback': return '反馈与评价';
      default: return 'CRIMS';
    }
  }

  if (authLoading) {
     return (
       <div className="h-screen flex items-center justify-center bg-slate-50">
         <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
       </div>
     );
  }

  if (!session) {
    return <LoginScreen onLoginSuccess={() => {}} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-in-right backdrop-blur-sm ${
              t.type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' :
              t.type === 'error' ? 'bg-red-50/90 border-red-200 text-red-800' :
              'bg-white/90 border-slate-200 text-slate-800'
            }`}
          >
            {t.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> :
             t.type === 'error' ? <XCircle className="w-5 h-5 text-red-500" /> :
             <Info className="w-5 h-5 text-indigo-500" />}
            <span className="text-sm font-medium">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-100 flex flex-col p-4 shadow-xl transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:shadow-sm md:flex
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="mb-8 px-2 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">CRIMS</h1>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          <NavItem view="dashboard" icon={LayoutDashboard} label="仪表盘" />
          <NavItem view="scanner" icon={ScanFace} label="智能扫描" />
          <NavItem view="customers" icon={Users} label="客户管理" />
          <NavItem view="appointments" icon={Calendar} label="预约管理" />
          {/* Reordered Marketing Center to below Appointments and above Chat */}
          <NavItem view="marketing" icon={Zap} label="营销中心" />
          <NavItem view="chat" icon={Headphones} label="客服中心" />
          <NavItem view="assistant" icon={MessageSquareMore} label="AI 助手 (内部)" />
          <NavItem view="feedback" icon={Settings} label="反馈与评价" />
        </nav>

        <div className="mt-auto space-y-4 pt-4 border-t border-slate-100">
           <div className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border ${isDbConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-500 border-red-200'}`}>
              <Database className="w-3 h-3" />
              {isDbConnected ? '数据库已连接' : '未连接数据库'}
           </div>

           <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
           >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">退出登录</span>
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
             <button 
               className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
               onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
             >
               <Menu className="w-6 h-6" />
             </button>

             <h2 className="text-lg font-semibold text-slate-800 capitalize">
               {getHeaderTitle()}
             </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block group">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${searchQuery ? 'text-indigo-500' : 'text-slate-700'}`} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={handleSearch}
                placeholder="搜索客户姓名..." 
                className="pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100 rounded-full text-sm w-64 transition-all outline-none placeholder:text-slate-400 text-slate-700"
              />
            </div>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 transition-colors rounded-full ${showNotifications ? 'bg-indigo-900 text-white' : 'text-slate-500 hover:text-indigo-600'}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>

              {/* Inline Notification Center UI - Forces Update */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-3 w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in z-50 ring-1 ring-indigo-900/5">
                  {/* Radical UI Change: Deep Purple (Indigo-900) Header */}
                  <div className="p-4 border-b border-indigo-800 flex justify-between items-center bg-indigo-900 sticky top-0 z-10 text-white">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      通知中心
                      {unreadCount > 0 && (
                        <span className="bg-white text-indigo-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold">{unreadCount}</span>
                      )}
                    </h3>
                    <div className="flex gap-2 text-xs font-medium items-center">
                      {notifications.length > 0 && (
                        <button 
                          onClick={(e) => handleDeleteAllNotifications(e)}
                          className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1 transition-colors border border-white/10"
                          title="清空所有通知"
                        >
                          <Trash2 className="w-3 h-3" /> 清空
                        </button>
                      )}
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-1 rounded transition-colors">
                          全部已读
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="text-white/60 hover:text-white ml-1 p-1 hover:bg-white/10 rounded-full">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-[450px] overflow-y-auto bg-slate-50 scrollbar-thin scrollbar-thumb-slate-200">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 flex flex-col items-center min-h-[200px] justify-center">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 border border-slate-200 shadow-sm">
                          <Inbox className="w-6 h-6 opacity-30" />
                        </div>
                        <p className="text-sm font-medium">暂无新通知</p>
                        <p className="text-xs opacity-70 mt-1">系统消息将在这里显示</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className="flex flex-col border-b border-slate-200 bg-white transition-all hover:shadow-md group relative"
                        >
                          {/* Content Area */}
                          <div className={`p-4 flex gap-3 ${!n.read ? 'bg-indigo-50/30' : ''}`}>
                            <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${!n.read ? 'bg-indigo-600 ring-2 ring-indigo-100' : 'bg-slate-300'}`}></div>
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-sm truncate ${!n.read ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                                {n.title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words whitespace-pre-wrap">
                                {n.message}
                              </p>
                            </div>
                          </div>

                          {/* Explicit Action Footer */}
                          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-mono tracking-tight">{n.time}</span>
                            
                            <div className="flex items-center gap-3">
                              {!n.read && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                                  className="text-xs font-bold text-indigo-600 hover:bg-indigo-100 px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                                >
                                  <Check className="w-3.5 h-3.5" /> 标为已读
                                </button>
                              )}
                              <button 
                                onClick={(e) => handleDeleteNotification(e, n.id)}
                                className="text-xs font-bold text-red-600 bg-white border border-red-100 hover:bg-red-600 hover:text-white hover:border-red-600 px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 shadow-sm"
                              >
                                <Trash2 className="w-3.5 h-3.5 group-hover/del:scale-110 transition-transform" /> 删除
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
               <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white shadow-sm flex items-center justify-center text-indigo-600">
                 {session.user?.email?.[0].toUpperCase() || 'A'}
               </div>
               <span className="hidden md:inline">{session.user?.email?.split('@')[0]}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {renderContent()}
        </div>
      </main>

      {/* Clear All Confirmation Modal */}
      {showClearNotifModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm overflow-hidden animate-zoom-in">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">确认清空通知中心?</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                此操作将永久删除列表中的 {notifications.length} 条通知消息，操作无法撤销。
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearNotifModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={confirmClearAllNotifications}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  确认清空
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
