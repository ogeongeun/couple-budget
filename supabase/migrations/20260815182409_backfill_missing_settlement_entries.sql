do $$
declare
  missing_count integer;
begin
  select count(*)
  into missing_count
  from public.expenses original
  where original.use_type = '함께'
    and original.payment_type = '나눠내기'
    and original.settlement_status = '정산완료'
    and not exists (
      select 1
      from public.expenses settlement_expense
      where settlement_expense.source_type = 'settlement'
        and settlement_expense.source_expense_id = original.id
    );

  if missing_count <> 1 then
    raise exception 'Expected exactly one missing settlement entry, found %', missing_count;
  end if;
end;
$$;

with missing as (
  select
    original.*,
    (
      select profiles.id
      from public.profiles
      where profiles.couple_id = original.couple_id
        and profiles.id <> original.user_id
      limit 1
    ) as debtor_id
  from public.expenses original
  where original.use_type = '함께'
    and original.payment_type = '나눠내기'
    and original.settlement_status = '정산완료'
    and original.payer_id = original.user_id
    and not exists (
      select 1
      from public.expenses settlement_expense
      where settlement_expense.source_type = 'settlement'
        and settlement_expense.source_expense_id = original.id
    )
)
insert into public.expenses (
  couple_id, user_id, amount, category, title, memo, expense_date,
  use_type, payment_type, payer_id, my_share, partner_share,
  settlement_status, source_type, source_expense_id
)
select
  missing.couple_id, missing.debtor_id, missing.partner_share,
  missing.category,
  coalesce(nullif(missing.title, ''), nullif(missing.category, ''), '소비') || ' 정산',
  '상대방에게 보낸 정산금', coalesce(missing.settled_at::date, current_date),
  '혼자', null, missing.debtor_id, missing.partner_share, 0,
  '해당없음', 'settlement', missing.id
from missing
where missing.debtor_id is not null
  and missing.partner_share > 0;

with missing_income as (
  select original.*
  from public.expenses original
  where original.use_type = '함께'
    and original.payment_type = '나눠내기'
    and original.settlement_status = '정산완료'
    and original.payer_id = original.user_id
    and exists (
      select 1
      from public.expenses settlement_expense
      where settlement_expense.source_type = 'settlement'
        and settlement_expense.source_expense_id = original.id
    )
    and not exists (
      select 1
      from public.incomes settlement_income
      where settlement_income.source_type = 'settlement'
        and settlement_income.source_expense_id = original.id
    )
)
insert into public.incomes (
  couple_id, user_id, amount, category, memo, income_date,
  source_type, source_expense_id
)
select
  missing_income.couple_id, missing_income.payer_id, missing_income.partner_share,
  '정산금',
  coalesce(nullif(missing_income.title, ''), nullif(missing_income.category, ''), '소비') || ' 정산',
  coalesce(missing_income.settled_at::date, current_date),
  'settlement', missing_income.id
from missing_income
where missing_income.partner_share > 0
on conflict (source_expense_id)
where source_type = 'settlement'
do nothing;
