alter table public.expenses
  add column if not exists source_type text,
  add column if not exists source_expense_id uuid references public.expenses(id) on delete cascade;

create unique index if not exists expenses_one_settlement_entry_per_source
  on public.expenses (source_expense_id)
  where source_type = 'settlement';

create or replace function public.complete_expense_settlement(target_expense_id uuid)
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
  settlement_amount bigint;
  settlement_title text;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into expense_row
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

  if receiver_id is null then
    raise exception '돈을 받을 사람 정보가 없습니다.';
  end if;

  if current_user_id <> receiver_id then
    raise exception '돈을 받는 사람만 정산을 완료할 수 있습니다.';
  end if;

  if expense_row.payer_id = expense_row.user_id then
    settlement_amount := coalesce(expense_row.partner_share, 0);

    select profiles.id
    into debtor_id
    from public.profiles
    where profiles.couple_id = expense_row.couple_id
      and profiles.id <> expense_row.user_id
    limit 1;
  else
    settlement_amount := coalesce(expense_row.my_share, 0);
    debtor_id := expense_row.user_id;
  end if;

  if debtor_id is null then
    raise exception '정산할 상대방을 찾지 못했습니다.';
  end if;

  if settlement_amount <= 0 then
    raise exception '정산할 금액이 없습니다.';
  end if;

  settlement_title := coalesce(
    nullif(expense_row.title, ''),
    nullif(expense_row.category, ''),
    '소비'
  ) || ' 정산';

  if expense_row.settlement_status = '정산완료' then
    return jsonb_build_object(
      'success', true,
      'already_completed', true,
      'message', '이미 정산이 완료되었습니다.'
    );
  end if;

  update public.expenses
  set settlement_status = '정산완료', settled_at = now()
  where id = target_expense_id;

  insert into public.expenses (
    couple_id, user_id, amount, category, title, memo, expense_date,
    use_type, payment_type, payer_id, my_share, partner_share,
    settlement_status, source_type, source_expense_id
  )
  values (
    expense_row.couple_id, debtor_id, settlement_amount,
    expense_row.category, settlement_title, '상대방에게 보낸 정산금', current_date,
    '혼자', null, debtor_id, settlement_amount, 0,
    '해당없음', 'settlement', target_expense_id
  )
  on conflict (source_expense_id)
  where source_type = 'settlement'
  do nothing;

  insert into public.incomes (
    couple_id, user_id, amount, category, memo, income_date,
    source_type, source_expense_id
  )
  values (
    expense_row.couple_id, receiver_id, settlement_amount, '정산금',
    settlement_title, current_date, 'settlement', target_expense_id
  )
  on conflict (source_expense_id)
  where source_type = 'settlement'
  do nothing;

  return jsonb_build_object(
    'success', true,
    'already_completed', false,
    'receiver_id', receiver_id,
    'debtor_id', debtor_id,
    'amount', settlement_amount,
    'message', '정산이 완료되었습니다.'
  );
end;
$$;

revoke execute on function public.complete_expense_settlement(uuid) from public, anon;
grant execute on function public.complete_expense_settlement(uuid) to authenticated;
