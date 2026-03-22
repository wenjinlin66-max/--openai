export enum CustomerTier {
  BRONZE = '青铜会员',
  SILVER = '白银会员',
  GOLD = '黄金会员',
  PLATINUM = '铂金会员',
}

export interface CustomerSettings {
  personalizedProfile: boolean;
  loginProtection: boolean;
  appointmentReminders: boolean;
  campaignReminders: boolean;
  afterSalesReminders: boolean;
}

export interface Customer {
  id: string;
  name: string;
  tier: CustomerTier | string;
  balance: number;
  points: number;
  total_spent: number;
  avatar_url?: string;
  nickname?: string;
  phone?: string;
  preferences?: string[];
  settings?: CustomerSettings;
}

export interface RechargePackage {
  id: string;
  name: string;
  price: number;
  value: number;
  benefits: string[];
  isPopular?: boolean;
  description?: string;
  scenes?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  price: number;
  durationMinutes?: number;
  description?: string;
  suitableFor?: string;
  category?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface Feedback {
  id?: string;
  customer_id: string;
  customer_name?: string;
  text: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  created_at?: string;
  appointment_id?: string;
  rating?: number;
  service_name?: string;
  request_type?: '投诉' | '申诉' | '售后咨询';
  request_status?: 'pending' | 'processing' | 'resolved' | 'rejected';
  handling_note?: string;
  handled_at?: string;
  handled_by?: string;
}

export interface Transaction {
  id: string;
  created_at: string;
  service: string;
  amount: number;
  rating?: number;
  customer_id: string;
}

export interface Notification {
  id: string;
  created_at: string;
  title: string;
  content: string;
  is_read: boolean;
  customer_id: string;
}

export interface Appointment {
  id: string;
  customer_id: string;
  service_name: string;
  appointment_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
}

export interface ChatMessage {
  id: string;
  customer_id: string;
  sender: 'user' | 'bot' | 'admin';
  text: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  type: 'promotion' | 'event' | 'announcement';
  start_date: string;
  end_date: string;
  status: 'active' | 'draft' | 'archived';
  image_url?: string;
  created_at: string;
  target_audience?: string[];
  clicks?: number;
}

export type TabType = 'home' | 'recharge' | 'feedback' | 'history' | 'notifications' | 'appointment' | 'chat' | 'profile';
