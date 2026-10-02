-- 17 · 停掉 user_roles → JWT 的角色同步
--
-- 2026-09-21 起權限只認分會幹部名冊（admins），`user_roles` 已不影響任何權限。
-- 但 `on_user_role_changed` trigger 還會把 `user_roles.role` 寫進
-- `auth.users.raw_app_meta_data`，而 bni-report 前端是「**優先相信 JWT 的 role**，
-- 沒有才去查 admins」——等於舊角色會蓋過名冊。
--
-- 實際後果（2026-10-02 查出來）：
--   · 11 位幹部名冊是「管理員＋可編輯」，JWT 卻寫 viewer → 在引薦單報告
--     看不到「資料匯入／組別管理」
--   · 1 位**已不在名冊**的帳號 JWT 仍是 editor，還能上傳／刪除 PALMS 資料
--     ——正是 9/21 那次收斂想堵的洞
drop trigger if exists on_user_role_changed on public.user_roles;

comment on function public.sync_role_to_jwt() is
  '已停用（2026-10-02）：權限只認 admins，user_roles 不再影響任何東西，trigger 已移除。';

-- 清掉所有既有的 JWT 角色，讓權限一律回到 admins 這個單一來源。
-- 前端在 JWT 沒有 role 時會改查 admins（getCurrentUserRole）。
-- ⚠️ 使用者要重新登入才會拿到新的 JWT。
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'role'
where raw_app_meta_data ? 'role';
