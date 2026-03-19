
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
  Bell,
  Trash2,
  CheckCircle,
  XCircle,
  Info,
  Building2
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
import NotificationCenter from './components/NotificationCenter';
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
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
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
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group mb-1
        ${currentView === view 
          ? 'bg-blue-50 text-blue-700 font-semibold' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
    >
      <Icon className={`w-5 h-5 ${currentView === view ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
      <span className="text-sm">{label}</span>
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
         <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
       </div>
     );
  }

  if (!session) {
    return <LoginScreen onLoginSuccess={() => {}} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative font-sans text-slate-800">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-slide-in-right backdrop-blur-sm ${
              t.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' :
              t.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800' :
              'bg-white/95 border-slate-200 text-slate-800'
            }`}
          >
            {t.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> :
             t.type === 'error' ? <XCircle className="w-5 h-5 text-red-500" /> :
             <Info className="w-5 h-5 text-blue-500" />}
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
        fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col p-4 shadow-xl transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:shadow-none md:flex
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="mb-6 px-3 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">CRIMS</h1>
            <p className="text-[10px] text-slate-500 font-medium">企业版 V2.0</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <div className="space-y-0.5">
            <NavItem view="dashboard" icon={LayoutDashboard} label="仪表盘" />
            <NavItem view="scanner" icon={ScanFace} label="智能扫描" />
            <NavItem view="customers" icon={Users} label="客户管理" />
            <NavItem view="appointments" icon={Calendar} label="预约管理" />
            <NavItem view="marketing" icon={Zap} label="营销中心" />
            <NavItem view="chat" icon={Headphones} label="客服中心" />
            <NavItem view="assistant" icon={MessageSquareMore} label="AI 助手" />
            <NavItem view="feedback" icon={Settings} label="反馈与评价" />
          </div>
        </nav>

        <div className="mt-auto space-y-4 pt-4 border-t border-slate-100">
           <div className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border ${isDbConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-500 border-red-200'}`}>
              <Database className="w-3 h-3" />
              {isDbConnected ? '系统已在线' : '离线模式'}
           </div>

           <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:text-red-600 transition-colors rounded-lg hover:bg-slate-50"
           >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">退出登录</span>
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
             <button 
               className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
               onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
             >
               <Menu className="w-6 h-6" />
             </button>

             <h2 className="text-lg font-bold text-slate-800 capitalize tracking-tight">
               {getHeaderTitle()}
             </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block group">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${searchQuery ? 'text-blue-500' : 'text-slate-400'}`} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={handleSearch}
                placeholder="搜索客户..." 
                className="pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-sm w-64 transition-all outline-none placeholder:text-slate-400 text-slate-700"
              />
            </div>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 transition-colors rounded-full ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {/* Use extracted NotificationCenter component */}
              {showNotifications && (
                <NotificationCenter
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAsRead={markAsRead}
                  onMarkAllAsRead={markAllAsRead}
                  onDelete={handleDeleteNotification}
                  onDeleteAll={handleDeleteAllNotifications}
                  onClose={() => setShowNotifications(false)}
                />
              )}
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-700 font-medium pl-2 border-l border-slate-200">
               <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
                 {session.user?.email?.[0].toUpperCase() || 'A'}
               </div>
               <span className="hidden md:inline text-slate-600">{session.user?.email?.split('@')[0]}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          {renderContent()}
        </div>
      </main>

      {/* Clear All Confirmation Modal */}
      {showClearNotifModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-sm overflow-hidden animate-zoom-in border border-slate-100">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">确认清空通知中心?</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                此操作将永久删除列表中的 {notifications.length} 条通知消息，操作无法撤销。
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearNotifModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={confirmClearAllNotifications}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm text-sm"
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