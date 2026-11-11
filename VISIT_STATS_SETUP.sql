-- ODDLY daily + total visits (Korea Standard Time)
-- Run once in Supabase SQL Editor.
create table if not exists public.oddly_daily_visits (
  visit_date date primary key,
  visit_count bigint not null default 0 check (visit_count >= 0)
);
alter table public.oddly_daily_visits enable row level security;
revoke all on public.oddly_daily_visits from anon, authenticated;
create or replace function public.oddly_visit_stats(register_view boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
  total_count bigint;
  daily_count bigint;
begin
  -- Preserve the existing lifetime counter and its behavior.
  if register_view then
    select public.oddly_register_visit() into total_count;
    insert into public.oddly_daily_visits (visit_date, visit_count)
    values (today_kst, 1)
    on conflict (visit_date) do update
      set visit_count = public.oddly_daily_visits.visit_count + 1;
  else
    select public.oddly_get_visits() into total_count;
  end if;
  select coalesce(visit_count, 0) into daily_count
    from public.oddly_daily_visits where visit_date = today_kst;
  return jsonb_build_object(
    'today', coalesce(daily_count, 0),
    'total', coalesce(total_count, 0),
    'date', today_kst
  );
end;
$$;
grant execute on function public.oddly_visit_stats(boolean) to anon, authenticated;
