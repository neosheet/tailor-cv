create type item_kind as enum (
  'name', 'headline', 'summary', 'contact', 'location', 'social',
  'work', 'volunteer', 'education', 'award', 'certificate',
  'publication', 'skill', 'language', 'interest', 'reference', 'project'
);

create type line_kind as enum (
  'highlights', 'responsibilities', 'courses', 'keywords', 'roles'
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind item_kind not null,
  title text not null,
  subtitle text,
  summary text,
  url text,
  start_date text,
  end_date text,
  details jsonb not null default '{}',
  years_experience numeric(4,1),
  tags text[] not null default '{}',
  note text,
  favorite boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_item_kind unique (id, kind),
  check (years_experience is null or (kind = 'skill' and years_experience >= 0)),
  check (start_date is null or start_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  check (end_date is null or end_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table inventory_lines (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  list_kind line_kind not null,
  content text not null,
  tags text[] not null default '{}',
  note text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table item_skills (
  item_id uuid not null references inventory_items(id) on delete cascade,
  skill_id uuid not null,
  skill_kind item_kind not null default 'skill' check (skill_kind = 'skill'),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, skill_id),
  check (item_id <> skill_id),
  foreign key (skill_id, skill_kind) references inventory_items(id, kind) on delete cascade
);

create index on item_skills (skill_id);

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  check (name ~ '^[a-z0-9]+$')
);

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

create trigger touch before update on profiles for each row execute function touch_updated_at();
create trigger touch before update on inventory_items for each row execute function touch_updated_at();
create trigger touch before update on inventory_lines for each row execute function touch_updated_at();
create trigger touch before update on item_skills for each row execute function touch_updated_at();
create trigger touch before update on tags for each row execute function touch_updated_at();

create or replace function assert_tags_registered() returns trigger as $$
declare owner_id uuid;
begin
  if new.tags = '{}' then return new; end if;

  owner_id := coalesce(
    new.user_id,
    (select i.user_id from inventory_items i where i.id = new.item_id)
  );

  if exists (
    select 1 from unnest(new.tags) as t(name)
     where not exists (
       select 1 from tags
        where tags.user_id = owner_id and tags.name = t.name)
  ) then
    raise exception 'tags must exist in the tag registry';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger assert_tags_registered before insert or update on inventory_items
  for each row execute function assert_tags_registered();
create trigger assert_tags_registered before insert or update on inventory_lines
  for each row execute function assert_tags_registered();

alter table profiles enable row level security;
alter table inventory_items enable row level security;
alter table inventory_lines enable row level security;
alter table item_skills enable row level security;
alter table tags enable row level security;

create policy "own row" on profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "own rows" on inventory_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tags" on tags
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own lines" on inventory_lines
  for all to authenticated using (
    exists (select 1 from inventory_items i where i.id = inventory_lines.item_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from inventory_items i where i.id = inventory_lines.item_id and i.user_id = auth.uid())
  );

create policy "own links" on item_skills
  for all to authenticated using (
    exists (select 1 from inventory_items i where i.id = item_skills.item_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from inventory_items i where i.id = item_skills.item_id and i.user_id = auth.uid())
  );

create index on inventory_items (user_id, kind, favorite desc, position);
create index on inventory_lines (item_id, list_kind, position);
create index on inventory_items using gin (tags);
create index on inventory_lines using gin (tags);
