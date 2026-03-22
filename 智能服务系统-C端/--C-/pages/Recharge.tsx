import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Sparkles,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Gem,
  Wallet,
  ChevronRight,
  BadgeCheck,
  PencilLine,
  X,
} from 'lucide-react';
import { PACKAGES } from '../constants';
import { supabase } from '../lib/supabaseClient';
import { Customer, RechargePackage } from '../types';
import { fetchActiveRechargePackages } from '../services/rechargePackages';

interface RechargePageProps {
  user: Customer;
  onRechargeSuccess: () => void;
}

const tierDescriptions: Record<string, string> = {
  青铜会员: '适合首次体验门店服务的顾客，享基础储值与积分累计权益。',
  白银会员: '适合稳定到店用户，可逐步享受更高积分价值与活动优先通知。',
  黄金会员: '适合高频消费客户，可享更多高端项目推荐与活动优先参与机会。',
  铂金会员: '适合核心会员，强调专属服务体验、优先预约与高价值礼遇。',
};

const packageDescriptions: Record<string, string> = {
  p1: '适合首次储值或临时补充余额，快速完成单次服务消费。',
  p2: '适合月度护理与剪裁类消费，兼顾储值效率和轻量礼遇。',
  p3: '适合重视长期护理与尊享服务体验的高频到店会员。',
};

const packageScenes: Record<string, string[]> = {
  p1: ['单次剪裁后快速结算', '首次体验门店储值流程'],
  p2: ['搭配护理与剪裁组合消费', '适合月度到店保养需求'],
  p3: ['适合高端染烫与护理项目', '更适合重视专属礼遇的会员'],
};

const RechargePage: React.FC<RechargePageProps> = ({ user, onRechargeSuccess }) => {
  const [packages, setPackages] = useState<RechargePackage[]>(PACKAGES);
  const [selectedPkgId, setSelectedPkgId] = useState<string>(PACKAGES[1].id);
  const [rechargeMode, setRechargeMode] = useState<'package' | 'custom'>('package');
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [successModal, setSuccessModal] = useState<null | { amount: number; value: number; points: number }>(null);

  useEffect(() => {
    fetchActiveRechargePackages().then((data) => {
      if (data.length > 0) {
        setPackages(data);
        setSelectedPkgId((current) => (data.some((pkg) => pkg.id === current) ? current : data[0].id));
      }
    });
  }, []);

  const handleCloseSuccessModal = () => {
    setSuccessModal(null);
    onRechargeSuccess();
  };

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPkgId) ?? packages[0] ?? PACKAGES[0],
    [packages, selectedPkgId]
  );

  const parsedCustomAmount = Number(customAmount);
  const isValidCustomAmount = Number.isFinite(parsedCustomAmount) && parsedCustomAmount >= 50;

  const rechargeAmount = rechargeMode === 'custom'
    ? (isValidCustomAmount ? parsedCustomAmount : 0)
    : selectedPackage.price;

  const arrivalAmount = rechargeMode === 'custom'
    ? rechargeAmount
    : selectedPackage.value;

  const pointsReward = Math.floor(rechargeAmount);

  const activeTitle = rechargeMode === 'custom' ? '自定义充值' : selectedPackage.name;
  const activeBenefits = rechargeMode === 'custom'
    ? ['按实际支付金额到账', `可获得 ${pointsReward} 积分`, '适合临时补充账户余额']
    : selectedPackage.benefits;

  const handleRecharge = async () => {
    if (rechargeMode === 'custom' && !isValidCustomAmount) {
      setMessage({ type: 'error', text: '自定义充值金额最低为 50 元，请重新输入。' });
      return;
    }

    const pkg = packages.find((p) => p.id === selectedPkgId);
    const paymentAmount = rechargeMode === 'custom' ? rechargeAmount : (pkg?.price ?? 0);
    const valueAmount = rechargeMode === 'custom' ? rechargeAmount : (pkg?.value ?? 0);

    if (rechargeMode === 'package' && !pkg) return;

    setLoading(true);
    setMessage(null);

    try {
      const { data: walletData, error: fetchError } = await supabase
        .from('wallets')
        .select('balance, points')
        .eq('customer_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentBalance = walletData?.balance ?? 0;
      const currentPoints = walletData?.points ?? 0;

      const { error: walletUpdateError } = await supabase
        .from('wallets')
        .upsert(
          {
            customer_id: user.id,
            balance: currentBalance + valueAmount,
            points: currentPoints + Math.floor(paymentAmount),
          },
          { onConflict: 'customer_id' }
        );

      if (walletUpdateError) {
        console.error('Supabase Wallet Upsert Error:', walletUpdateError);
        throw new Error(walletUpdateError.message || '钱包更新失败');
      }

      const { error: transactionError } = await supabase.from('transactions').insert({
        customer_id: user.id,
        service: rechargeMode === 'custom' ? '自定义金额充值（在线充值）' : `${pkg?.name}（在线充值）`,
        amount: paymentAmount,
        rating: 5,
      });

      if (transactionError) console.warn('Transaction Log Error:', transactionError);

      setMessage({
        type: 'success',
        text: `充值成功！已到账 ¥${valueAmount}，积分 +${Math.floor(paymentAmount)}，可在账单明细中查看本次记录。`,
      });
      setSuccessModal({
        amount: paymentAmount,
        value: valueAmount,
        points: Math.floor(paymentAmount),
      });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: unknown) {
      console.error('Recharge Process Failed:', err);
      const errorText = err instanceof Error ? err.message : '充值遇到问题，请重试或联系客服。';
      setMessage({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-[#f5f6fa] text-slate-900">
      <div className="px-6 pt-12 pb-5 bg-white border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">会员充值中心</h1>
            <p className="text-sm text-slate-500 mt-1">安全储值，到账后可直接用于预约消费与护理结算</p>
          </div>
          <div className="rounded-full bg-emerald-50 text-emerald-600 px-3 py-1 text-xs font-semibold border border-emerald-100">
            安全支付
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white p-5 shadow-xl shadow-slate-900/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-white/70 mb-1">当前会员身份</p>
              <div className="flex items-center gap-2">
                <BadgeCheck size={16} className="text-amber-300" />
                <span className="font-semibold">{user.tier}</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
              <Wallet size={20} className="text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 border border-white/10 p-3 backdrop-blur-sm">
              <p className="text-[11px] text-white/65 mb-1">当前余额</p>
              <p className="text-2xl font-bold tracking-tight">¥{(user.balance || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/10 p-3 backdrop-blur-sm">
              <p className="text-[11px] text-white/65 mb-1">当前积分</p>
              <p className="text-2xl font-bold tracking-tight">{(user.points || 0).toLocaleString()}</p>
            </div>
          </div>

          <p className="text-xs text-white/70 mt-4 leading-5">{tierDescriptions[String(user.tier)] || '当前会员可享受储值、积分累计及指定活动权益。'}</p>
        </div>
      </div>

        <div className="p-4 space-y-5 pb-64">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRechargeMode('package')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              rechargeMode === 'package'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-50 text-slate-500'
            }`}
          >
            套餐充值
          </button>
          <button
            type="button"
            onClick={() => setRechargeMode('custom')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              rechargeMode === 'custom'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-50 text-slate-500'
            }`}
          >
            自定义金额
          </button>
        </div>

        {rechargeMode === 'custom' && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PencilLine size={18} className="text-indigo-500" />
                  自定义充值金额
                </h3>
                <p className="text-sm text-slate-500 mt-1">适合临时补充余额或按照个人预算灵活储值</p>
              </div>
              <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 border border-indigo-100">
                灵活到账
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <label className="block text-xs font-semibold tracking-wide text-slate-500 mb-2">请输入充值金额（元）</label>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-2xl font-bold text-slate-900 mr-2">¥</span>
                <input
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="例如 300"
                  className="w-full text-2xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[200, 300, 800, 1500].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setCustomAmount(String(amount))}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                  >
                    ¥{amount}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">最低充值金额为 50 元，充值金额将按实际金额到账并同步累计积分。</p>
            </div>
          </div>
        )}

        {rechargeMode === 'package' && (
          <div className="grid grid-cols-1 gap-4">
            {packages.map((pkg) => {
            const isSelected = selectedPkgId === pkg.id;
            const bonusPoints = Math.floor(pkg.price);

            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPkgId(pkg.id)}
                className={`relative overflow-hidden rounded-2xl border text-left p-5 transition-all duration-200 ${
                  isSelected
                    ? 'border-indigo-500 bg-white shadow-lg shadow-indigo-100 ring-2 ring-indigo-100'
                    : 'border-slate-200 bg-white shadow-sm active:scale-[0.99]'
                }`}
              >
                {pkg.isPopular && (
                  <div className="absolute top-0 right-0 rounded-bl-2xl bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1 text-[10px] font-bold text-white tracking-wide">
                    热销推荐
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`text-xl font-bold tracking-tight ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>{pkg.name}</h3>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-100">
                          <Sparkles size={12} /> 已选择
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-500 leading-6">{pkg.description || packageDescriptions[pkg.id] || '适合会员储值消费与积分累计。'}</p>

                    <div className="mt-3 space-y-1.5">
                      {pkg.benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-center text-xs text-slate-600">
                          <Check size={12} className="mr-2 text-emerald-500 shrink-0" />
                          {benefit}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-slate-400 mb-1">支付金额</p>
                    <p className="text-3xl font-bold tracking-tight text-slate-900">¥{pkg.price}</p>
                    <p className="text-xs font-semibold text-indigo-600 mt-1">到账 ¥{pkg.value}</p>
                    <p className="text-[11px] text-amber-500 mt-1">赠 {bonusPoints} 积分</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(pkg.scenes || packageScenes[pkg.id] || []).map((scene) => (
                    <div key={scene} className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 border border-slate-100">
                      {scene}
                    </div>
                  ))}
                </div>
              </button>
            );
            })}
          </div>
        )}

        {rechargeMode === 'custom' && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-indigo-500 font-semibold mb-1">当前方案</p>
                <p className="font-bold text-slate-900 truncate">{activeTitle}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{activeBenefits[0]}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-slate-500">支付 / 到账</p>
                <p className="text-lg font-bold text-slate-900">¥{rechargeAmount.toLocaleString()}</p>
                <p className="text-xs text-indigo-600 mt-0.5">+{Math.floor(rechargeAmount)} 积分</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-emerald-500 mt-0.5 shrink-0" />
            <span>支付成功后将自动写入账户余额，并同步生成交易流水，方便后续在账单明细中追踪。</span>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-2xl p-4 text-sm flex items-start gap-3 shadow-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-red-50 text-red-700 border border-red-100'
            }`}
          >
            {message.type === 'error' ? (
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
            ) : (
              <Check size={18} className="mt-0.5 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 mx-auto w-full max-w-md px-4 pb-4 z-30 pointer-events-none">
        <div className="rounded-[28px] bg-white/95 backdrop-blur border border-slate-200 shadow-2xl shadow-slate-900/10 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span>本次选择：{activeTitle}</span>
            <span>支付 ¥{rechargeAmount.toLocaleString()}</span>
          </div>

          <button
            onClick={handleRecharge}
            disabled={loading || rechargeAmount <= 0}
            className="w-full rounded-full bg-slate-900 py-4 text-white shadow-lg hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center text-lg font-bold transition-all active:scale-95 pointer-events-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                正在处理充值...
              </>
            ) : (
              <>
                立即充值并到账
                <ChevronRight size={18} className="ml-1" />
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-400 mt-3 leading-5 pointer-events-auto">
            点击按钮即代表您已阅读并同意《会员服务协议》，充值记录可在“账单明细”页面查看。
          </p>
        </div>
      </div>

      {successModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center px-5">
          <div className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl shadow-slate-900/20 overflow-hidden animate-[fadeIn_.2s_ease-out]">
            <div className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-slate-900 px-6 pt-7 pb-6 text-white">
              <button
                type="button"
                onClick={handleCloseSuccessModal}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center border border-white/10"
              >
                <X size={16} />
              </button>
              <div className="w-14 h-14 rounded-full bg-white/15 border border-white/20 flex items-center justify-center mb-4">
                <Check size={28} />
              </div>
              <p className="text-sm text-white/80 mb-1">充值成功</p>
              <h3 className="text-2xl font-bold tracking-tight">账户余额已更新</h3>
              <p className="text-sm text-white/80 mt-2 leading-6">本次储值已到账，您现在可以继续预约服务或前往账单页面查看明细。</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-[11px] text-slate-500 mb-1">支付金额</p>
                  <p className="text-xl font-bold text-slate-900">¥{successModal.amount.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-[11px] text-slate-500 mb-1">到账金额</p>
                  <p className="text-xl font-bold text-slate-900">¥{successModal.value.toLocaleString()}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] text-amber-600 font-semibold mb-1">本次获得积分</p>
                  <p className="text-lg font-bold text-slate-900">+{successModal.points}</p>
                </div>
                <Gem size={22} className="text-amber-500 shrink-0" />
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCloseSuccessModal}
                  className="w-full rounded-full bg-slate-900 py-3.5 text-white font-semibold"
                >
                  我知道了
                </button>
                <p className="text-center text-[11px] text-slate-400">如需核对充值记录，可前往“账单明细”页面查看最新流水。</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RechargePage;
