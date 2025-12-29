
import React, { useState, useEffect } from 'react';
import { Search, MoreHorizontal, ChevronDown, Pencil, Save, Trash2, X, CreditCard, Wallet, Clock, DollarSign, ChevronLeft, ChevronRight, Diamond, Sparkles, Send } from 'lucide-react';
import { Customer, CustomerTier } from '../types';
import { SERVICES_CATALOG } from '../constants';
import { generateMarketingMessage } from '../services/geminiService';
import { sendAdminMessage } from '../services/dataService';

interface CustomerListProps {
  searchQuery: string;
  customers: Customer[];
  onUpdateCustomer: (id: string, updates: Partial<Customer>) => void;
  onDeleteCustomer: (id: string) => void;
  onAddTransaction: (customerId: string, service: string, amount: number) => void;
  onRechargeCustomer: (customerId: string, amount: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount: number;
}

const CustomerList: React.FC<CustomerListProps> = ({ 
  customers, 
  onUpdateCustomer, 
  onDeleteCustomer, 
  onAddTransaction, 
  onRechargeCustomer,
  currentPage,
  totalPages,
  onPageChange,
  totalCount
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  
  // Transaction & Recharge Modal States
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [txnForm, setTxnForm] = useState({ service: '', amount: 0 });
  const [rechargeAmount, setRechargeAmount] = useState(100);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Marketing AI State
  const [marketingMessage, setMarketingMessage] = useState('');
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
  const [marketingSent, setMarketingSent] = useState(false);

  useEffect(() => {
    if (selectedCustomer) {
      const updated = customers.find(c => c.id === selectedCustomer.id);
      if (updated) setSelectedCustomer(updated);
      if (updated?.id !== selectedCustomer.id) {
        setMarketingMessage('');
        setMarketingSent(false);
      }
    }
  }, [customers, selectedCustomer]);

  const getTierColor = (tier: CustomerTier) => {
    switch (tier) {
      case CustomerTier.PLATINUM: return 'bg-slate-800 text-slate-100 border-slate-600';
      case CustomerTier.GOLD: return 'bg-amber-100 text-amber-700 border-amber-200';
      case CustomerTier.SILVER: return 'bg-slate-100 text-slate-600 border-slate-200';
      case CustomerTier.BRONZE: return 'bg-orange-50 text-orange-600 border-orange-100';
      default: return 'bg-slate-50 text-slate-500';
    }
  };

  const handleEditClick = () => {
    if (selectedCustomer) {
      setEditForm({ ...selectedCustomer });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (selectedCustomer && editForm) {
      onUpdateCustomer(selectedCustomer.id, editForm);
      setIsEditing(false);
    }
  };

  const confirmDelete = () => {
    if (selectedCustomer) {
      onDeleteCustomer(selectedCustomer.id);
      setShowDeleteModal(false);
      setSelectedCustomer(null);
    }
  };

  const handleTxnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomer && txnForm.service && txnForm.amount > 0) {
      onAddTransaction(selectedCustomer.id, txnForm.service, Number(txnForm.amount));
      setShowTxnModal(false);
      setTxnForm({ service: '', amount: 0 });
    }
  };

  const handleServiceSelect = (service: { name: string, price: number }) => {
     setTxnForm({ service: service.name, amount: service.price });
  };

  const handleRechargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomer) {
      onRechargeCustomer(selectedCustomer.id, Number(rechargeAmount));
      setShowRechargeModal(false);
      setRechargeAmount(100);
    }
  };

  const generateMarketing = async () => {
    if (!selectedCustomer) return;
    setIsGeneratingMarketing(true);
    setMarketingSent(false);
    const msg = await generateMarketingMessage(selectedCustomer);
    setMarketingMessage(msg);
    setIsGeneratingMarketing(false);
  };

  const sendMarketing = async () => {
    if (!selectedCustomer || !marketingMessage) return;
    await sendAdminMessage(selectedCustomer.id, marketingMessage);
    setMarketingSent(true);
    setTimeout(() => {
       setMarketingSent(false);
       setMarketingMessage('');
    }, 2000);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Customer List */}
      <div className={`flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-all duration-300 ${selectedCustomer ? 'w-2/3 hidden md:flex' : 'w-full'}`}>
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              客户列表 
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs">
                总计 {totalCount}
              </span>
            </h3>
          </div>
        </div>
        
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-medium">客户姓名</th>
                <th className="p-4 font-medium">等级</th>
                <th className="p-4 font-medium hidden lg:table-cell">余额</th>
                <th className="p-4 font-medium hidden lg:table-cell">总消费</th>
                <th className="p-4 font-medium hidden lg:table-cell">最近光顾</th>
                <th className="p-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.length > 0 ? (
                customers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    onClick={() => { setSelectedCustomer(customer); setIsEditing(false); setMarketingMessage(''); }}
                    className={`group hover:bg-indigo-50/50 cursor-pointer transition-colors ${selectedCustomer?.id === customer.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500 pl-3' : 'border-l-4 border-transparent'}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={customer.avatarUrl} alt={customer.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                        <div>
                          <div className="font-semibold text-slate-800">{customer.name}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[120px]">
                            {customer.tags.slice(0, 2).join(', ')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getTierColor(customer.tier)}`}>
                        {customer.tier}
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell font-bold text-emerald-600">
                      ${customer.balance.toLocaleString()}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-slate-600 font-medium">
                      ${customer.totalSpent.toLocaleString()}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-slate-500">
                      {customer.lastVisit}
                    </td>
                    <td className="p-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                       <Search className="w-10 h-10 mb-3 opacity-20" />
                       <p>未找到符合条件的客户</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center">
           <span className="text-xs text-slate-500">
             显示 {((currentPage - 1) * 10) + 1} - {Math.min(currentPage * 10, totalCount)} 条，共 {totalCount} 条
           </span>
           <div className="flex gap-2">
              <button 
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 rounded-lg border border-slate-200">
                 {currentPage} / {Math.max(1, totalPages)}
              </div>
              <button 
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
           </div>
        </div>
      </div>

      {/* Sidebar */}
      {selectedCustomer && (
        <div className="w-full md:w-1/3 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-y-auto animate-slide-in-right fixed md:static inset-0 z-50 md:z-0">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-bold text-slate-800">客户档案</h3>
              <div className="flex gap-2">
                {!isEditing && (
                  <>
                    <button onClick={handleEditClick} className="p-2 hover:bg-indigo-50 rounded-full text-indigo-600 transition-colors" title="编辑档案">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowDeleteModal(true)} className="p-2 hover:bg-red-50 rounded-full text-red-500 transition-colors" title="删除档案">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center mb-6">
              <img src={selectedCustomer.avatarUrl} alt={selectedCustomer.name} className="w-24 h-24 rounded-full border-4 border-indigo-50 shadow-md mb-3" />
              
              {isEditing ? (
                <div className="w-full space-y-3">
                   <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1">姓名</label>
                     <input 
                       type="text" 
                       value={editForm.name}
                       onChange={e => setEditForm({...editForm, name: e.target.value})}
                       className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1">等级</label>
                     <select 
                       value={editForm.tier}
                       onChange={e => setEditForm({...editForm, tier: e.target.value as CustomerTier})}
                       className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
                     >
                        {Object.values(CustomerTier).map(tier => (
                          <option key={tier} value={tier}>{tier}</option>
                        ))}
                     </select>
                   </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-slate-900">{selectedCustomer.name}</h2>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getTierColor(selectedCustomer.tier)}`}>
                      {selectedCustomer.tier}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-emerald-50 p-3 rounded-xl text-center border border-emerald-100">
                <div className="text-emerald-600/70 text-xs mb-1 flex items-center justify-center gap-1"><Wallet className="w-3 h-3" /> 余额</div>
                <div className="font-bold text-emerald-600">${selectedCustomer.balance}</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl text-center border border-amber-100">
                <div className="text-amber-600/70 text-xs mb-1 flex items-center justify-center gap-1"><Diamond className="w-3 h-3" /> 积分</div>
                <div className="font-bold text-amber-600">{selectedCustomer.points || 0}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl text-center">
                <div className="text-slate-400 text-xs mb-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> 到店</div>
                <div className="font-bold text-slate-800">{selectedCustomer.visitCount}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl text-center">
                <div className="text-slate-400 text-xs mb-1 flex items-center justify-center gap-1"><DollarSign className="w-3 h-3" /> 总消费</div>
                <div className="font-bold text-slate-800">${selectedCustomer.totalSpent}</div>
              </div>
            </div>

            <div className="space-y-6">
              {!isEditing && (
                <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                  <h4 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> 智能营销
                  </h4>
                  
                  {!marketingMessage ? (
                     <button onClick={generateMarketing} disabled={isGeneratingMarketing} className="w-full py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                        {isGeneratingMarketing ? '正在分析消费习惯...' : '生成专属优惠文案'}
                     </button>
                  ) : (
                    <div className="animate-fade-in">
                       <textarea value={marketingMessage} onChange={(e) => setMarketingMessage(e.target.value)} className="w-full p-3 text-xs bg-white border border-indigo-200 rounded-lg text-slate-700 mb-3 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900" rows={3} />
                       <div className="flex gap-2">
                          <button onClick={() => setMarketingMessage('')} className="flex-1 py-2 border border-indigo-200 text-indigo-600 rounded-lg text-xs font-medium hover:bg-white">取消</button>
                          <button onClick={sendMarketing} disabled={marketingSent} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1">
                            {marketingSent ? '已发送' : <><Send className="w-3 h-3" /> 发送消息</>}
                          </button>
                       </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">备注信息</h4>
                {isEditing ? (
                   <textarea rows={4} value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"></textarea>
                ) : (
                   <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-600 text-sm">{selectedCustomer.notes || "暂无备注"}</div>
                )}
              </div>

              {!isEditing && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-slate-800">最近服务记录</h4>
                  </div>
                  <div className="space-y-3">
                    {selectedCustomer.history.length > 0 ? selectedCustomer.history.slice(0, 5).map(record => (
                      <div key={record.id} className="flex justify-between items-center text-sm p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                        <div>
                          <div className="font-medium text-slate-800">{record.service}</div>
                          <div className="text-slate-400 text-xs">{record.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-slate-700">{record.service.includes('充值') ? '+' : ''}${record.amount}</div>
                        </div>
                      </div>
                    )) : (
                       <div className="text-sm text-slate-400 text-center py-2">暂无消费记录</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="sticky bottom-0 p-4 bg-white border-t border-slate-100">
             {isEditing ? (
                <div className="flex gap-3">
                  <button onClick={() => { setIsEditing(false); setEditForm({}); }} className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium">取消</button>
                  <button onClick={handleSaveEdit} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"><Save className="w-4 h-4" /> 保存</button>
                </div>
             ) : (
               <div className="flex gap-2">
                 <button onClick={() => setShowRechargeModal(true)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"><Wallet className="w-4 h-4" /> 充值</button>
                 <button onClick={() => setShowTxnModal(true)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"><CreditCard className="w-4 h-4" /> 消费</button>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTxnModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md overflow-hidden animate-fade-in-up flex flex-col max-h-[85vh]">
             <div className="bg-emerald-600 p-4 flex justify-between items-center flex-shrink-0">
                <h3 className="text-white font-bold flex items-center gap-2"><CreditCard className="w-5 h-5" /> 记录新消费</h3>
                <button onClick={() => setShowTxnModal(false)} className="text-emerald-100 hover:text-white"><X className="w-5 h-5" /></button>
             </div>
             <form onSubmit={handleTxnSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                   <p className="text-xs text-slate-400 mb-2">点击下方服务快速填入：</p>
                   {SERVICES_CATALOG.map((s, idx) => (
                     <div key={idx} onClick={() => handleServiceSelect(s)} className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${txnForm.service === s.name ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-200 hover:bg-slate-50'}`}>
                        <span className={`font-medium ${txnForm.service === s.name ? 'text-emerald-800' : 'text-slate-700'}`}>{s.name}</span>
                        <span className={`font-bold ${txnForm.service === s.name ? 'text-emerald-600' : 'text-slate-500'}`}>${s.price}</span>
                     </div>
                   ))}
                   <div onClick={() => handleServiceSelect({ name: "自定义服务", price: 0 })} className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-center items-center text-slate-500 hover:bg-slate-50 border-dashed border-slate-300`}>
                      + 其他 / 自定义
                   </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3 flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                     <div className="flex gap-3">
                       <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1">服务名称</label>
                          <input type="text" value={txnForm.service} onChange={e => setTxnForm({...txnForm, service: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900" placeholder="输入或选择服务" autoFocus />
                       </div>
                       <div className="w-24">
                          <label className="block text-xs font-bold text-slate-500 mb-1">金额 ($)</label>
                          <input type="number" min="0" value={txnForm.amount} onChange={e => setTxnForm({...txnForm, amount: Number(e.target.value)})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 font-bold text-emerald-600" />
                       </div>
                     </div>
                     <div className="pt-2">
                        <button type="submit" disabled={!txnForm.service || txnForm.amount <= 0} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 transition-all flex justify-center items-center gap-2">
                          <span>确认记账</span>
                          <span className="bg-emerald-700/30 px-2 py-0.5 rounded text-sm">${txnForm.amount}</span>
                        </button>
                     </div>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm overflow-hidden animate-fade-in-up">
             <div className="bg-blue-600 p-4 flex justify-between items-center">
                <h3 className="text-white font-bold flex items-center gap-2"><Wallet className="w-5 h-5" /> 柜台充值</h3>
                <button onClick={() => setShowRechargeModal(false)} className="text-blue-100 hover:text-white"><X className="w-5 h-5" /></button>
             </div>
             <form onSubmit={handleRechargeSubmit} className="p-6 space-y-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">充值金额 ($)</label>
                   <input type="number" min="1" value={rechargeAmount} onChange={e => setRechargeAmount(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-900" autoFocus />
                </div>
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  <span className="font-bold">奖励：</span> 充值将获得 <span className="font-bold">{Math.floor(rechargeAmount)}</span> 积分。
                </div>
                <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">确认充值</button>
             </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm overflow-hidden border border-red-100">
            <div className="p-6 text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-2">确认删除?</h3>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl">取消</button>
                <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl">确认删除</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;
