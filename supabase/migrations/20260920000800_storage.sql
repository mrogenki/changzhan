-- 08 · Storage bucket 與政策
--
-- ⚠️ 這份是「新分會應該要有的樣子」，不完全等於長展正式環境目前的狀態。
--    差異：正式環境的 activity-images 仍是 public 角色、無條件可寫可刪
--    （等於任何人拿前端的 anon key 就能上傳或刪除活動圖片與會員照片）。
--    長展的收緊另外處理，新開的分會請直接用這份。

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('activity-images',   'activity-images',   true, 10485760),   -- 10 MB
  ('chapter-documents', 'chapter-documents', true, 52428800)    -- 50 MB
on conflict (id) do nothing;

-- === activity-images：活動封面、大事記照片、會員照片 ===
-- 讀：公開（會員列表、電子名片、OG 預覽圖都要給沒登入的人和爬蟲看）
-- 寫：只有可編輯的後台人員
create policy activity_images_public_read on storage.objects
  as permissive for select to public
  using (bucket_id = 'activity-images');

create policy activity_images_editor_insert on storage.objects
  as permissive for insert to authenticated
  with check (bucket_id = 'activity-images' and is_changzhan_editor());

create policy activity_images_editor_update on storage.objects
  as permissive for update to authenticated
  using (bucket_id = 'activity-images' and is_changzhan_editor())
  with check (bucket_id = 'activity-images' and is_changzhan_editor());

create policy activity_images_editor_delete on storage.objects
  as permissive for delete to authenticated
  using (bucket_id = 'activity-images' and is_changzhan_editor());

-- === chapter-documents：分會文件 ===
-- bucket 是 public，所以既有文件的公開網址照常下載；
-- 這裡的 SELECT 政策是給 createSignedUrl 用的。
create policy chapter_documents_admin_read on storage.objects
  as permissive for select to authenticated
  using (bucket_id = 'chapter-documents' and is_changzhan_admin());

create policy chapter_documents_editor_insert on storage.objects
  as permissive for insert to authenticated
  with check (bucket_id = 'chapter-documents' and is_changzhan_editor());

create policy chapter_documents_editor_update on storage.objects
  as permissive for update to authenticated
  using (bucket_id = 'chapter-documents' and is_changzhan_editor())
  with check (bucket_id = 'chapter-documents' and is_changzhan_editor());

create policy chapter_documents_editor_delete on storage.objects
  as permissive for delete to authenticated
  using (bucket_id = 'chapter-documents' and is_changzhan_editor());

-- ⚠️ 踩過的雷：後台登入從自訂改成 Supabase Auth 之後，上傳請求變成以
--    authenticated 身分送出。chapter-documents 當時的政策只開給 anon，
--    於是上傳一律被擋，錯誤訊息是 new row violates row-level security policy。
--    改動後台登入方式時，storage 政策要跟資料表 RLS 一起檢查。
