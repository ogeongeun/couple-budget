export type ConsumptionExpense = {
  id: string;
  user_id: string;
  amount: number;
  use_type: string;
  payment_type: string | null;
  payer_id?: string | null;
  my_share?: number | null;
  partner_share?: number | null;
  settled_amount?: number | null;
  source_type?: string | null;
};

export type ConsumptionDisplayExpense<T extends ConsumptionExpense> = T & {
  original_expense_id: string;
  original_user_id: string;
  recorded_amount: number;
  is_settlement_allocation: boolean;
};

export function buildConsumptionExpenses<T extends ConsumptionExpense>(
  expenses: T[],
  memberIds: string[],
): ConsumptionDisplayExpense<T>[] {
  const members = [...new Set(memberIds.filter(Boolean))];

  return expenses.flatMap((expense) => {
    if (
      expense.source_type === "settlement" ||
      expense.source_type === "settlement_payment" ||
      expense.source_type === "balance_adjustment"
    ) {
      return [];
    }
    const original = {
      original_expense_id: expense.id,
      original_user_id: expense.user_id,
      recorded_amount: Number(expense.amount || 0),
      is_settlement_allocation: false,
    };
    if (expense.use_type !== "함께" || expense.payment_type !== "나눠내기") {
      return [{ ...expense, ...original }];
    }

    const receiverId = expense.payer_id ?? expense.user_id;
    const debtorId =
      receiverId === expense.user_id
        ? members.find((id) => id !== expense.user_id)
        : expense.user_id;
    const settlementTotal =
      receiverId === expense.user_id
        ? Number(expense.partner_share || 0)
        : Number(expense.my_share || 0);
    const settled = Math.min(
      Math.max(0, Number(expense.settled_amount || 0)),
      settlementTotal,
    );
    const receiverAmount = Math.max(0, Number(expense.amount || 0) - settled);
    const rows: ConsumptionDisplayExpense<T>[] = [];

    if (receiverAmount > 0) {
      rows.push({
        ...expense,
        ...original,
        user_id: receiverId,
        amount: receiverAmount,
      });
    }
    if (debtorId && settled > 0) {
      rows.push({
        ...expense,
        id: `${expense.id}:settled:${debtorId}`,
        user_id: debtorId,
        amount: settled,
        ...original,
        is_settlement_allocation: true,
      });
    }
    return rows;
  });
}
