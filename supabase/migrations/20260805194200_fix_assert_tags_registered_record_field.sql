-- The original function (spec 02) branched on `new.user_id is null` via COALESCE,
-- referencing `new.item_id` inside the same SQL statement. PL/pgSQL binds every
-- RECORD field reference in an embedded query eagerly, before the query's own
-- short-circuit logic runs — so `new.item_id` was dereferenced even for
-- inventory_items rows, which have no item_id column, erroring with "record
-- new has no field item_id". Branching with tg_table_name instead keeps the two
-- field accesses in separate PL/pgSQL statements, only one of which ever runs.
create or replace function public.assert_tags_registered() returns trigger as $$
declare
  owner_id uuid;
begin
  if new.tags = '{}' then return new; end if;

  if tg_table_name = 'inventory_items' then
    owner_id := new.user_id;
  else
    select i.user_id into owner_id from inventory_items i where i.id = new.item_id;
  end if;

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
$$ language plpgsql set search_path = public, pg_temp;
