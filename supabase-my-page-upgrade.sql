-- CRIMS C端“我的”页后端化最小升级 SQL
-- 执行位置：Supabase Dashboard -> SQL Editor
-- 建议先在测试环境执行，再到正式环境执行。

begin;

-- =====================================================
-- 1) customers：补齐个人资料字段
-- =====================================================
alter table public.customers
  add column if not exists phone text,
  add column if not exists nickname text,
  add column if not exists preferences text[] default '{}',
  add column if not exists settings jsonb default '{}'::jsonb;

comment on column public.customers.phone is 'C端我的页手机号';
comment on column public.customers.nickname is 'C端我的页昵称，未填写时可回退到name';
comment on column public.customers.preferences is '用户偏好服务列表';
comment on column public.customers.settings is '用户隐私、提醒、安全设置';

-- =====================================================
-- 2) feedbacks：把评价与售后诉求统一放到一张表里
-- =====================================================
alter table public.feedbacks
  add column if not exists rating int check (rating between 1 and 5),
  add column if not exists appointment_id uuid,
  add column if not exists service_name text,
  add column if not exists request_type text check (request_type in ('投诉', '申诉', '售后咨询')),
  add column if not exists request_status text default 'pending'
    check (request_status in ('pending', 'processing', 'resolved', 'rejected')),
  add column if not exists handling_note text,
  add column if not exists handled_by uuid,
  add column if not exists handled_at timestamptz;

create index if not exists idx_feedbacks_customer_created
  on public.feedbacks(customer_id, created_at desc);

create index if not exists idx_feedbacks_request_type_status
  on public.feedbacks(request_type, request_status)
  where request_type is not null;

comment on column public.feedbacks.request_type is '投诉/申诉/售后咨询；为空表示普通服务评价';
comment on column public.feedbacks.request_status is '售后处理状态：pending/processing/resolved/rejected';
comment on column public.feedbacks.handling_note is 'B端处理备注';
comment on column public.feedbacks.handled_by is 'B端处理人用户ID';
comment on column public.feedbacks.handled_at is '售后工单处理完成时间';

-- 可选：如果 appointments.id 是 uuid，可补充外键；若类型不一致可注释掉本段。
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbacks_appointment_id_fkey'
  ) then
    alter table public.feedbacks
      add constraint feedbacks_appointment_id_fkey
      foreign key (appointment_id) references public.appointments(id)
      on delete set null;
  end if;
exception
  when others then
    raise notice 'Skip feedbacks.appointment_id foreign key: %', sqlerrm;
end $$;

-- =====================================================
-- 3) notifications：统一 C端 content 与 B端 message 字段契约
-- =====================================================
alter table public.notifications
  add column if not exists content text,
  add column if not exists message text;

update public.notifications
set content = coalesce(content, message),
    message = coalesce(message, content)
where content is null or message is null;

create or replace function public.sync_notification_message_content()
returns trigger
language plpgsql
as $$
begin
  new.message := coalesce(new.message, new.content);
  new.content := coalesce(new.content, new.message);
  return new;
end;
$$;

drop trigger if exists trg_sync_notification_message_content on public.notifications;

create trigger trg_sync_notification_message_content
before insert or update on public.notifications
for each row execute function public.sync_notification_message_content();

-- =====================================================
-- 4) RLS 示例（如你已开启 RLS，可按需执行）
--    若未启用 RLS，可先跳过本段。
-- =====================================================

-- customers: 用户仅能查看/修改自己的扩展资料
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'customers'
  ) then
    begin
      create policy customers_select_self on public.customers
        for select using (auth.uid() = id);
    exception when duplicate_object then null; end;

    begin
      create policy customers_update_self on public.customers
        for update using (auth.uid() = id)
        with check (auth.uid() = id);
    exception when duplicate_object then null; end;
  end if;
end $$;

-- feedbacks: 用户可查看/创建自己的评价和售后记录
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'feedbacks'
  ) then
    begin
      create policy feedbacks_select_self on public.feedbacks
        for select using (auth.uid() = customer_id);
    exception when duplicate_object then null; end;

    begin
      create policy feedbacks_insert_self on public.feedbacks
        for insert with check (auth.uid() = customer_id);
    exception when duplicate_object then null; end;
  end if;
end $$;

commit;

-- =====================================================
-- 执行后建议手动验证：
-- 1. customers 表是否已出现 phone/nickname/preferences/settings
-- 2. feedbacks 表是否已出现 request_type/request_status/handling_note 等字段
-- 3. notifications 表插入/更新时 content 与 message 是否自动同步
-- =====================================================
