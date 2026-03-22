import { supabase } from '../lib/supabaseClient';
import { RechargePackage } from '../types';

const mapRechargePackageRow = (row: any): RechargePackage => ({
  id: row.id,
  name: row.name,
  price: Number(row.price),
  value: Number(row.value),
  benefits: row.benefits || [],
  description: row.description || '',
  scenes: row.scenes || [],
  isPopular: row.is_popular ?? false,
  isActive: row.is_active ?? true,
  sortOrder: row.sort_order ?? 100,
});

export const fetchActiveRechargePackages = async (): Promise<RechargePackage[]> => {
  try {
    const { data, error } = await supabase
      .from('recharge_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapRechargePackageRow);
  } catch (error) {
    console.error('加载充值套餐失败:', error);
    return [];
  }
};
