
import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Wallet, Gem, TrendingUp, ChevronRight, Bell, MessageCircleQuestion, LogOut, X, Megaphone, CalendarHeart, MapPin } from 'lucide-react';
import { Customer, TabType, Campaign } from '../types';
import { TIER_STYLES } from '../constants';
import { supabase } from '../lib/supabaseClient';

interface HomePageProps {
  user: Customer;
  onNavigate: (tab: TabType) => void;
  unreadCount: number;
  onLogout: () => void;
}

// Sub-component for asset cards to reduce duplication
const AssetCard = ({ 
  icon: Icon, 
  color, 
  value, 
  label, 
  onClick 
}: { 
  icon: React.ElementType, 
  color: string, 
  value: string | number, 
  label: string, 
  onClick?: () => void 
}) => {
  const colorMap: Record<string, { bg: string, shadow: string }> = {
    indigo: { bg: 'bg-indigo-600', shadow: 'shadow-indigo-200' },
    amber: { bg: 'bg-amber-500', shadow: 'shadow-amber-200' },
    pink: { bg: 'bg-pink-500', shadow: 'shadow-pink-200' },
  };
  const style = colorMap[color] || colorMap.indigo;

  return (
    <div 
      onClick={onClick}
      className={`col-span-1 flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`mb-2 rounded-full ${style.bg} p-2.5 text-white shadow-md ${style.shadow}`}>
        <Icon size={20} />
      </div>
      <span className="text-xl font-bold text-slate-900 tracking-tight">{value}</span>
      <span className="text-xs font-medium text-gray-500 mt-1">{label}</span>
    </div>
  );
};

const HomePage: React.FC<HomePageProps> = ({ user, onNavigate, unreadCount, onLogout }) => {
  const gradientClass = TIER_STYLES[String(user.tier)] || 'from-indigo-500 to-purple-600';
  
  const [promotions, setPromotions] = useState<Campaign[]>([]);
  const [events, setEvents] = useState<Campaign[]>([]);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  // 1. Fetch Campaigns (Promotions & Events only)
  useEffect(() => {
    const fetchCampaigns = async () => {
      const now = new Date().toISOString();
      
      // STRICT FILTER: Active AND (start <= now) AND (end >= now)
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'active')
        .lte('start_date', now)
        .gte('end_date', now)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaigns:', error);
        return;
      }

      if (data) {
        // Filter Promotions (Banner)
        setPromotions(data.filter(c => c.type === 'promotion'));

        // Filter Events (List)
        setEvents(data.filter(c => c.type === 'event'));
      }
    };

    fetchCampaigns();

    // Realtime listener for new campaigns (Promotions/Events updates)
    const channel = supabase
      .channel('home-campaigns')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
        fetchCampaigns(); // Re-fetch on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  // 2. Auto-rotate Promotions
  useEffect(() => {
    if (promotions.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % promotions.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [promotions.length]);

  return (
    <div className="flex flex-col min-h-full bg-gray-50/50 relative">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 bg-white flex justify-between items-center sticky top-0 z-10 shadow-sm/50 backdrop-blur-md bg-white/90">
        <h1 className="text-2xl font-bold text-slate-900">会员中心</h1>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => onNavigate('notifications')}
            className="p-2 rounded-full hover:bg-gray-100 relative transition-colors"
          >
            <Bell size={20} className="text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm animate-pulse"></span>
            )}
          </button>
          <button 
            onClick={onLogout}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-slate-600"
            title="退出登录"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-20">
        {/* Membership Card */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradientClass} text-white shadow-xl shadow-orange-900/10 transform transition-all hover:scale-[1.02] duration-300`}>
          <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/20 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-32 w-32 rounded-full bg-black/10 blur-2xl"></div>
          
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-full border-2 border-white/30 overflow-hidden bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-lg font-bold">{user.name?.charAt(0)}</span>
                    )}
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-wide text-white drop-shadow-md">{user.name}</h2>
                  <div className="mt-1 inline-flex items-center rounded-full bg-black/20 px-2.5 py-0.5 text-xs font-medium text-white/90 backdrop-blur-md border border-white/10 shadow-sm">
                    <Gem size={10} className="mr-1.5" />
                    {user.tier}
                  </div>
                </div>
              </div>
              <QrCode className="text-white/80 cursor-pointer hover:text-white transition-colors" size={24} />
            </div>

            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-white/70 mb-1 font-medium">会员卡号</p>
                <p className="font-mono text-xs tracking-widest text-white/90 text-shadow-sm break-all">
                  {user.id}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Assets Grid */}
        <div className="grid grid-cols-3 gap-4">
          <AssetCard 
            icon={Wallet} 
            color="indigo" 
            value={`¥${(user.balance || 0).toLocaleString()}`} 
            label="余额" 
            onClick={() => onNavigate('history')} 
          />
          <AssetCard 
            icon={Gem} 
            color="amber" 
            value={(user.points || 0).toLocaleString()} 
            label="积分" 
          />
          <AssetCard 
            icon={TrendingUp} 
            color="pink" 
            value={`¥${(user.total_spent || 0).toLocaleString()}`} 
            label="总消费" 
            onClick={() => onNavigate('history')}
          />
        </div>

        {/* Promotions Banner Swiper (Type: Promotion) */}
        {promotions.length > 0 && (
          <div className="rounded-xl overflow-hidden shadow-md relative group h-40">
            {promotions.map((promo, idx) => (
              <div 
                key={promo.id} 
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out flex ${idx === currentPromoIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                {/* Background: Image or Gradient Fallback */}
                {promo.image_url ? (
                   <img 
                   src={promo.image_url} 
                   alt={promo.title} 
                   className="w-full h-full object-cover" 
                 />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-orange-500 to-red-600"></div>
                )}

                {/* Content Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-5">
                  <div className="transform transition-transform duration-500 translate-y-0">
                    <span className="inline-block px-2 py-0.5 rounded bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold mb-2">
                      限时优惠
                    </span>
                    <h3 className="text-white font-bold text-xl leading-tight mb-1">{promo.title}</h3>
                    <p className="text-white/90 text-xs line-clamp-1">{promo.description}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Indicators */}
            {promotions.length > 1 && (
              <div className="absolute bottom-3 right-3 z-20 flex space-x-1.5">
                {promotions.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentPromoIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} 
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming Events List (Type: Event) */}
        {events.length > 0 && (
           <div className="mt-2">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center text-lg">
                <CalendarHeart className="mr-2 text-indigo-600" size={20}/> 近期活动
              </h3>
              <div className="space-y-3">
                {events.map(event => {
                   const dateObj = new Date(event.start_date);
                   const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
                   const day = dateObj.getDate();
                   
                   return (
                      <div key={event.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center">
                          {/* Calendar Box */}
                          <div className="flex-shrink-0 w-14 h-14 bg-indigo-50 rounded-lg flex flex-col items-center justify-center text-indigo-600 border border-indigo-100 mr-4">
                              <span className="text-[10px] font-bold uppercase tracking-wider">{month}</span>
                              <span className="text-xl font-bold leading-none">{day}</span>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-slate-800 text-sm mb-1 truncate">{event.title}</h4>
                              <p className="text-xs text-gray-500 line-clamp-2">{event.description}</p>
                              <div className="mt-1 flex items-center text-[10px] text-gray-400">
                                  <MapPin size={10} className="mr-1"/> 线下门店
                              </div>
                          </div>

                          <ChevronRight size={16} className="text-gray-300 ml-2" />
                      </div>
                   )
                })}
              </div>
           </div>
        )}
      </div>

      {/* Floating Chat Button */}
      <div className="fixed bottom-24 left-0 right-0 mx-auto w-full max-w-md z-40 px-4 pointer-events-none">
        <div className="flex justify-end">
            <button 
                onClick={() => onNavigate('chat')}
                className="pointer-events-auto w-14 h-14 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-lg shadow-indigo-300/50 flex items-center justify-center text-white hover:scale-110 transition-transform active:scale-95"
            >
                <MessageCircleQuestion size={28} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
