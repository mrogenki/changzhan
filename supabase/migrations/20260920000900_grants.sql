-- 09 · 函式權限
--
-- Postgres 建立函式時預設把 EXECUTE 給 PUBLIC，所以只撤 anon / authenticated
-- 沒有用，要連 PUBLIC 一起撤。

-- 只有 send-line-message edge function（service role）會呼叫
revoke execute on function public.check_message_recently_sent(text, text, integer) from public, anon, authenticated;
grant  execute on function public.check_message_recently_sent(text, text, integer) to service_role;

-- 這兩支是 trigger 專用，沒有任何程式直接呼叫
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_role_to_jwt() from public, anon, authenticated;

-- ⚠️ 其餘 SECURITY DEFINER 函式維持開放，各有原因：
--   · is_changzhan_admin / is_changzhan_editor / current_user_role
--     → RLS 政策執行時會呼叫它們，撤掉 EXECUTE 會讓後台整個讀不到資料
--   · line_checkin / guest_bind_and_checkin / bind_line_user / list_unbound_members
--     → LIFF 報到流程，訪客沒有登入身分
--   · public_signup_* / public_member_* / public_create_registration
--     → 公開報名與電子名片
--   安全靠函式內部的檢查（token、有效期、手機末 4 碼），不是靠關掉權限。
