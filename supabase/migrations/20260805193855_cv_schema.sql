create table cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cv_sections (
  cv_id uuid not null references cvs(id) on delete cascade,
  kind item_kind not null,
  position int not null default 0,
  primary key (cv_id, kind)
);

create table cv_items (
  cv_id uuid not null references cvs(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  position int not null default 0,
  primary key (cv_id, item_id)
);

create table cv_lines (
  cv_id uuid not null,
  item_id uuid not null,
  line_id uuid not null references inventory_lines(id) on delete cascade,
  position int not null default 0,
  primary key (cv_id, line_id),
  foreign key (cv_id, item_id) references cv_items (cv_id, item_id) on delete cascade
);

create or replace function cv_line_belongs_to_item() returns trigger as $$
begin
  if not exists (
    select 1 from inventory_lines
     where id = new.line_id and item_id = new.item_id
  ) then
    raise exception 'cv_lines: line % does not belong to item %', new.line_id, new.item_id;
  end if;
  return new;
end $$ language plpgsql;

create trigger check_parent before insert or update on cv_lines
  for each row execute function cv_line_belongs_to_item();

create trigger touch before update on cvs for each row execute function touch_updated_at();

alter table cvs enable row level security;
alter table cv_sections enable row level security;
alter table cv_items enable row level security;
alter table cv_lines enable row level security;

create policy "own rows" on cvs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sections" on cv_sections
  for all to authenticated using (
    exists (select 1 from cvs c where c.id = cv_sections.cv_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from cvs c where c.id = cv_sections.cv_id and c.user_id = auth.uid())
  );

create policy "own items" on cv_items
  for all to authenticated using (
    exists (select 1 from cvs c where c.id = cv_items.cv_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from cvs c where c.id = cv_items.cv_id and c.user_id = auth.uid())
  );

create policy "own lines" on cv_lines
  for all to authenticated using (
    exists (select 1 from cvs c where c.id = cv_lines.cv_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from cvs c where c.id = cv_lines.cv_id and c.user_id = auth.uid())
  );

create index on cvs (user_id);
create index on cv_sections (cv_id, position);
create index on cv_items (cv_id, position);
create index on cv_items (item_id);
create index on cv_lines (cv_id, item_id, position);
create index on cv_lines (line_id);
