-- 15 · 合併同一場活動的兩種報名來源
--
-- 同一場活動的人可能從兩條路進來：公開頁的報名表（registrations）
-- 或 LINE 接龍（signup_entries）。原本兩邊互看不到——報到管理只看得到網頁報名、
-- 接龍名單只看得到接龍，人數與應收都會少算。
--
-- 做法：不動寫入路徑（各自寫回原本的表），改用 view 把兩邊併起來給畫面讀。
-- 合併寫入風險太高（重複、雙寫不同步），顯示層合併就能解決實際問題。

alter table public.signup_entries
  add column if not exists checked_in boolean not null default false,
  add column if not exists checked_in_at timestamp with time zone;

-- security_invoker：沿用查詢者對兩張底層表的 RLS（都是後台人員才讀得到）
create or replace view public.activity_attendees
with (security_invoker = true) as
  select
    'web'::text                as source,
    r.id                       as source_id,
    r."activityId"             as activity_id,
    r.name, r.phone, r.company, r.title, r.referrer,
    null::bigint               as member_id,
    0                          as extra_count,
    null::text                 as extra_names,
    r.notes                    as note,
    coalesce(r.check_in_status, false) as checked_in,
    r.paid_amount,
    r.created_at
  from public.registrations r
  union all
  select
    'signup'::text             as source,
    e.id                       as source_id,
    s.activity_id,
    e.real_name                as name,
    e.phone, e.company,
    null::text                 as title,
    e.referrer, e.member_id, e.extra_count, e.extra_names, e.note,
    e.checked_in,
    null::integer              as paid_amount,
    e.created_at
  from public.signup_entries e
  join public.signup_sheets s on s.id = e.sheet_id
  where s.activity_id is not null;

-- 公開頁的「已有 N 人報名」
--
-- ⚠️ 原本是前端用 registrations 算的，但 anon 對那張表只有 INSERT 權限，
--    所以對未登入的訪客永遠顯示 0（只有登入的幹部看得到真正的數字）。
--    改用這支：只回一個數字、不揭露個資，並把接龍的人頭一起算進去。
create or replace function public.public_activity_headcount(p_activity_id bigint)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select (
    select count(*) from public.registrations r where r."activityId" = p_activity_id
  )::int + coalesce((
    -- 接龍以總人頭計（含同行者），與接龍頁的算法一致
    select sum(1 + e.extra_count)
    from public.signup_entries e
    join public.signup_sheets s on s.id = e.sheet_id
    where s.activity_id = p_activity_id
  ), 0)::int;
$function$;

grant execute on function public.public_activity_headcount(bigint) to anon, authenticated;
