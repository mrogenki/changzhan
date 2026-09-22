-- 10 · 小組長自助發起組聚
--
-- 小組長在 LINE（LIFF）裡發起組聚，不用登入後台。身分靠 LINE ID token
-- 在 leader-activity edge function 驗證，寫入一律走 service role，
-- 所以這裡不需要新增 RLS 政策。

-- 誰是小組長：由幹部在會員管理勾選，每組可以不只一位
alter table public.members
  add column if not exists is_group_leader boolean not null default false;

-- 活動是誰發起的。後台建立的是 null；小組長發起的會記下會員 id 與組別，
-- 小組長之後只能改、取消自己發起的。
-- on delete set null：會員被刪時活動保留（紀錄不該跟著消失）
alter table public.activities
  add column if not exists created_by_member_id bigint
    references public.members(id) on delete set null,
  add column if not exists host_group text;

create index if not exists activities_created_by_member_idx
  on public.activities (created_by_member_id)
  where created_by_member_id is not null;
