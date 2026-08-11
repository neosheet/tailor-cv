alter table applications add column archived_at timestamptz;
create index on applications (user_id, archived_at);
