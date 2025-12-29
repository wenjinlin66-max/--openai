import React, { useState } from 'react';
import { Check, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { PACKAGES } from '../constants';
import { supabase } from '../lib/supabaseClient';
import { Customer } from '../types';

interface RechargePageProps {
  user: Customer;
  onRechargeSuccess: () => void;
}

const RechargePage: React.FC<RechargePageProps> = ({ user, onRechargeSuccess }) => {
  const [selectedPkgId, setSelectedPkgId] = useState<string>(PACKAGES[1].id);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRecharge = async () => {
    const pkg = PACKAGES.find((p) => p.id === selectedPkgId);
    if (!pkg) return;

    setLoading(true);
    setMessage(null);

    try {
      // 1. Fetch fresh wallet data
      const { data: walletData, error: fetchError } = await supabase
        .from('wallets')
        .select('balance, points')
        .eq('customer_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentBalance = walletData?.balance ?? 0;
      const currentPoints = walletData?.points ?? 0;

      // 2. Update Wallet
      // Fix: Added { onConflict: 'customer_id' } to handle existing rows correctly
      const { error: walletUpdateError } = await supabase
        .from('wallets')
        .upsert({
          customer_id: user.id,
          balance: currentBalance + pkg.value,
          points: currentPoints + Math.floor(pkg.price),
        }, { onConflict: 'customer_id' });

      if (walletUpdateError) {
        console.error('Supabase Wallet Upsert Error:', walletUpdateError);
        throw new Error(walletUpdateError.message || '钱包更新失败');
      }

      // 3. Log Transaction (Fire and forget, but log error if any)
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          customer_id: user.id,
          service: '在线充值',
          amount: pkg.price,
          rating: 5
        });
      
      if (transactionError) console.warn('Transaction Log Error:', transactionError);

      setMessage({ type: 'success', text: `充值成功！余额 +${pkg.value}，积分 +${Math.floor(pkg.price)}` });
      onRechargeSuccess();
      
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Recharge Process Failed:', err);
      const errorText = err.message || '充值遇到问题，请重试或联系客服。';
      setMessage({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="px-6 pt-12 pb-4 bg-white">
        <h1 className="text-2xl font-bold text-slate-900">充值中心</h1>
        <p className="text-sm text-gray-500 mt-1">当前余额: <span className="font-bold text-indigo-600">¥{(user.balance || 0).toLocaleString()}</span></p>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 gap-4 mb-8">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => setSelectedPkgId(pkg.id)}
              className={`relative overflow-hidden rounded-xl border-2 p-5 transition-all duration-200 cursor-pointer ${
                selectedPkgId === pkg.id
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-md'
                  : 'border-white bg-white shadow-sm hover:border-gray-200'
              }`}
            >
              {pkg.isPopular && (
                <div className="absolute top-0 right-0 rounded-bl-xl bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1 text-[10px] font-bold text-white">
                  热销推荐
                </div>
              )}

              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-lg font-bold ${selectedPkgId === pkg.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {pkg.name}
                  </h3>
                  <div className="mt-2 space-y-1">
                    {pkg.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-center text-xs text-gray-500">
                        <Check size={12} className="mr-1 text-green-500" />
                        {benefit}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">¥{pkg.price}</p>
                    <p className="text-xs text-indigo-600 font-medium">到账 ¥{pkg.value}</p>
                </div>
              </div>
              
              {selectedPkgId === pkg.id && (
                  <div className="absolute bottom-2 right-2 text-indigo-600 opacity-10">
                      <Sparkles size={48} />
                  </div>
              )}
            </div>
          ))}
        </div>

        {message && (
          <div className={`mb-4 rounded-lg p-3 text-sm flex items-center ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.type === 'error' ? <AlertCircle size={16} className="mr-2" /> : <Check size={16} className="mr-2" />}
            {message.text}
          </div>
        )}

        <button
          onClick={handleRecharge}
          disabled={loading}
          className="w-full rounded-full bg-slate-900 py-4 text-white shadow-lg hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center text-lg font-bold transition-all active:scale-95"
        >
          {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />处理中...</> : '立即充值'}
        </button>
        
        <p className="text-center text-xs text-gray-400 mt-4">
            点击充值即代表同意《会员服务协议》
        </p>
      </div>
    </div>
  );
};

export default RechargePage;