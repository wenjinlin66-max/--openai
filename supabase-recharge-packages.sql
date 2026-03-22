-- CRIMS 充值套餐表 SQL
-- 执行位置：Supabase Dashboard -> SQL Editor

begin;

create table if not exists public.recharge_packages (
  id text primary key,
  name text not null unique,
  price numeric(10,2) not null check (price >= 0),
  value numeric(10,2) not null check (value >= 0),
  benefits text[] not null default '{}',
  description text,
  scenes text[] not null default '{}',
  is_popular boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recharge_packages_active_sort
  on public.recharge_packages(is_active, sort_order, created_at);

create or replace function public.set_recharge_packages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_recharge_packages_updated_at on public.recharge_packages;

create trigger trg_recharge_packages_updated_at
before update on public.recharge_packages
for each row execute function public.set_recharge_packages_updated_at();

insert into public.recharge_packages (id, name, price, value, benefits, description, scenes, is_popular, is_active, sort_order)
values
  ('p1', '基础充值', 100, 100, array['获得 100 积分'], '适合首次储值或临时补充余额，快速完成单次服务消费。', array['单次剪裁后快速结算', '首次体验门店储值流程'], false, true, 10),
  ('p2', '进阶充值', 500, 500, array['获得 500 积分', '赠送饮品券'], '适合月度护理与剪裁类消费，兼顾储值效率和轻量礼遇。', array['搭配护理与剪裁组合消费', '适合月度到店保养需求'], true, true, 20),
  ('p3', '豪华充值', 1000, 1000, array['获得 1000 积分', '免排队权益', '专属客服'], '适合重视长期护理与尊享服务体验的高频到店会员。', array['适合高端染烫与护理项目', '更适合重视专属礼遇的会员'], false, true, 30)
on conflict (id) do update
set name = excluded.name,
    price = excluded.price,
    value = excluded.value,
    benefits = excluded.benefits,
    description = excluded.description,
    scenes = excluded.scenes,
    is_popular = excluded.is_popular,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = now();

commit;
