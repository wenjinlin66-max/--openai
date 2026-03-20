
import { RechargePackage } from './types';

export const PACKAGES: RechargePackage[] = [
  { id: 'p1', name: '基础充值', price: 100, value: 100, benefits: ['获得 100 积分'], isPopular: false },
  { id: 'p2', name: '进阶充值', price: 500, value: 500, benefits: ['获得 500 积分', '赠送饮品券'], isPopular: true },
  { id: 'p3', name: '豪华充值', price: 1000, value: 1000, benefits: ['获得 1000 积分', '免排队权益', '专属客服'], isPopular: false }
];

export const STORE_PROFILE = {
  name: 'Lumina Services 高端服务会所',
  businessHours: '每日 09:00 - 21:00',
  address: '当前演示系统未配置精确门牌地址，可咨询人工客服或到店前台获取。',
  contact: '当前演示系统未配置固定联系电话，可通过在线客服或人工客服进一步咨询。',
  serviceTypes: ['剪裁设计', '头皮护理', '染发造型', '烫发造型', '男士定制服务', '高端发质护理']
};

export const BOOKING_RULES = {
  bookingMethod: '顾客可在 C端 选择服务、日期与时间段后提交预约申请。',
  bookingWindow: '当前页面默认展示未来 7 天可预约日期。',
  timeSlots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '15:00', '15:30', '16:00', '16:30'],
  cancellationRule: '已提交的预约在未完成前可由用户主动取消。',
  modificationRule: '当前系统未提供直接修改预约时间功能，建议先取消原预约，再重新提交新预约。',
  capacityRule: '每个时间段根据 slot_configs 配置动态控制可预约人数，满员时将无法继续提交。'
};

export const MEMBERSHIP_GUIDE = {
  tiers: ['青铜会员', '白银会员', '黄金会员', '铂金会员'],
  rules: [
    '系统当前支持青铜、白银、黄金、铂金四级会员身份展示。',
    '充值可获得对应积分，当前规则为 1 元约等于 1 积分。',
    '部分充值套餐附带饮品券、免排队权益或专属客服等额外权益。',
    '活动公告可根据 target_audience 面向指定会员等级进行展示。'
  ],
  packageHighlights: [
    '基础充值：到账 100 元，获得 100 积分。',
    '进阶充值：到账 500 元，获得 500 积分，并赠送饮品券。',
    '豪华充值：到账 1000 元，获得 1000 积分，并附带免排队权益和专属客服。'
  ]
};

export const TIER_STYLES: Record<string, string> = {
  '青铜会员': 'from-orange-500 via-orange-600 to-amber-700', // Richer Orange
  '白银会员': 'from-slate-400 via-slate-500 to-slate-600', // Richer Silver
  '黄金会员': 'from-yellow-500 via-amber-500 to-orange-500', // Richer Gold
  '铂金会员': 'from-slate-800 via-gray-900 to-black', // Richer Platinum
};
