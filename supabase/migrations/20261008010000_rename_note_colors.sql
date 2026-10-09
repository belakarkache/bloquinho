alter table public.notes drop constraint notes_color_check;

update public.notes
set color = case color
  when 'red' then 'coral'
  when 'orange' then 'lemon'
  when 'yellow' then 'lemon'
  when 'green' then 'mint'
  when 'teal' then 'aqua'
  when 'blue' then 'sky'
  when 'purple' then 'lavender'
  when 'pink' then 'bubblegum'
  else color
end
where color in ('red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink');

alter table public.notes add constraint notes_color_check
  check (color in ('default', 'lemon', 'lime', 'mint', 'aqua', 'sky', 'lavender', 'bubblegum', 'coral'));
