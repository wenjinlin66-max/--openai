
import React from 'react';
import { Bell, Trash2, X, Inbox, Check } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationCenterProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onDeleteAll: () => void;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onDeleteAll,
  onClose
}) => {
  return (
    <div className="absolute right-0 top-full mt-3 w-[400px] bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden animate-fade-in z-50 ring-1 ring-black/5">
      {/* Header - Professional Blue */}
      <div className="p-4 border-b border-blue-700 flex justify-between items-center bg-blue-600 sticky top-0 z-10 text-white">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Bell className="w-4 h-4" />
          通知中心
          {unreadCount > 0 && (
            <span className="bg-white text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-extrabold min-w-[20px] text-center">{unreadCount}</span>
          )}
        </h3>
        <div className="flex gap-2 text-xs font-medium items-center">
          {notifications.length > 0 && (
            <button 
              onClick={onDeleteAll} 
              className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1 transition-colors border border-white/10"
              title="清空所有通知"
            >
              <Trash2 className="w-3 h-3" /> 清空
            </button>
          )}
          {unreadCount > 0 && (
            <button onClick={onMarkAllAsRead} className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-1 rounded transition-colors">
              全部已读
            </button>
          )}
          <button onClick={onClose} className="text-white/60 hover:text-white ml-1 p-1 hover:bg-white/10 rounded-full">
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
              className="flex flex-col border-b border-slate-100 bg-white transition-all hover:bg-slate-50 group relative"
            >
              {/* Content Area */}
              <div className={`p-4 flex gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}>
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 shadow-sm ${!n.read ? 'bg-blue-600 ring-2 ring-blue-100' : 'bg-slate-300'}`}></div>
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
              <div className="px-4 py-2 bg-white border-t border-slate-50 flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-mono tracking-tight">{n.time}</span>
                
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!n.read && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onMarkAsRead(n.id); }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> 标为已读
                    </button>
                  )}
                  <button 
                    onClick={(e) => onDelete(e, n.id)}
                    className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> 删除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
