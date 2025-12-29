import React, { useEffect, useState } from 'react';
import { Bell, Calendar, CheckCircle, Loader2, MailOpen } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Customer, Notification } from '../types';

interface NotificationsPageProps {
  user: Customer;
  onMarkRead: () => void;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({ user, onMarkRead }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNotifications(data || []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [user.id]);

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.is_read) return;

    try {
      // Optimistic UI update
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      onMarkRead(); // Decrease global count

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error marking as read:', err);
      // Revert if failed (omitted for simplicity in demo)
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="px-6 pt-12 pb-4 bg-white sticky top-0 z-10 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">消息中心</h1>
        <p className="text-sm text-gray-500 mt-1">查看您的资产变动与活动通知</p>
      </div>

      <div className="p-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bell size={48} className="mb-3 opacity-30" />
            <p>暂无新消息</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const dateObj = new Date(notif.created_at);
            const timeStr = dateObj.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={notif.id}
                onClick={() => handleMarkAsRead(notif)}
                className={`relative p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                  notif.is_read
                    ? 'bg-gray-50 border-gray-100'
                    : 'bg-white border-indigo-100 shadow-sm hover:shadow-md'
                }`}
              >
                {!notif.is_read && (
                  <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full shadow-sm"></div>
                )}
                
                <div className="flex items-start space-x-3">
                  <div className={`mt-1 rounded-full p-2 flex-shrink-0 ${
                    notif.is_read ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {notif.is_read ? <MailOpen size={16} /> : <Bell size={16} />}
                  </div>
                  <div className="flex-1 pr-4">
                    <h3 className={`text-sm font-bold mb-1 ${notif.is_read ? 'text-gray-600' : 'text-slate-900'}`}>
                      {notif.title}
                    </h3>
                    <p className={`text-xs leading-relaxed ${notif.is_read ? 'text-gray-400' : 'text-slate-600'}`}>
                      {notif.content}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 flex items-center">
                            <Calendar size={10} className="mr-1" /> {timeStr}
                        </span>
                        {notif.is_read && <CheckCircle size={12} className="text-green-500" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;