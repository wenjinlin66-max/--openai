export enum CustomerTier {
  BRONZE = '青铜会员',
  SILVER = '白银会员',
  GOLD = '黄金会员',
  PLATINUM = '铂金会员',
}

export interface Customer {
  id: string;
  name: string;
  tier: CustomerTier | string;
  balance: number;
  points: number;
  total_spent: number;
  avatar_url?: string;
}

export interface RechargePackage {
  id: string;
  name: string;
  price: number;
  value: number;
  benefits: string[];
  isPopular?: boolean;
}

export interface Feedback {
  id?: string;
  customer_id: string;
  customer_name?: string;
  text: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  created_at?: string;
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
}

export type TabType = 'home' | 'recharge' | 'feedback' | 'history' | 'notifications' | 'appointment' | 'chat';