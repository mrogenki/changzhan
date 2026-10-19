-- 一位導師可能同時帶兩組（實際情形：陳政斌帶 9、10 組；張文昱帶 12、13 組），
-- 但 members.group_name 只能放一個值，所以「兼任導師的其他組別」沒有地方記。
-- 這個欄位就是補那個缺口：自己的 group_name 之外，他還是哪幾組的導師。
alter table public.members add column if not exists mentor_groups text[];

comment on column public.members.mentor_groups is
  '兼任導師的其他組別（自己的 group_name 不必重複填）。只在職務含「導師」時有意義。';
