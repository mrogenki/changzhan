-- 07 · RLS
--
-- 原則：**RLS 才是真正的防線**。前端藏按鈕等於沒鎖，因為 anon key 寫在前端
-- bundle 裡是公開的，任何人都能直接打 REST API。
--
-- 一般規則（19 張表）：
--   SELECT                  → is_changzhan_admin()   在 admins 表裡就能讀
--   INSERT / UPDATE / DELETE → is_changzhan_editor()  還要 can_edit 為真
--
-- 例外是公開頁面需要的 anon 權限，逐條在下面標明理由。

alter table public.activities       enable row level security;
alter table public.admins           enable row level security;
alter table public.app_settings     enable row level security;
alter table public.attendance       enable row level security;
alter table public.documents        enable row level security;
alter table public.email_send_log   enable row level security;
alter table public.finance_records  enable row level security;
alter table public.guests           enable row level security;
alter table public.line_groups      enable row level security;
alter table public.member_aliases   enable row level security;
alter table public.members          enable row level security;
alter table public.message_send_log enable row level security;
alter table public.milestones       enable row level security;
alter table public.payable_records  enable row level security;
alter table public.payment_batches  enable row level security;
alter table public.payment_items    enable row level security;
alter table public.registrations    enable row level security;
alter table public.signup_entries   enable row level security;
alter table public.signup_sheets    enable row level security;

-- === 後台四件組：admin 讀、editor 寫 ===
do $$
declare t text;
begin
  foreach t in array array[
    'activities','admins','app_settings','attendance','documents','finance_records',
    'guests','members','milestones','payment_batches','payment_items','registrations'
  ] loop
    execute format('create policy %I on public.%I as permissive for select to authenticated using (is_changzhan_admin());', t||'_admin_read', t);
    execute format('create policy %I on public.%I as permissive for insert to authenticated with check (is_changzhan_editor());', t||'_editor_insert', t);
    execute format('create policy %I on public.%I as permissive for update to authenticated using (is_changzhan_editor()) with check (is_changzhan_editor());', t||'_editor_update', t);
    execute format('create policy %I on public.%I as permissive for delete to authenticated using (is_changzhan_editor());', t||'_editor_delete', t);
  end loop;
end $$;

-- 應付帳款與接龍用比較精簡的兩條式寫法（效果相同）
create policy payable_records_read on public.payable_records
  as permissive for select to authenticated using (is_changzhan_admin());
create policy payable_records_write on public.payable_records
  as permissive for all to authenticated using (is_changzhan_editor()) with check (is_changzhan_editor());

create policy signup_sheets_admin_all on public.signup_sheets
  as permissive for all to authenticated using (is_changzhan_admin()) with check (is_changzhan_admin());
create policy signup_entries_admin_all on public.signup_entries
  as permissive for all to authenticated using (is_changzhan_admin()) with check (is_changzhan_admin());

-- 寄信紀錄只給後台看，不開寫入（只有 edge function 以 service role 寫）
create policy email_send_log_admin_read on public.email_send_log
  as permissive for select to authenticated using (is_changzhan_admin());

create policy auth_read_aliases on public.member_aliases
  as permissive for select to authenticated using (true);
create policy editor_write_aliases on public.member_aliases
  as permissive for all to authenticated
  using (current_user_role() = any (array['admin'::text, 'editor'::text]))
  with check (current_user_role() = any (array['admin'::text, 'editor'::text]));

-- === 公開頁面必要的 anon 權限 ===

-- 首頁與行事曆要列活動
create policy activities_public_read on public.activities
  as permissive for select to anon using (true);

-- 大事記頁
create policy milestones_public_read on public.milestones
  as permissive for select to public using (true);

-- 公開報名只能新增，不能讀（讀得到就等於外洩其他人的姓名電話）。
-- 實際走 public_create_registration() RPC，它會回傳新 id 給前端觸發通知與確認信。
create policy registrations_anon_insert on public.registrations
  as permissive for insert to anon with check (true);

-- LIFF 報到頁要讀 line_notify_registration_group_id 之類的設定
create policy app_settings_anon_read on public.app_settings
  as permissive for select to anon using (true);

-- ⚠️ 以下兩組是已知過寬、待收緊的政策，原樣保留以免拆壞既有流程。
--    新分會上線前建議一併處理：

-- message_send_log：anon 可讀可寫。LIFF 訪客報到的歡迎訊息是以 anon 身分
-- 呼叫 send-line-message，該函式要寫紀錄。要收緊得先改成由 edge function
-- 以 service role 寫入。
create policy message_send_log_anon_insert on public.message_send_log
  as permissive for insert to anon with check (true);
create policy message_send_log_anon_read on public.message_send_log
  as permissive for select to anon using (true);

-- line_groups：一條 anon 的 FOR ALL。唯讀帳號仍可繞過前端直接改群組資料。
-- 要收緊得先確認 line-webhook 是用哪個 key 寫入（應該是 service role，那就能拿掉）。
create policy line_groups_anon_all on public.line_groups
  as permissive for all to anon using (true) with check (true);

-- 注意 members 沒有開 anon SELECT：公開的會員列表與電子名片一律走
-- public_member_directory() / public_member_cards() 兩支 SECURITY DEFINER
-- function，由函式決定回傳哪些欄位。
