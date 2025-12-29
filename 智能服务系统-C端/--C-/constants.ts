
import { RechargePackage } from './types';

// 指定的当前登录用户 ID
export const CURRENT_USER_ID = 'af549ab7-b84e-419b-b8f2-46a30b312ab0';

export const PACKAGES: RechargePackage[] = [
  { id: 'p1', name: '基础充值', price: 100, value: 100, benefits: ['获得 100 积分'], isPopular: false },
  { id: 'p2', name: '进阶充值', price: 500, value: 500, benefits: ['获得 500 积分', '赠送饮品券'], isPopular: true },
  { id: 'p3', name: '豪华充值', price: 1000, value: 1000, benefits: ['获得 1000 积分', '免排队权益', '专属客服'], isPopular: false }
];

export const SERVICES_LIST = [
  { name: '资深设计总监剪裁', price: 380 },
  { name: '奢华鱼子酱头皮护理', price: 680 },
  { name: '高定色彩美学染发', price: 1680 },
  { name: '日式空气感纹理烫', price: 1280 },
  { name: '男士尊享复古油头', price: 280 },
  { name: '卡诗黑钻鱼子酱护理', price: 980 }
];

export const TIER_STYLES: Record<string, string> = {
  '青铜会员': 'from-orange-500 via-orange-600 to-amber-700', // Richer Orange
  '白银会员': 'from-slate-400 via-slate-500 to-slate-600', // Richer Silver
  '黄金会员': 'from-yellow-500 via-amber-500 to-orange-500', // Richer Gold
  '铂金会员': 'from-slate-800 via-gray-900 to-black', // Richer Platinum
};
