-- 11 · 會員的分會職務（可複選）
--
-- 與 members.company_title 不同：那是「公司職稱」，這是「在分會擔任的職務」。
--
-- 用 text[] 而不是另開一張表：職務清單固定、每人最多掛幾個，
-- 查詢也只有「誰是小組長」這種簡單包含判斷，開一張關聯表反而麻煩。
-- 名稱不在 DB 端用 enum 或 check 限制——分會改職稱（例如「秘財」拆成
-- 「秘書」「財務」）時不用動 schema，有效值由前端的 CHAPTER_POSITIONS 管。
alter table public.members
  add column if not exists positions text[] not null default '{}';

-- 「誰是小組長」是 leader-activity 每次都會查的條件
create index if not exists members_positions_idx on public.members using gin (positions);

-- 取代原本的 is_group_leader 勾選欄：職務含「小組長」就是小組長，
-- 只留一個來源，不會出現「職務寫小組長但沒勾到」的矛盾。
-- （10_group_leader_self_service 建的欄位；先搬資料再移除）
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'members' and column_name = 'is_group_leader'
  ) then
    update public.members
    set positions = array['小組長']
    where is_group_leader and not ('小組長' = any(positions));

    alter table public.members drop column is_group_leader;
  end if;
end $$;
