-- 04 · LIFF 公開流程用的 SECURITY DEFINER function
--
-- 這些函式 anon 也要能呼叫（訪客在 LINE 裡報到／接龍時沒有登入身分），
-- 所以權限不能單純關掉。Supabase advisor 會對它們報
-- anon_security_definer_function_executable，那是預期中的。
--
-- 安全靠的是函式內部的檢查：QR token 與有效期、手機末 4 碼、
-- 一個 LINE 帳號只能綁一個身分。

-- 會員綁定 LINE 帳號（驗手機末 4 碼）
create or replace function public.bind_line_user(p_member_id bigint, p_line_user_id text, p_phone_last4 text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_member record;
  v_existing_id bigint;
begin
  select id into v_existing_id
  from members
  where line_user_id = p_line_user_id and id <> p_member_id;

  if v_existing_id is not null then
    return jsonb_build_object('success', false, 'error', '此 LINE 帳號已綁定其他會員，請聯絡管理員');
  end if;

  select * into v_member from members where id = p_member_id;

  if v_member.id is null then
    return jsonb_build_object('success', false, 'error', '找不到該會員');
  end if;

  if v_member.line_user_id is not null and v_member.line_user_id <> p_line_user_id then
    return jsonb_build_object('success', false, 'error', '此會員已綁定其他 LINE 帳號，請聯絡管理員');
  end if;

  if v_member.mobile_phone is null
     or right(regexp_replace(v_member.mobile_phone, '[^0-9]', '', 'g'), 4) <> p_phone_last4 then
    return jsonb_build_object('success', false, 'error', '手機末 4 碼不正確');
  end if;

  update members set line_user_id = p_line_user_id where id = p_member_id;

  return jsonb_build_object('success', true, 'member_id', p_member_id, 'member_name', v_member.name);
end;
$function$;

-- LINE 掃碼報到主流程。
-- ⚠️ 業務規則：只有「例會活動」套用遲到判定，台北時間 07:01（含）之後記 late。
--    07:00:59 仍算出席。其他活動類型一律記 present。
--    門檻寫死 07:01；未來若要各活動可調，改讀 app_settings 或 activities 欄位。
create or replace function public.line_checkin(p_activity_id bigint, p_token text, p_line_user_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_activity record;
  v_member record;
  v_guest record;
  v_registration record;
  v_status text;
begin
  select * into v_activity from activities where id = p_activity_id;
  if v_activity.id is null then
    return jsonb_build_object('success', false, 'error', '活動不存在');
  end if;
  if v_activity.checkin_token is null or v_activity.checkin_token <> p_token then
    return jsonb_build_object('success', false, 'error', 'QR code 無效，請向管理員確認');
  end if;
  if v_activity.checkin_token_expires_at is null or v_activity.checkin_token_expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'QR code 已過期');
  end if;

  if v_activity.type = '例會活動'
     and (now() at time zone 'Asia/Taipei')::time >= time '07:01' then
    v_status := 'late';
  else
    v_status := 'present';
  end if;

  -- 路徑 1：已綁定會員
  select * into v_member from members where line_user_id = p_line_user_id;
  if v_member.id is not null then
    insert into attendance (activity_id, member_id, status, updated_at)
    values (p_activity_id::text, v_member.id::text, v_status, timezone('utc', now()))
    on conflict (activity_id, member_id)
    do update set status = excluded.status, updated_at = timezone('utc', now());

    return jsonb_build_object('success', true, 'kind', 'member', 'name', v_member.name,
                              'status', v_status, 'activity_title', v_activity.title);
  end if;

  -- 路徑 2：已綁定來賓
  select * into v_guest from guests where line_user_id = p_line_user_id;
  if v_guest.id is not null then
    select * into v_registration
    from registrations
    where "activityId" = p_activity_id and phone = v_guest.phone
    limit 1;

    if v_registration.id is null then
      return jsonb_build_object('success', false, 'error', '此場次查無您的報名紀錄，請先在網站完成報名');
    end if;

    update registrations
    set guest_id = v_guest.id, check_in_status = true
    where id = v_registration.id;

    return jsonb_build_object('success', true, 'kind', 'guest', 'name', v_guest.name,
                              'activity_title', v_activity.title);
  end if;

  -- 路徑 3：未綁定，交給前端決定走會員或來賓綁定流程
  return jsonb_build_object('success', false, 'error', 'NOT_BOUND', 'message', '尚未綁定');
end;
$function$;

-- 訪客綁定 + 報到（以該活動報名資料的手機末 4 碼比對）
-- ⚠️ 來賓後台已不再管理 LINE 綁定，但 LIFF 這條路徑仍在運作。
create or replace function public.guest_bind_and_checkin(p_activity_id bigint, p_token text, p_line_user_id text, p_phone_last4 text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_activity record;
  v_registration record;
  v_existing_guest record;
  v_new_guest_id bigint;
begin
  select * into v_activity from activities where id = p_activity_id;
  if v_activity.id is null then
    return jsonb_build_object('success', false, 'error', '活動不存在');
  end if;
  if v_activity.checkin_token is null or v_activity.checkin_token <> p_token then
    return jsonb_build_object('success', false, 'error', 'QR code 無效');
  end if;
  if v_activity.checkin_token_expires_at is null or v_activity.checkin_token_expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'QR code 已過期');
  end if;

  if exists (select 1 from members where line_user_id = p_line_user_id) then
    return jsonb_build_object('success', false, 'error', '此 LINE 帳號已是會員身份，請重新進入報到流程');
  end if;

  select * into v_existing_guest from guests where line_user_id = p_line_user_id;
  if v_existing_guest.id is not null then
    return jsonb_build_object('success', false, 'error', '此 LINE 帳號已綁定過，請重新進入報到流程');
  end if;

  -- guest_id is null：避免挑到別人已綁的 registration
  select * into v_registration
  from registrations
  where "activityId" = p_activity_id
    and right(regexp_replace(phone, '[^0-9]', '', 'g'), 4) = p_phone_last4
    and guest_id is null
  limit 1;

  if v_registration.id is null then
    return jsonb_build_object('success', false,
      'error', '查無此手機末 4 碼的報名紀錄（或該紀錄已綁定其他 LINE 帳號）');
  end if;

  select * into v_existing_guest from guests where phone = v_registration.phone;
  if v_existing_guest.id is not null then
    if v_existing_guest.line_user_id <> p_line_user_id then
      return jsonb_build_object('success', false, 'error', '此手機號碼已綁定其他 LINE 帳號，請聯絡管理員');
    end if;
    v_new_guest_id := v_existing_guest.id;
  else
    insert into guests (line_user_id, name, phone, email, company)
    values (p_line_user_id, v_registration.name, v_registration.phone,
            v_registration.email, v_registration.company)
    returning id into v_new_guest_id;
  end if;

  update registrations
  set guest_id = v_new_guest_id, check_in_status = true
  where id = v_registration.id;

  return jsonb_build_object('success', true, 'kind', 'guest',
                            'name', v_registration.name, 'activity_title', v_activity.title);
end;
$function$;

-- 電子名片：供 LiffCard.tsx（anon）取單／多位會員的名片欄位
-- ⚠️ 對 anon 開放電話與 email，屬於可被逐 id 爬取的個資。
--    要收緊可改為需登入，或加頻率限制。
create or replace function public.public_member_cards(p_ids bigint[])
 returns table(id bigint, name text, company text, company_title text, industry_chain text,
               industry_category text, picture text, website text, mobile_phone text, email text, intro text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select m.id, m.name, m.company, m.company_title, m.industry_chain,
         m.industry_category, m.picture, m.website, m.mobile_phone, m.email, m.intro
  from public.members m
  where m.id = any(p_ids)
    and (m.status is null or m.status = 'active')
  order by array_position(p_ids, m.id);
$function$;

-- 名片挑選頁的清單（不含電話 email）
create or replace function public.public_member_directory()
 returns table(id bigint, member_no text, name text, company text, industry_chain text,
               industry_category text, company_title text, group_name text, picture text,
               intro text, website text, status text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select m.id, m.member_no::text, m.name, m.company, m.industry_chain, m.industry_category,
         m.company_title, m.group_name, m.picture, m.intro, m.website, m.status
  from public.members m
  order by m.name;
$function$;
