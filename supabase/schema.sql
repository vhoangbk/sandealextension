create table if not exists public.products (
  id            text primary key,           -- shopId_itemId
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null default '',
  url           text not null default '',
  image         text not null default '',
  category      text not null default '',
  price         text not null default '',
  sold          numeric not null default 0,
  sold_text     text not null default '',
  affiliate_url text not null default '',
  updated_at    bigint not null default 0   -- epoch ms
);

alter table public.products enable row level security;

create policy "own rows select" on public.products for select using (user_id = auth.uid());
create policy "own rows insert" on public.products for insert with check (user_id = auth.uid());
create policy "own rows update" on public.products for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.products for delete using (user_id = auth.uid());
