import { supabase } from '../lib/supabaseClient';
import { ServiceCatalogItem } from '../types';

const mapServiceRow = (row: any): ServiceCatalogItem => ({
  id: row.id,
  name: row.name,
  price: row.price,
  durationMinutes: row.duration_minutes || 0,
  description: row.description || '',
  suitableFor: row.suitable_for || '',
  category: row.category || '基础服务',
  isActive: row.is_active ?? true,
  sortOrder: row.sort_order ?? 0,
});

export const fetchActiveServiceCatalog = async (): Promise<ServiceCatalogItem[]> => {
  try {
    const { data, error } = await supabase
      .from('services_catalog')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapServiceRow);
  } catch (error) {
    console.error('加载服务目录失败:', error);
    return [];
  }
};
