import React, { useEffect, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  Ticket,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Customer, Transaction } from '../types';

interface HistoryPageProps {
  user: Customer;
}

type HistoryFilter = 'all' | 'recharge' | 'expense';

const FILTER_OPTIONS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: '全部记录' },
  { key: 'recharge', label: '仅看充值' },
  { key: 'expense', label: '仅看消费' },
];

const isRechargeTransaction = (transaction: Transaction) => transaction.service?.includes('充值');

const formatMonthLabel = (dateString: string) =>
  new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
  });

const formatMonthKey = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const HistoryPage: React.FC<HistoryPageProps> = ({ user }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('transactions')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
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

  const filteredTransactions = transactions.filter((transaction) => {
    const isRecharge = isRechargeTransaction(transaction);

    if (activeFilter === 'recharge') return Boolean(isRecharge);
    if (activeFilter === 'expense') return !isRecharge;
    return true;
  });

  const filteredRechargeTotal = filteredTransactions
    .filter((transaction) => isRechargeTransaction(transaction) && transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const filteredExpenseTotal = filteredTransactions
    .filter((transaction) => !isRechargeTransaction(transaction) && transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const groupedTransactions = filteredTransactions.reduce<
    { monthKey: string; monthLabel: string; items: Transaction[] }[]
  >((groups, transaction) => {
    const monthKey = formatMonthKey(transaction.created_at);
    const monthLabel = formatMonthLabel(transaction.created_at);
    const existingGroup = groups.find((group) => group.monthKey === monthKey);

    if (existingGroup) {
      existingGroup.items.push(transaction);
      return groups;
    }

    groups.push({ monthKey, monthLabel, items: [transaction] });
    return groups;
  }, []);

  const currentFilterLabel = FILTER_OPTIONS.find((option) => option.key === activeFilter)?.label ?? '全部记录';

  const toggleMonthCollapsed = (monthKey: string) => {
    setCollapsedMonths((prev) => ({
      ...prev,
      [monthKey]: !(prev[monthKey] ?? false),
    }));
  };

  if (loading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      <div className="sticky top-0 z-10 bg-white px-6 pb-4 pt-12 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">账单明细</h1>
        <p className="mt-1 text-sm text-gray-500">查看您的所有充值与消费记录</p>
      </div>

      <div className="space-y-4 p-4 pb-36">
        {error ? (
          <div className="rounded-lg bg-red-50 p-4 text-center text-red-500">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Ticket size={48} className="mb-2 opacity-50" />
            <p>暂无交易记录</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 p-4 shadow-xs">
              <div>
                <p className="text-xs font-medium text-gray-500">当前账单总览</p>
                <p className="mt-1 text-xs text-gray-400">当前筛选：{currentFilterLabel}</p>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <p className="text-[11px] text-gray-500">累计充值</p>
                  <p className="mt-0.5 text-sm font-bold text-green-600">+ ¥{filteredRechargeTotal.toLocaleString()}</p>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-right">
                  <p className="text-[11px] text-gray-500">累计消费</p>
                  <p className="mt-0.5 text-sm font-bold text-red-600">- ¥{filteredExpenseTotal.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {FILTER_OPTIONS.map((option) => {
                  const isActive = option.key === activeFilter;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setActiveFilter(option.key)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-14 text-gray-400">
                <Ticket size={42} className="mb-2 opacity-50" />
                <p className="text-sm font-medium text-slate-500">当前筛选下暂无账单</p>
                <p className="mt-1 text-xs text-gray-400">你可以切换筛选查看其他记录</p>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedTransactions.map((group) => {
                  const monthRechargeTotal = group.items
                    .filter((transaction) => isRechargeTransaction(transaction) && transaction.amount > 0)
                    .reduce((sum, transaction) => sum + transaction.amount, 0);
                  const monthExpenseTotal = group.items
                    .filter((transaction) => !isRechargeTransaction(transaction) && transaction.amount > 0)
                    .reduce((sum, transaction) => sum + transaction.amount, 0);
                  const monthNet = monthRechargeTotal - monthExpenseTotal;
                  const isCollapsed = collapsedMonths[group.monthKey] ?? false;

                  return (
                    <section key={group.monthKey} className="space-y-3">
                      <button
                        type="button"
                        onClick={() => toggleMonthCollapsed(group.monthKey)}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-slate-50"
                      >
                        <div>
                          <h2 className="text-sm font-bold text-slate-700">{group.monthLabel}</h2>
                          <p className="mt-0.5 text-[11px] text-gray-400">共 {group.items.length} 条记录</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[11px] text-gray-400">当月净变化</p>
                            <p className={`mt-0.5 text-sm font-bold ${monthNet >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {monthNet >= 0 ? '+' : '-'} ¥{Math.abs(monthNet).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {isCollapsed ? <ChevronDown size={14} className="mr-1" /> : <ChevronUp size={14} className="mr-1" />}
                            {isCollapsed ? '展开' : '折叠'}
                          </div>
                        </div>
                      </button>

                      {!isCollapsed && (
                        <div className="space-y-3">
                          {group.items.map((transaction) => {
                            const isRecharge = isRechargeTransaction(transaction);
                            const dateObj = new Date(transaction.created_at);

                            return (
                              <div
                                key={transaction.id}
                                className={`relative flex items-center justify-between overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${
                                  isRecharge ? 'border-emerald-100' : 'border-rose-100'
                                }`}
                              >
                                <div
                                  className={`absolute left-0 top-0 h-full w-1 ${
                                    isRecharge ? 'bg-emerald-400' : 'bg-rose-400'
                                  }`}
                                />

                                <div className="flex items-center space-x-4 pl-1.5">
                                  <div
                                    className={`flex h-12 w-12 items-center justify-center rounded-full ring-4 ${
                                      isRecharge
                                        ? 'bg-emerald-100 text-emerald-600 ring-emerald-50'
                                        : 'bg-rose-50 text-rose-500 ring-rose-50'
                                    }`}
                                  >
                                    {isRecharge ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="text-sm font-bold leading-tight text-slate-900">{transaction.service}</h3>
                                      <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                          isRecharge
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-rose-50 text-rose-600'
                                        }`}
                                      >
                                        {isRecharge ? '充值入账' : '消费支出'}
                                      </span>
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                                      <span className="flex items-center">
                                        <Calendar size={10} className="mr-1" />
                                        {dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                                      </span>
                                      <span className="flex items-center">
                                        <Clock3 size={10} className="mr-1" />
                                        {dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <p className={`text-lg font-bold ${isRecharge ? 'text-green-600' : 'text-red-600'}`}>
                                    {isRecharge ? '+' : '-'} ¥{transaction.amount.toLocaleString()}
                                  </p>
                                  {isRecharge ? (
                                    <p className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                                      +{Math.floor(transaction.amount)} 积分
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-[10px] font-medium text-rose-400">已完成扣费</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
