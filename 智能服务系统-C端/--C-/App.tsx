
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Bell, X, Megaphone } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { Customer, CustomerTier, TabType, Campaign } from './types';
import { Session } from '@supabase/supabase-js';

// Components
import BottomNav from './components/BottomNav';
import HomePage from './pages/Home';
import RechargePage from './pages/Recharge';
import FeedbackPage from './pages/Feedback';
import HistoryPage from './pages/History';
import NotificationsPage from './pages/Notifications';
import AppointmentPage from './pages/Appointment';
import ChatPage from './pages/Chat';
import LoginPage from './pages/Login';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [user, setUser] = useState<Customer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [toast, setToast] = useState<{ show: boolean; message: string } | null>(null);

  // Announcement State
  const [announcement, setAnnouncement] = useState<Campaign | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  const triggerRefresh = useCallback(() => setRefreshTrigger(prev => prev + 1), []);

  // 1. Handle Session Initialization
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false); // If no session, stop loading to show Login
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch User Data (Only when session exists)
  const fetchUserData = useCallback(async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const userId = session.user.id;
      const userEmail = session.user.email;

      const [customerRes, walletRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', userId).maybeSingle(),
        supabase.from('wallets').select('balance, points').eq('customer_id', userId).maybeSingle()
      ]);

      if (customerRes.error && customerRes.error.code !== 'PGRST116') throw customerRes.error;

      // If customer exists in DB
      if (customerRes.data) {
        setUser({
          ...(customerRes.data as Customer),
          balance: walletRes.data?.balance ?? 0,
          points: walletRes.data?.points ?? 0,
          total_spent: customerRes.data.total_spent ?? 0,
        });
      } else {
        // New user logged in but not in 'customers' table yet.
        // AUTO-REGISTER: Create records in DB so B-side can see them.
        console.log("New user detected. Creating profile in database...");
        
        const newName = userEmail?.split('@')[0] || `Member-${userId.slice(0, 6)}`;
        
        // 1. Insert Customer
        const { error: insertCustError } = await supabase.from('customers').insert({
          id: userId,
          name: newName,
          tier: CustomerTier.BRONZE,
          total_spent: 0,
          avatar_url: '',
          created_at: new Date().toISOString()
        });

        if (insertCustError) {
          console.error("Failed to create customer record:", insertCustError);
          throw insertCustError;
        }

        // 2. Insert Wallet
        const { error: insertWalletError } = await supabase.from('wallets').insert({
          customer_id: userId,
          balance: 0,
          points: 0
        });

        if (insertWalletError) {
           console.error("Failed to create wallet record:", insertWalletError);
        }

        // 3. Set Local State
        setUser({
            id: userId,
            name: newName,
            tier: CustomerTier.BRONZE,
            balance: 0,
            points: 0,
            total_spent: 0,
            avatar_url: '',
        });
      }

    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.id) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', session.user.id)
      .eq('is_read', false);
    
    setUnreadCount(count || 0);
  }, [session]);

  // Fetch Announcement (Global)
  useEffect(() => {
    if (!session) return;

    const fetchAnnouncement = async () => {
      const now = new Date().toISOString();
      
      try {
        // STRICT FILTER LOGIC: status=active AND start_date <= now AND end_date >= now
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('type', 'announcement')
          .eq('status', 'active')
          .lte('start_date', now)
          .gte('end_date', now)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          setAnnouncement(data[0]);
          // DEBUG MODE: Always show
          setShowAnnouncementModal(true);
        }
      } catch (err) {
        console.error("Error fetching announcement:", err);
      }
    };

    fetchAnnouncement();

    // Realtime listener for campaigns (Announcements)
    // This ensures if admin activates a new announcement, it pops up immediately.
    const channel = supabase
      .channel('global-announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' }, 
        (payload) => {
            const newCampaign = payload.new as Campaign;
            if (newCampaign && newCampaign.type === 'announcement') {
                fetchAnnouncement();
            }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, refreshTrigger]); 

  useEffect(() => {
    if (session) {
      fetchUserData();
      fetchUnreadCount();
    }
  }, [session, fetchUserData, fetchUnreadCount, refreshTrigger]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `customer_id=eq.${session.user.id}`,
        },
        (payload) => {
          setUnreadCount((prev) => prev + 1);
          setToast({ show: true, message: payload.new.title || '收到一条新消息' });
          setTimeout(() => setToast(null), 4000);
          triggerRefresh(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, triggerRefresh]);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // If not logged in, show Login Page
  if (!session) {
    return <LoginPage />;
  }

  const renderContent = () => {
    if (!user) return null;
    switch (activeTab) {
      case 'home': return <HomePage user={user} onNavigate={setActiveTab} unreadCount={unreadCount} onLogout={handleLogout} />;
      case 'recharge': return <RechargePage user={user} onRechargeSuccess={triggerRefresh} />;
      case 'history': return <HistoryPage user={user} />;
      case 'notifications': return <NotificationsPage user={user} onMarkRead={() => setUnreadCount(prev => Math.max(0, prev - 1))} />;
      case 'feedback': return <FeedbackPage user={user} />;
      case 'appointment': return <AppointmentPage user={user} />;
      case 'chat': return <ChatPage user={user} onBack={() => setActiveTab('home')} />;
      default: return <HomePage user={user} onNavigate={setActiveTab} unreadCount={unreadCount} onLogout={handleLogout} />;
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 font-sans text-slate-800 relative">
      {toast?.show && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[60] w-11/12 max-w-sm animate-in slide-in-from-top-5 fade-in duration-300 pointer-events-auto">
          <div className="bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 rounded-full shadow-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-500 p-1.5 rounded-full">
                <Bell size={14} className="text-white" />
              </div>
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
            <button 
              onClick={() => { setToast(null); setActiveTab('notifications'); }}
              className="text-xs text-indigo-300 hover:text-white font-bold ml-4"
            >
              查看
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-24 custom-scrollbar h-full">
        <div className="mx-auto max-w-md bg-white shadow-sm min-h-full relative h-full">
          {renderContent()}
        </div>
      </main>

      {activeTab !== 'chat' && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* Global Announcement Modal - Lifted to Root */}
      {showAnnouncementModal && announcement && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 relative">
            {/* Close Button */}
            <button 
              onClick={() => setShowAnnouncementModal(false)}
              className="absolute top-3 right-3 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors z-10"
            >
              <X size={18} className="text-slate-800" />
            </button>

            <div className="h-32 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center relative">
               <Megaphone size={48} className="text-white/90 drop-shadow-md" />
               <div className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-white to-transparent"></div>
            </div>

            <div className="p-6 pt-2 text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-3">{announcement.title}</h3>
              <div className="text-sm text-gray-600 leading-relaxed mb-6 bg-gray-50 p-3 rounded-lg text-left border border-gray-100 max-h-40 overflow-y-auto custom-scrollbar">
                {announcement.description}
              </div>
              <button 
                onClick={() => setShowAnnouncementModal(false)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-transform active:scale-95"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
