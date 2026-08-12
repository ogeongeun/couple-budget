-- 개인별 지난주 예산 80% 달성 보상과 커플 공용 중복 없는 뽑기
create extension if not exists pgcrypto;
create table if not exists public.reward_items(id uuid primary key default gen_random_uuid(),code text not null unique,name text not null,category text not null check(category in('hat','collar','bowl','piggy_bank')),rarity text not null default 'common' check(rarity in('common','rare','legendary')),sprite_index integer not null unique check(sprite_index between 0 and 11),is_active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.reward_tickets(user_id uuid primary key references auth.users(id) on delete cascade,balance integer not null default 0 check(balance>=0),updated_at timestamptz not null default now());
create table if not exists public.reward_periods(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,couple_id uuid not null references public.couples(id) on delete cascade,period_month date not null,budget numeric not null,spent numeric not null,qualified boolean not null,ticket_awarded boolean not null default false,created_at timestamptz not null default now(),unique(user_id,period_month));
create table if not exists public.user_inventory(id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id) on delete cascade,item_id uuid not null references public.reward_items(id) on delete cascade,drawn_by uuid not null references auth.users(id) on delete cascade,acquired_at timestamptz not null default now(),unique(couple_id,item_id));
create table if not exists public.reward_draw_history(id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,item_id uuid not null references public.reward_items(id) on delete cascade,created_at timestamptz not null default now());
insert into public.reward_items(code,name,category,rarity,sprite_index) values
('mint_beret','민트 베레모','hat','common',0),('party_hat','노랑 파티 모자','hat','common',1),('pink_bucket_hat','분홍 버킷햇','hat','common',2),('crown_cap','왕관 캡','hat','common',3),('mint_collar','민트 목줄','collar','common',4),('red_bow_collar','빨강 리본 목줄','collar','common',5),('blue_bandana','하늘 반다나','collar','common',6),('star_collar','별 목줄','collar','common',7),('mint_bowl','민트 밥그릇','bowl','common',8),('pink_piggy','분홍 저금통','piggy_bank','common',9),('yellow_bowl','노랑 밥그릇','bowl','common',10),('blue_piggy','파랑 저금통','piggy_bank','common',11)
on conflict(code) do update set name=excluded.name,category=excluded.category,rarity=excluded.rarity,sprite_index=excluded.sprite_index;
alter table public.reward_items enable row level security; alter table public.reward_tickets enable row level security; alter table public.reward_periods enable row level security; alter table public.user_inventory enable row level security; alter table public.reward_draw_history enable row level security;
drop policy if exists "reward items readable" on public.reward_items; create policy "reward items readable" on public.reward_items for select to authenticated using(true);
drop policy if exists "own tickets readable" on public.reward_tickets; create policy "own tickets readable" on public.reward_tickets for select to authenticated using(user_id=auth.uid());
drop policy if exists "own periods readable" on public.reward_periods; create policy "own periods readable" on public.reward_periods for select to authenticated using(user_id=auth.uid());
drop policy if exists "shared inventory readable" on public.user_inventory; create policy "shared inventory readable" on public.user_inventory for select to authenticated using(couple_id=(select couple_id from public.profiles where id=auth.uid()));
drop policy if exists "shared history readable" on public.reward_draw_history; create policy "shared history readable" on public.reward_draw_history for select to authenticated using(couple_id=(select couple_id from public.profiles where id=auth.uid()));
create or replace function public.claim_weekly_reward() returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); c uuid; w date:=(date_trunc('week',current_date)-interval '1 week')::date; n date:=date_trunc('week',current_date)::date; m date; b numeric:=0; s numeric:=0; q boolean:=false; a boolean:=false;
begin
if u is null then raise exception '로그인이 필요해요.'; end if; select couple_id into c from profiles where id=u; if c is null then raise exception '커플 연결이 필요해요.'; end if;
m:=date_trunc('month',w)::date;
select coalesce(sum(amount),0)/4 into b from incomes where couple_id=c and user_id=u and income_date>=m and income_date<(m+interval '1 month');
select coalesce(sum(amount),0) into s from expenses where couple_id=c and user_id=u and expense_date>=w and expense_date<n;
q:=b>0 and s<=b*.8;
insert into reward_periods(user_id,couple_id,period_month,budget,spent,qualified,ticket_awarded) values(u,c,w,b,s,q,q) on conflict(user_id,period_month) do nothing;
if found and q then insert into reward_tickets(user_id,balance) values(u,1) on conflict(user_id) do update set balance=reward_tickets.balance+1,updated_at=now(); a:=true; end if;
return jsonb_build_object('week_start',w,'budget',b,'spent',s,'qualified',q,'awarded',a); end; $$;
create or replace function public.draw_reward_item() returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); c uuid; i reward_items%rowtype; b integer;
begin
if u is null then raise exception '로그인이 필요해요.'; end if; select couple_id into c from profiles where id=u; if c is null then raise exception '커플 연결이 필요해요.'; end if;
select balance into b from reward_tickets where user_id=u for update; if coalesce(b,0)<1 then raise exception '사용할 수 있는 뽑기권이 없어요.'; end if;
select x.* into i from reward_items x where x.is_active and not exists(select 1 from user_inventory y where y.couple_id=c and y.item_id=x.id) order by random() limit 1;
if i.id is null then raise exception '현재 아이템을 모두 모았어요. 뽑기권은 그대로 보관돼요.'; end if;
update reward_tickets set balance=balance-1,updated_at=now() where user_id=u; insert into user_inventory(couple_id,item_id,drawn_by) values(c,i.id,u); insert into reward_draw_history(couple_id,user_id,item_id) values(c,u,i.id); return to_jsonb(i); end; $$;
revoke all on function public.claim_weekly_reward() from public; revoke all on function public.draw_reward_item() from public; grant execute on function public.claim_weekly_reward() to authenticated; grant execute on function public.draw_reward_item() to authenticated;

-- 커플이 함께 사용하는 현재 착용 아이템. 종류별로 하나만 선택한다.
create table if not exists public.equipped_reward_items(
  couple_id uuid not null references public.couples(id) on delete cascade,
  category text not null check(category in('hat','collar','bowl','piggy_bank')),
  item_id uuid not null references public.reward_items(id) on delete cascade,
  equipped_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key(couple_id,category)
);
alter table public.equipped_reward_items enable row level security;
drop policy if exists "shared equipment readable" on public.equipped_reward_items;
create policy "shared equipment readable" on public.equipped_reward_items for select to authenticated using(couple_id=(select couple_id from public.profiles where id=auth.uid()));

create or replace function public.equip_reward_item(target_item uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); c uuid; i reward_items%rowtype;
begin
if u is null then raise exception '로그인이 필요해요.'; end if;
select couple_id into c from profiles where id=u; if c is null then raise exception '커플 연결이 필요해요.'; end if;
select x.* into i from reward_items x join user_inventory y on y.item_id=x.id where x.id=target_item and y.couple_id=c;
if i.id is null then raise exception '보유한 아이템만 착용할 수 있어요.'; end if;
insert into equipped_reward_items(couple_id,category,item_id,equipped_by) values(c,i.category,i.id,u)
on conflict(couple_id,category) do update set item_id=excluded.item_id,equipped_by=excluded.equipped_by,updated_at=now();
return to_jsonb(i); end; $$;
revoke all on function public.equip_reward_item(uuid) from public;
grant execute on function public.equip_reward_item(uuid) to authenticated;

create or replace function public.unequip_reward_item(target_category text) returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); c uuid;
begin
if u is null then raise exception '로그인이 필요해요.'; end if;
if target_category not in ('hat','collar','bowl','piggy_bank') then raise exception '올바르지 않은 아이템 종류예요.'; end if;
select couple_id into c from profiles where id=u; if c is null then raise exception '커플 연결이 필요해요.'; end if;
delete from equipped_reward_items where couple_id=c and category=target_category;
end; $$;
revoke all on function public.unequip_reward_item(text) from public;
grant execute on function public.unequip_reward_item(text) to authenticated;

-- 처음 기능을 확인할 수 있도록 커플당 모자와 목줄을 하나씩 지급하고 착용한다.
create or replace function public.claim_starter_reward_items() returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); c uuid; hat uuid; collar uuid;
begin
if u is null then raise exception '로그인이 필요해요.'; end if;
select couple_id into c from profiles where id=u; if c is null then raise exception '커플 연결이 필요해요.'; end if;
select id into hat from reward_items where code='mint_beret';
select id into collar from reward_items where code='red_bow_collar';
insert into user_inventory(couple_id,item_id,drawn_by) values(c,hat,u),(c,collar,u) on conflict(couple_id,item_id) do nothing;
return jsonb_build_object('hat',hat,'collar',collar); end; $$;
revoke all on function public.claim_starter_reward_items() from public;
grant execute on function public.claim_starter_reward_items() to authenticated;

-- 개발 중 착용 조합을 확인하기 위한 임시 지급 함수.
create or replace function public.grant_all_reward_items_for_testing() returns integer
language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); c uuid; granted integer;
begin
  if u is null then raise exception '로그인이 필요해요.'; end if;
  select couple_id into c from profiles where id=u;
  if c is null then raise exception '커플 연결이 필요해요.'; end if;
  insert into user_inventory(couple_id,item_id,drawn_by)
  select c,id,u from reward_items where is_active
  on conflict(couple_id,item_id) do nothing;
  get diagnostics granted = row_count;
  return granted;
end; $$;
revoke all on function public.grant_all_reward_items_for_testing() from public;
grant execute on function public.grant_all_reward_items_for_testing() to authenticated;
