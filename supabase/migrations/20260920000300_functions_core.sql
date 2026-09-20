-- 03 · 權限判斷與共用 function
--
-- ⚠️ 命名：`is_changzhan_admin` / `is_changzhan_editor` 含分會名稱。
--    要賣給別的分會時建議改成中性名稱（例如 is_chapter_admin），
--    否則每家的 RLS 政策會長得不一樣，日後同步修改很痛苦。
--    改名時 RLS 政策（05）與 edge function 都要一起換。

-- 後台身分：JWT 的 email 是否在 admins 表裡
create or replace function public.is_changzhan_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$function$;

-- 可編輯身分：在 admins 表裡，而且 can_edit 為真
create or replace function public.is_changzhan_editor()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and coalesce(a.can_edit, true)
  );
$function$;

-- ⚠️ 以下三支與 bni-report 共用（依賴 user_roles 表）。
--    新分會若不跑 bni-report，可以只保留 current_user_role() 的前半段。
create or replace function public.current_user_role()
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  chapter_role  text;
  chapter_edit  boolean;
  fallback_role text;
begin
  select a.role, a.can_edit
    into chapter_role, chapter_edit
  from public.admins a
  where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;

  if chapter_role is not null then
    if chapter_role = '總管理員' then
      return 'admin';
    elsif chapter_role = '管理員' then
      return case when chapter_edit is false then 'viewer' else 'editor' end;
    else
      return 'viewer';
    end if;
  end if;

  -- 不在 admins：可能是 email 還沒從舊制 <手機>@changzhan.local 遷移，
  -- 用 user_roles 接住（等 email 遷移完就能拿掉這段）
  select role into fallback_role
  from public.user_roles where user_id = auth.uid() limit 1;
  return fallback_role;
end;
$function$;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.user_roles (user_id, role, email)
  values (new.id, 'viewer', new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

create or replace function public.sync_role_to_jwt()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
  where id = new.user_id;
  return new;
end;
$function$;

-- === updated_at 觸發器用 ===
create or replace function public.touch_updated_at()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.touch_payment_items_updated_at()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- === 其他 ===

-- LINE 訊息防重複發送
create or replace function public.check_message_recently_sent(p_line_user_id text, p_message_hash text, p_window_hours integer default 24)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  return exists (
    select 1 from message_send_log
    where line_user_id = p_line_user_id
      and message_hash = p_message_hash
      and status = 'sent'
      and created_at > now() - (p_window_hours || ' hours')::interval
  );
end;
$function$;

create or replace function public.list_unbound_members()
 returns table(id bigint, name text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select m.id, m.name
  from public.members m
  where m.line_user_id is null
  order by m.name;
$function$;

-- 公開報名：anon 不能直接 SELECT registrations（保護其他人的 PII），
-- 所以改由這支寫入並回傳 id，前端再拿 id 去觸發 LINE 通知與確認信。
create or replace function public.public_create_registration(p_reg jsonb)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare new_id bigint;
begin
  insert into public.registrations (name, phone, email, company, title, referrer, "activityId", guest_id, paid_amount)
  values (
    nullif(p_reg->>'name',''),
    nullif(p_reg->>'phone',''),
    nullif(p_reg->>'email',''),
    nullif(p_reg->>'company',''),
    nullif(p_reg->>'title',''),
    nullif(p_reg->>'referrer',''),
    nullif(p_reg->>'activityId','')::bigint,
    nullif(p_reg->>'guest_id','')::bigint,
    coalesce(nullif(p_reg->>'paid_amount','')::int, 0)
  )
  returning id into new_id;
  return new_id;
end;
$function$;
