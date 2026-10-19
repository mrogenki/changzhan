-- 363 續約名單新增「組別導師」欄，與既有的 committee（組別執事）並列。
-- 兩欄都是「自動帶入該組的人，手填過的以人填的為準」，所以 DB 只存手填值。
alter table public.renewal_notes add column if not exists mentor text;

comment on column public.renewal_notes.committee is '組別執事（手填值；留空則由前端自動帶入該組執事）';
comment on column public.renewal_notes.mentor    is '組別導師（手填值；留空則由前端自動帶入該組導師）';
