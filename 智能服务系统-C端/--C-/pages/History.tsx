import React, { useEffect, useState } from 'react';
import { Calendar, Loader2, CreditCard, Plus, Ticket } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Customer, Transaction } from '../types';

interface HistoryPageProps { user: Customer; }

const HistoryPage: React.FC<HistoryPageProps> = ({ user }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTransactions(data || []);
      } catch (err) {
        console.error('Error fetching history:', err);
        setError('无法加载账单记录');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user.id]);

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
        <h1 className="text-2xl font-bold text-slate-900">账单明细</h1>
        <p className="text-sm text-gray-500 mt-1">查看您的所有充值与消费记录</p>
      </div>

      <div className="p-4">
        {error ? (
          <div className="text-center text-red-500 p-4 bg-red-50 rounded-lg">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Ticket size={48} className="mb-2 opacity-50" />
            <p>暂无交易记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const isRecharge = tx.service?.includes('充值');
              const dateObj = new Date(tx.created_at);

              return (
                <div key={tx.id} className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center space-x-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isRecharge ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-500'}`}>
                      {isRecharge ? <Plus size={20} /> : <CreditCard size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{tx.service}</h3>
                      <p className="text-xs text-gray-400 flex items-center mt-0.5">
                        <Calendar size={10} className="mr-1" />
                        {dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} {dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-base ${isRecharge ? 'text-green-600' : 'text-red-600'}`}>
                      {isRecharge ? '+' : '-'} ¥{tx.amount.toLocaleString()}
                    </p>
                    {isRecharge && (
                      <p className="text-[10px] font-medium text-amber-500 bg-amber-50 inline-block px-1.5 rounded mt-1">
                        +{Math.floor(tx.amount)} 积分
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;