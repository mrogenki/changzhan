-- 16 · 會員的最新紅綠燈（PALMS）
--
-- ⚠️ **跨系統讀取**：`traffic_light_imports` 是 bni-report 獨佔的表，由那邊上傳
--    PALMS 報表時寫入，changzhan 只讀不寫。如果 bni-report 改了 JSON 的欄位名稱，
--    這個 view 會安靜地少掉欄位（不會壞，但值變 null），要記得一起改。
--    新分會若不跑 bni-report，這張表不存在，本檔可以整個跳過。
--
-- 姓名對照的規律（實際看 119 筆歸納）：
--   · 多數是本名 → 對 members.name
--   · 有些是舊名／別名 → 對 member_aliases
--   · 有些寫成「張國興(嘉元)」「陳孝慈（陳欣囍）」——本名加括號註記，
--     **括號有半形也有全形**，所以括號內外都要拆出來各試一次
create or replace view public.member_traffic_lights
with (security_invoker = true) as
with latest as (
  select date_range, uploaded_at, data
  from public.traffic_light_imports
  order by uploaded_at desc
  limit 1
), rows as (
  select
    trim(x->>'name')                              as raw_name,
    x->>'light'                                   as light,
    nullif(x->>'totalScore','')::numeric::int     as total_score,
    nullif(x->>'attendanceRate','')::numeric::int as attendance_rate,
    nullif(x->>'attendance','')::numeric::int     as attendance,
    nullif(x->>'absent','')::numeric::int         as absent,
    nullif(x->>'late','')::numeric::int           as late,
    nullif(x->>'sick','')::numeric::int           as sick,
    nullif(x->>'substitute','')::numeric::int     as substitute,
    nullif(x->>'guests','')::numeric::int         as guests,
    nullif(x->>'oneOnOne','')::numeric::int       as one_on_one,
    nullif(x->>'education','')::numeric::int      as education,
    nullif(x->>'given','')::numeric::int          as given_refs,
    nullif(x->>'received','')::numeric::int       as received_refs,
    nullif(x->>'dealValue','')::numeric           as deal_value,
    latest.date_range,
    latest.uploaded_at
  from latest, jsonb_array_elements(latest.data) x
), candidates as (
  select r.*,
    array_remove(array[
      r.raw_name,
      nullif(trim(split_part(translate(r.raw_name, '（）', '()'), '(', 1)), ''),
      nullif(trim(replace(split_part(translate(r.raw_name, '（）', '()'), '(', 2), ')', '')), '')
    ], null) as name_candidates
  from rows r
), name_map as (
  select m.id as member_id, m.name as key
  from public.members m
  where coalesce(m.status, 'active') = 'active' and m.name is not null
  union
  select a.member_id, a.alias_name from public.member_aliases a
)
select distinct on (nm.member_id)
  nm.member_id, c.raw_name, c.light, c.total_score, c.attendance_rate,
  c.attendance, c.absent, c.late, c.sick, c.substitute,
  c.guests, c.one_on_one, c.education, c.given_refs, c.received_refs, c.deal_value,
  c.date_range, c.uploaded_at
from candidates c
cross join lateral unnest(c.name_candidates) as n(key)
join name_map nm on nm.key = n.key
order by nm.member_id, c.total_score desc nulls last;
