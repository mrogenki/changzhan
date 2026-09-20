-- 05 · 接龍報名的四支 SECURITY DEFINER function
--
-- anon 對 signup_sheets / signup_entries 完全沒有 RLS 權限，
-- LIFF 頁一律走這四支，資料要回傳什麼由函式決定。
--
-- 刻意不回傳的東西：其他人的電話、其他人的 line_user_id（只回 is_me 布林值）。

-- 公開頁：接龍資訊 + 名單
create or replace function public.public_signup_sheet(p_token text, p_viewer_line_user_id text default null::text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_sheet public.signup_sheets;
  v_entries jsonb;
  v_activity jsonb;
  v_head_count integer;
begin
  select * into v_sheet from public.signup_sheets where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', e.id,
             'real_name', e.real_name,
             'extra_count', e.extra_count,
             'extra_names', e.extra_names,
             'note', e.note,
             'is_member', e.member_id is not null,
             'is_me', p_viewer_line_user_id is not null
                      and e.line_user_id = p_viewer_line_user_id,
             'created_at', e.created_at
           ) order by e.created_at
         ), '[]'::jsonb)
    into v_entries
  from public.signup_entries e
  where e.sheet_id = v_sheet.id;

  select coalesce(sum(1 + e.extra_count), 0) into v_head_count
  from public.signup_entries e where e.sheet_id = v_sheet.id;

  -- 公開頁的日期／時間／地點一律取自綁定的活動，說明欄不需要重打
  if v_sheet.activity_id is not null then
    select jsonb_build_object('id', a.id, 'title', a.title, 'date', a.date, 'time', a.time, 'location', a.location)
      into v_activity
    from public.activities a where a.id = v_sheet.activity_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'sheet', jsonb_build_object(
      'title', v_sheet.title,
      'description', v_sheet.description,
      'deadline', v_sheet.deadline,
      'max_people', v_sheet.max_people,
      'fee', v_sheet.fee,
      'member_fee', v_sheet.member_fee,
      'allow_guests', v_sheet.allow_guests,
      'allow_non_members', v_sheet.allow_non_members,
      'status', v_sheet.status,
      'closed', v_sheet.status <> 'open'
                or (v_sheet.deadline is not null and now() > v_sheet.deadline)
    ),
    'activity', v_activity,
    'head_count', v_head_count,
    'entries', v_entries
  );
end;
$function$;

-- 報名／修改。同一個 LINE 帳號在同一張接龍只有一筆，所以這支同時是新增與更新。
create or replace function public.public_signup_join(
  p_token text, p_line_user_id text, p_display_name text, p_real_name text,
  p_phone text default null::text, p_company text default null::text,
  p_referrer text default null::text, p_extra_count integer default 0,
  p_extra_names text default null::text, p_note text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sheet public.signup_sheets;
  v_member_id bigint;
  v_existing public.signup_entries;
  v_head_count integer;
  v_extra integer := greatest(0, coalesce(p_extra_count, 0));
begin
  if coalesce(trim(p_line_user_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'no_line_user');
  end if;
  if coalesce(trim(p_real_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;

  select * into v_sheet from public.signup_sheets where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_sheet.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if v_sheet.deadline is not null and now() > v_sheet.deadline then
    return jsonb_build_object('ok', false, 'error', 'deadline_passed');
  end if;

  select id into v_member_id from public.members
   where line_user_id = p_line_user_id and coalesce(status, 'active') = 'active'
   limit 1;

  if v_member_id is null and not v_sheet.allow_non_members then
    return jsonb_build_object('ok', false, 'error', 'members_only');
  end if;
  if v_member_id is null and coalesce(trim(p_phone), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'phone_required');
  end if;
  if v_extra > 0 and not v_sheet.allow_guests then
    v_extra := 0;
  end if;

  select * into v_existing from public.signup_entries
   where sheet_id = v_sheet.id and line_user_id = p_line_user_id;

  -- 人數上限以「總人頭」計算（含眷屬），扣掉自己原本佔的位子
  if v_sheet.max_people is not null then
    select coalesce(sum(1 + e.extra_count), 0) into v_head_count
      from public.signup_entries e
     where e.sheet_id = v_sheet.id
       and (v_existing.id is null or e.id <> v_existing.id);
    if v_head_count + 1 + v_extra > v_sheet.max_people then
      return jsonb_build_object('ok', false, 'error', 'full',
        'remaining', greatest(0, v_sheet.max_people - v_head_count));
    end if;
  end if;

  if v_existing.id is not null then
    update public.signup_entries set
      member_id = v_member_id,
      display_name = p_display_name,
      real_name = trim(p_real_name),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      company = nullif(trim(coalesce(p_company, '')), ''),
      referrer = nullif(trim(coalesce(p_referrer, '')), ''),
      extra_count = v_extra,
      extra_names = nullif(trim(coalesce(p_extra_names, '')), ''),
      note = nullif(trim(coalesce(p_note, '')), '')
    where id = v_existing.id;
    return jsonb_build_object('ok', true, 'updated', true);
  end if;

  insert into public.signup_entries
    (sheet_id, line_user_id, member_id, display_name, real_name, phone, company, referrer, extra_count, extra_names, note)
  values
    (v_sheet.id, p_line_user_id, v_member_id, p_display_name, trim(p_real_name),
     nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_company, '')), ''),
     nullif(trim(coalesce(p_referrer, '')), ''), v_extra,
     nullif(trim(coalesce(p_extra_names, '')), ''), nullif(trim(coalesce(p_note, '')), ''));

  return jsonb_build_object('ok', true, 'updated', false);
end;
$function$;

create or replace function public.public_signup_cancel(p_token text, p_line_user_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sheet public.signup_sheets;
begin
  select * into v_sheet from public.signup_sheets where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_sheet.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  delete from public.signup_entries
   where sheet_id = v_sheet.id and line_user_id = p_line_user_id;
  return jsonb_build_object('ok', true);
end;
$function$;

-- 帶入這個人先前填過的姓名電話（會員直接用會員資料），免得每次重打
create or replace function public.public_signup_prefill(p_line_user_id text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_member public.members;
  v_last public.signup_entries;
begin
  select * into v_member from public.members
   where line_user_id = p_line_user_id and coalesce(status,'active') = 'active' limit 1;
  if found then
    return jsonb_build_object(
      'is_member', true,
      'real_name', v_member.name,
      'phone', v_member.mobile_phone,
      'company', v_member.company,
      'referrer', null
    );
  end if;

  select * into v_last from public.signup_entries
   where line_user_id = p_line_user_id
   order by created_at desc limit 1;

  return jsonb_build_object(
    'is_member', false,
    'real_name', v_last.real_name,
    'phone', v_last.phone,
    'company', v_last.company,
    'referrer', v_last.referrer
  );
end;
$function$;
