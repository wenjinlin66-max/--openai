import React, { useEffect, useState } from 'react';
import { Edit2, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { RechargePackageItem } from '../types';
import { createRechargePackage, deleteRechargePackage, fetchRechargePackages, updateRechargePackage } from '../services/dataService';

interface RechargePackageManagerProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const EMPTY_FORM: Omit<RechargePackageItem, 'id'> = {
  name: '',
  price: 0,
  value: 0,
  benefits: [],
  description: '',
  scenes: [],
  isPopular: false,
  isActive: true,
  sortOrder: 100,
};

const RechargePackageManager: React.FC<RechargePackageManagerProps> = ({ showToast = () => {} }) => {
  const [packages, setPackages] = useState<RechargePackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<RechargePackageItem, 'id'>>(EMPTY_FORM);

  const loadPackages = async () => {
    setLoading(true);
    const data = await fetchRechargePackages();
    setPackages(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const startCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (pkg: RechargePackageItem) => {
    setIsCreating(false);
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      price: pkg.price,
      value: pkg.value,
      benefits: pkg.benefits || [],
      description: pkg.description || '',
      scenes: pkg.scenes || [],
      isPopular: pkg.isPopular ?? false,
      isActive: pkg.isActive ?? true,
      sortOrder: pkg.sortOrder ?? 100,
    });
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const saveForm = async () => {
    if (!form.name.trim()) {
      showToast('请先填写套餐名称', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        const created = await createRechargePackage(form);
        if (!created) throw new Error('create failed');
        showToast(`已新增套餐：${created.name}`, 'success');
      } else if (editingId) {
        const success = await updateRechargePackage(editingId, form);
        if (!success) throw new Error('update failed');
        showToast(`已更新套餐：${form.name}`, 'success');
      }
      cancelEdit();
      await loadPackages();
    } catch (error) {
      console.error(error);
      showToast('保存套餐失败，请稍后重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg: RechargePackageItem) => {
    if (!window.confirm(`确定删除套餐“${pkg.name}”吗？`)) return;
    const success = await deleteRechargePackage(pkg.id);
    if (success) {
      setPackages((prev) => prev.filter((item) => item.id !== pkg.id));
      showToast(`已删除套餐：${pkg.name}`, 'success');
    } else {
      showToast('删除失败，请稍后重试', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6 h-[calc(100vh-140px)]">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">充值套餐管理</h3>
            <p className="text-xs text-slate-400 mt-1">统一维护 C 端充值套餐名称、金额、到账价值与附加权益。</p>
          </div>
          <button onClick={startCreate} className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <Plus size={16} className="mr-1.5" />新增套餐
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : packages.length === 0 ? (
            <div className="text-center py-12 text-slate-400">暂无充值套餐，请先新增套餐。</div>
          ) : (
            packages.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-800">{pkg.name}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pkg.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {pkg.isActive ? '上架中' : '已下架'}
                      </span>
                      {pkg.isPopular && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-orange-50 text-orange-600">热销推荐</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span>支付 ¥{pkg.price}</span>
                      <span>到账 ¥{pkg.value}</span>
                      <span>排序 {pkg.sortOrder ?? 100}</span>
                    </div>
                    {pkg.description && <p className="mt-2 text-xs leading-5 text-slate-500">{pkg.description}</p>}
                    {pkg.benefits?.length > 0 && <p className="mt-1 text-xs leading-5 text-slate-400">权益：{pkg.benefits.join('、')}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(pkg)} className="rounded-full p-2 text-indigo-600 hover:bg-indigo-50"><Edit2 size={15} /></button>
                    <button onClick={() => handleDelete(pkg)} className="rounded-full p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{isCreating ? '新增套餐' : editingId ? '编辑套餐' : '套餐编辑器'}</h3>
          <p className="text-xs text-slate-400 mt-1">支持支付金额、到账金额、权益、场景和是否热门展示。</p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">套餐名称</label>
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300" placeholder="例如：基础充值" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">支付金额</label>
              <input type="number" min="0" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">到账金额</label>
              <input type="number" min="0" value={form.value} onChange={(e) => setForm((prev) => ({ ...prev, value: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">排序</label>
              <input type="number" value={form.sortOrder || 100} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300" />
            </div>
            <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 mt-6">
              <span className="text-sm font-medium text-slate-700">热销推荐</span>
              <input type="checkbox" checked={form.isPopular ?? false} onChange={(e) => setForm((prev) => ({ ...prev, isPopular: e.target.checked }))} className="h-4 w-4" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">套餐说明</label>
            <textarea value={form.description || ''} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 resize-none" placeholder="简要说明套餐适用场景与价值" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">权益（每行一条）</label>
            <textarea value={(form.benefits || []).join('\n')} onChange={(e) => setForm((prev) => ({ ...prev, benefits: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean) }))} className="h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 resize-none" placeholder="例如：获得 500 积分" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">适用场景（每行一条）</label>
            <textarea value={(form.scenes || []).join('\n')} onChange={(e) => setForm((prev) => ({ ...prev, scenes: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean) }))} className="h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 resize-none" placeholder="例如：适合月度到店保养需求" />
          </div>

          <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">上架状态</span>
            <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} className="h-4 w-4" />
          </label>
        </div>

        <div className="mt-auto p-5 border-t border-slate-100 flex gap-3">
          <button onClick={cancelEdit} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><X size={14} className="inline mr-1.5" />取消</button>
          <button onClick={saveForm} disabled={saving} className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? <Loader2 size={14} className="inline mr-1.5 animate-spin" /> : <Save size={14} className="inline mr-1.5" />}保存套餐</button>
        </div>
      </div>
    </div>
  );
};

export default RechargePackageManager;
