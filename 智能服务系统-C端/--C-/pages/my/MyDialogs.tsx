import React from 'react';
import { Loader2, Send } from 'lucide-react';
import { CustomerSettings, ServiceCatalogItem } from '../../types';
import { EditModalType, ServiceRequestType } from './shared';

interface RequestDialogProps {
  isOpen: boolean;
  requestType: ServiceRequestType;
  requestContent: string;
  isSubmitting: boolean;
  requestTypes: { type: ServiceRequestType; description: string }[];
  onClose: () => void;
  onTypeChange: (type: ServiceRequestType) => void;
  onContentChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const RequestDialog: React.FC<RequestDialogProps> = ({
  isOpen,
  requestType,
  requestContent,
  isSubmitting,
  requestTypes,
  onClose,
  onTypeChange,
  onContentChange,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">提交{requestType}</h3>
            <p className="mt-1 text-xs text-slate-400">请尽量描述具体情况，我们会尽快处理。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">关闭</button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {requestTypes.map((item) => (
            <button key={item.type} type="button" onClick={() => onTypeChange(item.type)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${requestType === item.type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {item.type}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="mt-4">
          <textarea value={requestContent} onChange={(event) => onContentChange(event.target.value)} placeholder={`请输入${requestType}内容，例如订单经过、问题描述、希望的处理方式等...`} className="h-36 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-300 focus:bg-white" maxLength={500} />
          <div className="mt-2 text-right text-xs text-slate-400">{requestContent.length}/500</div>
          <button type="submit" disabled={isSubmitting || !requestContent.trim()} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}提交{requestType}
          </button>
        </form>
      </div>
    </div>
  );
};

interface EditDialogProps {
  editModalType: EditModalType;
  draftNickname: string;
  draftPhone: string;
  draftPreferences: string[];
  draftSettings: CustomerSettings;
  serviceCatalog: ServiceCatalogItem[];
  isSavingEdit: boolean;
  saveMessage: string;
  onClose: () => void;
  onSave: () => void;
  onDraftNicknameChange: (value: string) => void;
  onDraftPhoneChange: (value: string) => void;
  onTogglePreference: (serviceName: string) => void;
  onDraftSettingsChange: (next: CustomerSettings) => void;
}

export const EditDialog: React.FC<EditDialogProps> = ({
  editModalType,
  draftNickname,
  draftPhone,
  draftPreferences,
  draftSettings,
  serviceCatalog,
  isSavingEdit,
  saveMessage,
  onClose,
  onSave,
  onDraftNicknameChange,
  onDraftPhoneChange,
  onTogglePreference,
  onDraftSettingsChange,
}) => {
  if (!editModalType) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {editModalType === 'nickname' && '编辑昵称'}
              {editModalType === 'phone' && '编辑手机号'}
              {editModalType === 'preferences' && '编辑偏好服务'}
              {editModalType === 'privacy' && '隐私说明'}
              {editModalType === 'security' && '账号安全'}
              {editModalType === 'notifications' && '消息提醒'}
            </h3>
            <p className="mt-1 text-xs text-slate-400">修改后将立即保存。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">关闭</button>
        </div>

        {(editModalType === 'nickname' || editModalType === 'phone') && (
          <div className="mt-4 space-y-3">
            <input value={editModalType === 'nickname' ? draftNickname : draftPhone} onChange={(event) => editModalType === 'nickname' ? onDraftNicknameChange(event.target.value) : onDraftPhoneChange(event.target.value)} placeholder={editModalType === 'nickname' ? '请输入新的昵称' : '请输入手机号'} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:bg-white" />
          </div>
        )}

        {editModalType === 'preferences' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {serviceCatalog.map((service) => {
              const selected = draftPreferences.includes(service.name);
              return (
                <button key={service.id} type="button" onClick={() => onTogglePreference(service.name)} className={`rounded-full px-3 py-2 text-xs font-medium ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {service.name}
                </button>
              );
            })}
          </div>
        )}

        {editModalType === 'privacy' && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="leading-6">您可以控制是否根据偏好为您展示更合适的服务与活动推荐。</p>
            <label className="mt-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3"><span className="text-sm font-medium text-slate-700">允许基于偏好优化推荐展示</span><input type="checkbox" checked={draftSettings.personalizedProfile} onChange={(event) => onDraftSettingsChange({ ...draftSettings, personalizedProfile: event.target.checked })} className="h-4 w-4" /></label>
          </div>
        )}

        {editModalType === 'security' && (
          <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3"><span className="font-medium text-slate-700">开启登录保护提示</span><input type="checkbox" checked={draftSettings.loginProtection} onChange={(event) => onDraftSettingsChange({ ...draftSettings, loginProtection: event.target.checked })} className="h-4 w-4" /></label>
          </div>
        )}

        {editModalType === 'notifications' && (
          <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            {[
              { key: 'appointmentReminders' as const, label: '预约提醒' },
              { key: 'campaignReminders' as const, label: '活动提醒' },
              { key: 'afterSalesReminders' as const, label: '售后进度提醒' },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3"><span className="font-medium text-slate-700">{item.label}</span><input type="checkbox" checked={draftSettings[item.key]} onChange={(event) => onDraftSettingsChange({ ...draftSettings, [item.key]: event.target.checked })} className="h-4 w-4" /></label>
            ))}
          </div>
        )}

        {saveMessage && <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{saveMessage}</div>}

        <button type="button" onClick={onSave} disabled={isSavingEdit} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
          {isSavingEdit ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}保存
        </button>
      </div>
    </div>
  );
};
