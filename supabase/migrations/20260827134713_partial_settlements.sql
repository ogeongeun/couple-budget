alter table public.expenses
  add column if not exists settled_amount bigint not null default 0,
  add column if not exists settlement_sent_amount bigint not null default 0;

create table if not exists public.settlement_payments (
  id uuid primary key default gen_random_uuid(),
  source_expense_id uuid not null references public.expenses(id) on delete cascade,
  couple_id uuid not null,
  debtor_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  sent_at timestamptz,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.expenses
  add column if not exists source_settlement_payment_id uuid
    references public.settlement_payments(id) on delete cascade;

alter table public.incomes
  add column if not exists source_settlement_payment_id uuid
    references public.settlement_payments(id) on delete cascade;

create unique index if not exists expenses_unique_settlement_payment_idx
  on public.expenses (source_settlement_payment_id)
  where source_settlement_payment_id is not null;

create unique index if not exists incomes_unique_settlement_payment_idx
  on public.incomes (source_settlement_payment_id)
  where source_settlement_payment_id is not null;

create index if not exists settlement_payments_source_expense_idx
  on public.settlement_payments (source_expense_id, confirmed_at desc);

alter table public.settlement_payments enable row level security;

drop policy if exists "Couple members can view settlement payments"
  on public.settlement_payments;

create policy "Couple members can view settlement payments"
  on public.settlement_payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.couple_id = settlement_payments.couple_id
    )
  );

revoke all on table public.settlement_payments from public, anon;
revoke insert, update, delete on table public.settlement_payments from authenticated;
grant select on table public.settlement_payments to authenticated;

update public.expenses
set settled_amount = case
  when settlement_status = '정산완료' then
    case
      when payer_id = user_id then coalesce(partner_share, 0)
      else coalesce(my_share, 0)
    end
  else 0
end
where use_type = '함께'
  and payment_type = '나눠내기';

update public.expenses
set settlement_sent_amount = case
  when settlement_sent_at is not null and settlement_status <> '정산완료' then
    greatest(
      0,
      case
        when payer_id = user_id then coalesce(partner_share, 0)
        else coalesce(my_share, 0)
      end - settled_amount
    )
  else 0
end
where use_type = '함께'
  and payment_type = '나눠내기';

create or replace function public.mark_partial_settlement_sent(
  target_expense_id uuid,
  payment_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  expense_row public.expenses%rowtype;
  debtor_id uuid;
  total_amount bigint;
  remaining_amount bigint;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if not found then
    raise exception '정산 기록을 찾을 수 없습니다.';
  end if;

  if expense_row.couple_id is distinct from (
    select profiles.couple_id
    from public.profiles
    where profiles.id = current_user_id
  ) then
    raise exception '이 정산 기록에 접근할 수 없습니다.';
  end if;

  if expense_row.use_type <> '함께'
    or expense_row.payment_type <> '나눠내기' then
    raise exception '나눠내기 기록만 정산할 수 있습니다.';
  end if;

  if expense_row.payer_id = expense_row.user_id then
    total_amount := coalesce(expense_row.partner_share, 0);

    select profiles.id into debtor_id
    from public.profiles
    where profiles.couple_id = expense_row.couple_id
      and profiles.id <> expense_row.user_id
    limit 1;
  else
    total_amount := coalesce(expense_row.my_share, 0);
    debtor_id := expense_row.user_id;
  end if;

  if current_user_id <> debtor_id then
    raise exception '돈을 보내야 하는 사람만 처리할 수 있습니다.';
  end if;

  remaining_amount := total_amount - coalesce(expense_row.settled_amount, 0);

  if remaining_amount <= 0 then
    raise exception '이미 정산이 완료되었습니다.';
  end if;

  if payment_amount is null or payment_amount <= 0 then
    raise exception '보낸 금액을 입력해 주세요.';
  end if;

  if payment_amount > remaining_amount then
    raise exception '남은 정산액보다 많이 입력할 수 없습니다.';
  end if;

  if coalesce(expense_row.settlement_sent_amount, 0) > 0 then
    raise exception '상대방 확인을 기다리는 송금이 이미 있습니다.';
  end if;

  update public.expenses
  set settlement_sent_at = now(),
      settlement_sent_by = current_user_id,
      settlement_sent_amount = payment_amount
  where id = target_expense_id;

  return jsonb_build_object(
    'success', true,
    'sent_amount', payment_amount,
    'remaining_amount', remaining_amount
  );
end;
$$;

create or replace function public.complete_partial_expense_settlement(
  target_expense_id uuid,
  payment_amount bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  expense_row public.expenses%rowtype;
  receiver_id uuid;
  debtor_id uuid;
  total_amount bigint;
  remaining_amount bigint;
  confirmed_amount bigint;
  new_settled_amount bigint;
  pending_sent_amount bigint;
  payment_id uuid;
  settlement_title text;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if not found then
    raise exception '정산 기록을 찾을 수 없습니다.';
  end if;

  if expense_row.couple_id is distinct from (
    select profiles.couple_id
    from public.profiles
    where profiles.id = current_user_id
  ) then
    raise exception '이 정산 기록에 접근할 수 없습니다.';
  end if;

  if expense_row.use_type <> '함께'
    or expense_row.payment_type <> '나눠내기' then
    raise exception '나눠내기 기록만 정산할 수 있습니다.';
  end if;

  receiver_id := expense_row.payer_id;

  if receiver_id is null or current_user_id <> receiver_id then
    raise exception '돈을 받는 사람만 정산을 완료할 수 있습니다.';
  end if;

  if expense_row.payer_id = expense_row.user_id then
    total_amount := coalesce(expense_row.partner_share, 0);

    select profiles.id into debtor_id
    from public.profiles
    where profiles.couple_id = expense_row.couple_id
      and profiles.id <> expense_row.user_id
    limit 1;
  else
    total_amount := coalesce(expense_row.my_share, 0);
    debtor_id := expense_row.user_id;
  end if;

  if debtor_id is null then
    raise exception '정산할 상대방을 찾지 못했습니다.';
  end if;

  remaining_amount := total_amount - coalesce(expense_row.settled_amount, 0);
  pending_sent_amount := coalesce(expense_row.settlement_sent_amount, 0);
  confirmed_amount := coalesce(
    payment_amount,
    nullif(pending_sent_amount, 0),
    remaining_amount
  );

  if remaining_amount <= 0 then
    return jsonb_build_object(
      'success', true,
      'already_completed', true,
      'remaining_amount', 0
    );
  end if;

  if confirmed_amount <= 0 then
    raise exception '받은 금액을 입력해 주세요.';
  end if;

  if confirmed_amount > remaining_amount then
    raise exception '남은 정산액보다 많이 입력할 수 없습니다.';
  end if;

  if pending_sent_amount > 0 and confirmed_amount > pending_sent_amount then
    raise exception '상대방이 보냈다고 표시한 금액보다 많이 확인할 수 없습니다.';
  end if;

  settlement_title := coalesce(
    nullif(expense_row.title, ''),
    nullif(expense_row.category, ''),
    '소비'
  ) || ' 부분 정산';

  insert into public.settlement_payments (
    source_expense_id,
    couple_id,
    debtor_id,
    receiver_id,
    amount,
    sent_at
  )
  values (
    target_expense_id,
    expense_row.couple_id,
    debtor_id,
    receiver_id,
    confirmed_amount,
    case when pending_sent_amount > 0 then expense_row.settlement_sent_at else null end
  )
  returning id into payment_id;

  insert into public.expenses (
    couple_id, user_id, amount, category, title, memo, expense_date,
    use_type, payment_type, payer_id, my_share, partner_share,
    settlement_status, source_type, source_expense_id,
    source_settlement_payment_id
  )
  values (
    expense_row.couple_id, debtor_id, confirmed_amount,
    expense_row.category, settlement_title, '상대방에게 보낸 정산금', current_date,
    '혼자', null, debtor_id, confirmed_amount, 0,
    '해당없음', 'settlement_payment', target_expense_id, payment_id
  );

  insert into public.incomes (
    couple_id, user_id, amount, category, memo, income_date,
    source_type, source_expense_id, source_settlement_payment_id
  )
  values (
    expense_row.couple_id, receiver_id, confirmed_amount, '정산금',
    settlement_title, current_date,
    'settlement_payment', target_expense_id, payment_id
  );

  new_settled_amount := coalesce(expense_row.settled_amount, 0) + confirmed_amount;
  pending_sent_amount := greatest(0, pending_sent_amount - confirmed_amount);

  update public.expenses
  set settled_amount = new_settled_amount,
      settlement_sent_amount = pending_sent_amount,
      settlement_sent_at = case when pending_sent_amount = 0 then null else settlement_sent_at end,
      settlement_sent_by = case when pending_sent_amount = 0 then null else settlement_sent_by end,
      settlement_status = case
        when new_settled_amount >= total_amount then '정산완료'
        else '정산대기'
      end,
      settled_at = case
        when new_settled_amount >= total_amount then now()
        else null
      end
  where id = target_expense_id;

  return jsonb_build_object(
    'success', true,
    'already_completed', false,
    'payment_id', payment_id,
    'amount', confirmed_amount,
    'settled_amount', new_settled_amount,
    'remaining_amount', greatest(0, total_amount - new_settled_amount),
    'completed', new_settled_amount >= total_amount
  );
end;
$$;

create or replace function public.mark_settlement_sent(target_expense_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expense_row public.expenses%rowtype;
  total_amount bigint;
begin
  select * into expense_row
  from public.expenses
  where id = target_expense_id;

  if not found then
    raise exception '정산 기록을 찾을 수 없습니다.';
  end if;

  total_amount := case
    when expense_row.payer_id = expense_row.user_id then coalesce(expense_row.partner_share, 0)
    else coalesce(expense_row.my_share, 0)
  end;

  return public.mark_partial_settlement_sent(
    target_expense_id,
    total_amount - coalesce(expense_row.settled_amount, 0)
  );
end;
$$;

create or replace function public.complete_expense_settlement(target_expense_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.complete_partial_expense_settlement(target_expense_id, null);
$$;

revoke execute on function public.mark_partial_settlement_sent(uuid, bigint)
  from public, anon;
revoke execute on function public.complete_partial_expense_settlement(uuid, bigint)
  from public, anon;
revoke execute on function public.mark_settlement_sent(uuid)
  from public, anon;
revoke execute on function public.complete_expense_settlement(uuid)
  from public, anon;

grant execute on function public.mark_partial_settlement_sent(uuid, bigint)
  to authenticated;
grant execute on function public.complete_partial_expense_settlement(uuid, bigint)
  to authenticated;
grant execute on function public.mark_settlement_sent(uuid)
  to authenticated;
grant execute on function public.complete_expense_settlement(uuid)
  to authenticated;
