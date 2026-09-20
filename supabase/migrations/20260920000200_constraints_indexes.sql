-- 02 · 主鍵、外鍵、check、索引
--
-- 順序在資料表之後：外鍵需要被參照的表先存在。

-- === 主鍵 ===
alter table public.activities add constraint activities_pkey primary key (id);
alter table public.admins add constraint admins_pkey primary key (id);
alter table public.app_settings add constraint app_settings_pkey primary key (key);
alter table public.attendance add constraint attendance_pkey primary key (id);
alter table public.documents add constraint documents_pkey primary key (id);
alter table public.email_send_log add constraint email_send_log_pkey primary key (id);
alter table public.finance_records add constraint finance_records_pkey primary key (id);
alter table public.guests add constraint guests_pkey primary key (id);
alter table public.line_groups add constraint line_groups_pkey primary key (id);
alter table public.member_aliases add constraint member_aliases_pkey primary key (alias_name);
alter table public.members add constraint member_pkey primary key (id);
alter table public.message_send_log add constraint message_send_log_pkey primary key (id);
alter table public.milestones add constraint milestones_pkey primary key (id);
alter table public.payable_records add constraint payable_records_pkey primary key (id);
alter table public.payment_batches add constraint payment_batches_pkey primary key (id);
alter table public.payment_items add constraint payment_items_pkey primary key (id);
alter table public.registrations add constraint registrations_pkey primary key (id);
alter table public.signup_entries add constraint signup_entries_pkey primary key (id);
alter table public.signup_sheets add constraint signup_sheets_pkey primary key (id);

-- === 唯一鍵 ===
-- 正式環境的 attendance 上有兩條內容相同的 unique（attendance_activity_id_member_id_key
-- 與 attendance_activity_member_unique），應是先後加了兩次。這裡只留一條。
alter table public.attendance add constraint attendance_activity_member_unique unique (activity_id, member_id);
alter table public.guests add constraint guests_line_user_id_key unique (line_user_id);
alter table public.line_groups add constraint line_groups_line_group_id_key unique (line_group_id);
alter table public.members add constraint members_line_user_id_key unique (line_user_id);
alter table public.signup_sheets add constraint signup_sheets_token_key unique (token);

-- === 外鍵 ===
alter table public.email_send_log add constraint email_send_log_registration_id_fkey
  foreign key (registration_id) references public.registrations(id) on delete set null;
alter table public.finance_records add constraint finance_records_activity_id_fkey
  foreign key (activity_id) references public.activities(id) on delete set null;
-- 刪收款項目時收支那筆保留（帳不會憑空消失）
alter table public.finance_records add constraint finance_records_payment_batch_id_fkey
  foreign key (payment_batch_id) references public.payment_batches(id) on delete set null;
alter table public.payable_records add constraint payable_records_activity_id_fkey
  foreign key (activity_id) references public.activities(id) on delete set null;
alter table public.payable_records add constraint payable_records_finance_record_id_fkey
  foreign key (finance_record_id) references public.finance_records(id) on delete set null;
alter table public.payment_batches add constraint payment_batches_activity_id_fkey
  foreign key (activity_id) references public.activities(id) on delete set null;
alter table public.payment_items add constraint payment_items_batch_id_fkey
  foreign key (batch_id) references public.payment_batches(id) on delete cascade;
alter table public.payment_items add constraint payment_items_guest_id_fkey
  foreign key (guest_id) references public.guests(id) on delete set null;
alter table public.payment_items add constraint payment_items_member_id_fkey
  foreign key (member_id) references public.members(id) on delete set null;
alter table public.payment_items add constraint payment_items_registration_id_fkey
  foreign key (registration_id) references public.registrations(id) on delete set null;
alter table public.registrations add constraint registrations_guest_id_fkey
  foreign key (guest_id) references public.guests(id) on delete set null;
alter table public.signup_entries add constraint signup_entries_member_id_fkey
  foreign key (member_id) references public.members(id) on delete set null;
alter table public.signup_entries add constraint signup_entries_sheet_id_fkey
  foreign key (sheet_id) references public.signup_sheets(id) on delete cascade;

-- === Check ===
alter table public.email_send_log add constraint email_send_log_status_valid
  check (status = any (array['sent'::text, 'failed'::text, 'skipped'::text]));
alter table public.finance_records add constraint finance_records_type_check
  check (type = any (array['income'::text, 'expense'::text]));
alter table public.message_send_log add constraint message_send_log_recipient_kind_check
  check (recipient_kind = any (array['member'::text, 'guest'::text, 'group'::text]));
alter table public.message_send_log add constraint message_send_log_status_check
  check (status = any (array['sent'::text, 'failed'::text]));
alter table public.payable_records add constraint payable_status_valid
  check (status = any (array['pending'::text, 'paid'::text, 'cancelled'::text]));
alter table public.payment_batches add constraint payment_batches_status_valid
  check (status = any (array['open'::text, 'closed'::text]));
alter table public.payment_items add constraint payment_items_method_valid
  check ((method is null) or (method = any (array['cash'::text, 'linepay'::text, 'transfer'::text])));
-- 一筆收款明細最多只能指向會員／來賓／報名其中一個
alter table public.payment_items add constraint payment_items_single_ref
  check ((case when member_id is not null then 1 else 0 end
        + case when guest_id is not null then 1 else 0 end
        + case when registration_id is not null then 1 else 0 end) <= 1);
alter table public.signup_entries add constraint signup_entries_extra_valid
  check ((extra_count >= 0) and (extra_count <= 20));
alter table public.signup_sheets add constraint signup_sheets_status_valid
  check (status = any (array['open'::text, 'closed'::text]));

-- === 索引 ===
create index if not exists idx_documents_category on public.documents using btree (category);
create index if not exists idx_documents_created_at on public.documents using btree (created_at desc);
create index if not exists email_send_log_created_idx on public.email_send_log using btree (created_at desc);
create index if not exists idx_guests_line_user_id on public.guests using btree (line_user_id);
create index if not exists idx_guests_phone on public.guests using btree (phone);
create index if not exists idx_members_line_user_id on public.members using btree (line_user_id);
create index if not exists idx_msg_log_created_at on public.message_send_log using btree (created_at desc);
create index if not exists idx_msg_log_dedup on public.message_send_log using btree (line_user_id, message_hash, created_at);
create index if not exists idx_msg_log_line_user on public.message_send_log using btree (line_user_id);
create index if not exists idx_msg_log_recipient on public.message_send_log using btree (recipient_kind, recipient_id);
create index if not exists payable_records_status_idx on public.payable_records using btree (status, due_date);
create index if not exists payment_items_batch_idx on public.payment_items using btree (batch_id);
create index if not exists payment_items_member_idx on public.payment_items using btree (member_id);
create index if not exists idx_registrations_guest_id on public.registrations using btree (guest_id);
create index if not exists signup_entries_sheet_idx on public.signup_entries using btree (sheet_id, created_at);

-- 資料庫層的防呆（都實測過會擋下）：
-- 一個收款項目對應收支帳上一筆；同一項目不會重複收同一位會員／來賓／報名；
-- 同一個月份只會有一個餐費項目（「建立本月餐費」可安全重複按）；
-- 一個 LINE 帳號在同一張接龍只能有一筆（後台代報的 line_user_id 是 null，不受限）。
create unique index if not exists finance_records_batch_uniq on public.finance_records using btree (payment_batch_id) where (payment_batch_id is not null);
create unique index if not exists payment_batches_period_uniq on public.payment_batches using btree (period) where (period is not null);
create unique index if not exists payment_items_batch_member_uniq on public.payment_items using btree (batch_id, member_id) where (member_id is not null);
create unique index if not exists payment_items_batch_guest_uniq on public.payment_items using btree (batch_id, guest_id) where (guest_id is not null);
create unique index if not exists payment_items_batch_reg_uniq on public.payment_items using btree (batch_id, registration_id) where (registration_id is not null);
create unique index if not exists signup_entries_sheet_line_uniq on public.signup_entries using btree (sheet_id, line_user_id) where (line_user_id is not null);
