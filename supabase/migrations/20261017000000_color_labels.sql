create table public.color_labels (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  color text not null
    check (color in ('default', 'lemon', 'lime', 'mint', 'aqua', 'sky', 'lavender', 'bubblegum', 'coral')),
  name text not null default '' check (char_length(name) <= 30),
  updated_at timestamptz not null,
  constraint color_labels_pkey primary key (user_id, color)
);

alter table public.color_labels enable row level security;
revoke all on table public.color_labels from anon, authenticated;

create function public.sync_color_labels(payload jsonb default '[]'::jsonb)
returns table (color text, name text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
begin
  if owner is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) > 9 then
    raise exception 'payload must be an array with at most 9 labels' using errcode = 'PT413';
  end if;

  perform private.consume_rate_limit('color_labels', 30);

  insert into public.color_labels as c (user_id, color, name, updated_at)
  select owner, l.color, l.name, l.updated_at
  from jsonb_to_recordset(payload) as l (color text, name text, updated_at timestamptz)
  on conflict on constraint color_labels_pkey do update set
    name = excluded.name,
    updated_at = excluded.updated_at
  where c.updated_at < excluded.updated_at;

  return query
    select c.color, c.name, c.updated_at
    from public.color_labels as c
    where c.user_id = owner;
end;
$$;

revoke execute on function public.sync_color_labels(jsonb) from public, anon;
grant execute on function public.sync_color_labels(jsonb) to authenticated;
