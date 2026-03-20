import type { ElementType } from 'react';
import { CustomerSettings, Feedback, ServiceCatalogItem } from '../../types';

export type ServiceRequestType = '投诉' | '申诉' | '售后咨询';
export type MyPanelKey = 'home' | 'profile' | 'member' | 'settings' | 'store' | 'afterSales';
export type EditModalType = null | 'nickname' | 'phone' | 'preferences' | 'privacy' | 'security' | 'notifications';
export type RequestStatus = 'pending' | 'processing' | 'resolved' | 'rejected';
export type AppointmentRecordTab = 'all' | 'pending' | 'confirmed' | 'completedPendingReview' | 'completedReviewed' | 'cancelled';
export type MemberSectionTab = 'overview' | 'growth' | 'benefits' | 'recommendations';

export interface ServiceRequestRecord {
  id: string;
  type: ServiceRequestType;
  content: string;
  sentiment: Feedback['sentiment'];
  created_at: string;
  request_status?: RequestStatus;
  handling_note?: string;
  handled_at?: string;
}

export interface ProfileState {
  nickname: string;
  phone: string;
  preferredServices: string[];
}

export interface MyMetrics {
  activeAppointmentsCount: number;
  transactionCount: number;
  pendingReviewCount: number;
}

export interface RecommendationCard {
  title: string;
  description: string;
  tag: string;
  targetServiceName?: string;
  icon: ElementType;
}

export const DEFAULT_SETTINGS: CustomerSettings = {
  personalizedProfile: true,
  loginProtection: true,
  appointmentReminders: true,
  campaignReminders: true,
  afterSalesReminders: true,
};

export const PANEL_META: Record<Exclude<MyPanelKey, 'home'>, { title: string; subtitle: string }> = {
  profile: { title: '个人资料', subtitle: '查看与编辑头像、昵称、手机号及偏好服务' },
  member: { title: '会员信息', subtitle: '查看会员等级、积分余额与当前权益' },
  settings: { title: '隐私 / 账号设置', subtitle: '管理隐私偏好、账号安全与消息提醒' },
  store: { title: '联系门店', subtitle: '查看门店地址、营业时间与在线咨询入口' },
  afterSales: { title: '售后服务', subtitle: '提交投诉、申诉、售后咨询并查看真实处理进度' },
};

export const GROWTH_LEVELS = [
  { tier: '青铜会员', min: 0, next: 1200 },
  { tier: '白银会员', min: 1200, next: 3600 },
  { tier: '黄金会员', min: 3600, next: 8000 },
  { tier: '铂金会员', min: 8000, next: null },
];

export const getMaskedPhone = (phone?: string) => {
  if (!phone) return '未绑定手机号';
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.length < 7) return phone;
  return `${cleaned.slice(0, 3)}****${cleaned.slice(-4)}`;
};

export const normalizeSettings = (settings?: Partial<CustomerSettings> | null): CustomerSettings => ({
  ...DEFAULT_SETTINGS,
  ...(settings || {}),
});

export const getStatusMeta = (status?: RequestStatus) => {
  switch (status) {
    case 'processing':
      return { label: '处理中', className: 'bg-blue-50 text-blue-600' };
    case 'resolved':
      return { label: '已回访', className: 'bg-emerald-50 text-emerald-600' };
    case 'rejected':
      return { label: '已驳回', className: 'bg-rose-50 text-rose-500' };
    case 'pending':
    default:
      return { label: '待受理', className: 'bg-amber-50 text-amber-600' };
  }
};

export const parseRequestType = (feedback: Pick<Feedback, 'request_type' | 'text'>): ServiceRequestType | null => {
  if (feedback.request_type) return feedback.request_type;
  const text = feedback.text?.trim() || '';
  if (text.startsWith('【投诉】')) return '投诉';
  if (text.startsWith('【申诉】')) return '申诉';
  if (text.startsWith('【售后咨询】')) return '售后咨询';
  return null;
};

export const stripRequestPrefix = (text: string) => text.replace(/^【(投诉|申诉|售后咨询)】\s*/, '').trim();

export const buildPreferenceDraft = (serviceCatalog: ServiceCatalogItem[], current: string[]) => {
  if (current.length > 0) return current;
  return serviceCatalog.slice(0, 3).map((service) => service.name);
};
