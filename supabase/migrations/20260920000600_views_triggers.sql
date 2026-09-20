-- 06 · View 與 Trigger

-- OG function 專用：把非 http(s) 的 picture 濾成 null。
-- 早期活動的 picture 存 base64 data URI（最大 200KB），爬蟲不吃 data: 當 og:image，
-- 而且冷啟動撈 200KB 會超過 2.5 秒逾時 → 退回預設 OG。
-- security_invoker = true：沿用 activities 自己的 RLS，不是用建立者的權限。
create or replace view public.activity_og
with (security_invoker = true) as
select id, title, date, "time", location,
  case when picture ~ '^https?://'::text then picture else null::text end as picture
from public.activities;

-- 來賓管理用：guests 表加上出席次數與引薦人彙總
-- ⚠️ 這支目前是 SECURITY DEFINER（Supabase advisor 會報 ERROR）。
--    新分會建議改成 security_invoker = true，除非確認有 anon 直接讀它的需求。
create or replace view public.guest_attendance_summary as
select g.id, g.line_user_id, g.name, g.phone, g.email, g.company,
  g.created_at as bound_at,
  coalesce(count(r.id) filter (where r.check_in_status = true), 0::bigint) as attendance_count,
  coalesce(max(a.date) filter (where r.check_in_status = true), null::date) as last_attended_date,
  coalesce(string_agg(distinct r.referrer, ', '::text)
           filter (where r.referrer is not null and r.referrer <> ''::text), ''::text) as referrers,
  g.notes
from public.guests g
  left join public.registrations r on r.guest_id = g.id
  left join public.activities a on a.id = r."activityId"
group by g.id, g.line_user_id, g.name, g.phone, g.email, g.company, g.created_at, g.notes;

-- === Trigger ===
drop trigger if exists payable_records_set_updated_at on public.payable_records;
create trigger payable_records_set_updated_at before update on public.payable_records
  for each row execute function public.touch_payment_items_updated_at();

drop trigger if exists payment_items_set_updated_at on public.payment_items;
create trigger payment_items_set_updated_at before update on public.payment_items
  for each row execute function public.touch_payment_items_updated_at();

drop trigger if exists signup_entries_set_updated_at on public.signup_entries;
create trigger signup_entries_set_updated_at before update on public.signup_entries
  for each row execute function public.touch_payment_items_updated_at();

drop trigger if exists trg_line_groups_updated_at on public.line_groups;
create trigger trg_line_groups_updated_at before update on public.line_groups
  for each row execute function public.touch_updated_at();

-- ⚠️ 與 bni-report 共用的 user_roles 觸發器（本檔不建立 user_roles 表，故預設註解掉）：
-- create trigger on_user_role_changed after insert or update of role on public.user_roles
--   for each row execute function public.sync_role_to_jwt();
