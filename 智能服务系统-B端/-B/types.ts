
export enum CustomerTier {
  BRONZE = '青铜会员',
  SILVER = '白银会员',
  GOLD = '黄金会员',
  PLATINUM = '铂金会员',
}

export interface Transaction {
  id: string;
  date: string;
  service: string;
  amount: number;
  rating?: number;
}

export interface Customer {
  id: string;
  name: string;
  avatarUrl: string;
  tier: CustomerTier;
  tags: string[];
  visitCount: number;
  totalSpent: number;
  balance: number; 
  points: number;  
  lastVisit: string;
  notes: string;
  history: Transaction[]; // Reuse Transaction interface
  preferences: string[];
}

export interface DashboardStats {
  totalCustomers: number;
  totalRevenue: number;
  totalVisits: number;
  avgSatisfaction: string;
  tierDistribution: { name: string; count: number }[];
}

export interface AnalysisResult {
  estimatedAge: string;
  gender: string;
  mood: string;
  clothingStyle: string;
  distinctiveFeatures: string; // Visual fingerprint (e.g. "red glasses", "blue scarf")
  suggestedAction: string;
}

export interface VisitorLog {
  id: string;
  timestamp: Date;
  analysis: AnalysisResult;
  customer?: Customer; 
  isNew: boolean;
}

export interface FeedbackItem {
  id: string;
  customerName: string;
  date: string;
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  aiSummary: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'alert' | 'success';
  read: boolean;
}

export interface Appointment {
  id: string;
  customerId: string;
  customerName?: string;
  serviceName: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

export interface ChatMessage {
  id: string;
  customerId: string;
  sender: 'user' | 'bot' | 'admin';
  text: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  type: 'promotion' | 'event' | 'announcement';
  status: 'draft' | 'active' | 'ended';
  startDate: string;
  endDate: string;
  createdAt: string;
}

export type ViewState = 'dashboard' | 'scanner' | 'customers' | 'assistant' | 'feedback' | 'appointments' | 'chat' | 'marketing';
