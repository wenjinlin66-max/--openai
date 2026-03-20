-- CRIMS 服务目录表 SQL
-- 执行位置：Supabase Dashboard -> SQL Editor

begin;

create extension if not exists pgcrypto;

create table if not exists public.services_catalog (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  price numeric(10,2) not null check (price >= 0),
  duration_minutes integer default 45 check (duration_minutes >= 0),
  description text,
  suitable_for text,
  category text default '基础服务',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_services_catalog_active_sort
  on public.services_catalog(is_active, sort_order, created_at);

create or replace function public.set_services_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_services_catalog_updated_at on public.services_catalog;

create trigger trg_services_catalog_updated_at
before update on public.services_catalog
for each row execute function public.set_services_catalog_updated_at();

insert into public.services_catalog (code, name, price, duration_minutes, description, suitable_for, category, sort_order, is_active)
values
  ('normal_wash_cut_blow', '普通洗剪吹', 88, 45, '适合日常清洁、修剪与基础吹整的一站式基础服务。', '适合日常打理、快速焕新造型、上班族与学生党常规护理需求。', '基础服务', 10, true),
  ('senior_director_cut', '资深设计总监剪裁', 380, 60, '由资深设计总监提供一对一发型设计与精修剪裁服务。', '适合希望快速改善整体发型轮廓、日常通勤或正式场合造型升级的顾客。', '剪裁设计', 20, true),
  ('caviar_scalp_care', '奢华鱼子酱头皮护理', 680, 75, '主打头皮深层清洁、舒缓放松与营养修护的高端护理项目。', '适合头皮敏感、出油明显、压力较大或需要舒缓放松的人群。', '头皮护理', 30, true),
  ('premium_coloring', '高定色彩美学染发', 1680, 180, '结合肤色、职业风格与发质条件进行个性化高端染发设计。', '适合有高阶染发需求、希望提升气质与整体形象的顾客。', '染发造型', 40, true),
  ('airy_texture_perm', '日式空气感纹理烫', 1280, 150, '打造轻盈蓬松、层次自然的日式纹理烫效果。', '适合发量偏少、想提升蓬松度或追求自然卷度造型的顾客。', '烫发造型', 50, true),
  ('gentleman_oilhead', '男士尊享复古油头', 280, 45, '面向男士客户的精致修剪与经典复古油头造型服务。', '适合商务男士、正式活动前造型整理及日常精致打理需求。', '男士定制服务', 60, true),
  ('kerastase_black_diamond', '卡诗黑钻鱼子酱护理', 980, 90, '高端修护护理项目，注重发丝柔顺度、光泽感与深度滋养。', '适合染烫受损发质、发丝干枯毛躁或希望提升发质状态的顾客。', '高端发质护理', 70, true)
on conflict (name) do update
set price = excluded.price,
    duration_minutes = excluded.duration_minutes,
    description = excluded.description,
    suitable_for = excluded.suitable_for,
    category = excluded.category,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();

commit;
