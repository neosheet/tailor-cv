create table skill_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table inventory_items
  add column category_id uuid references skill_categories(id) on delete set null;

alter table inventory_items
  add constraint chk_category_only_skill
  check (category_id is null or kind = 'skill');

create trigger touch before update on skill_categories
  for each row execute function touch_updated_at();

alter table skill_categories enable row level security;

create policy "own categories" on skill_categories
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on inventory_items (category_id);
