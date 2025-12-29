import React from 'react';
import { Home, CreditCard, MessageSquare, FileText, CalendarClock } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const NAV_ITEMS = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'recharge', label: '充值', icon: CreditCard },
  { id: 'appointment', label: '预约', icon: CalendarClock },
  { id: 'history', label: '账单', icon: FileText },
  { id: 'feedback', label: '评价', icon: MessageSquare },
] as const;

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full">
      <div className="mx-auto max-w-md bg-white/90 backdrop-blur-lg border-t border-gray-200 pb-safe-area">
        <div className="flex items-center justify-around h-16">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${
                  isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon
                  size={24}
                  className={`mb-1 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.5px]' : 'stroke-2'
                  }`}
                />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;