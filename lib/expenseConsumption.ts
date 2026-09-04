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

export function buildConsumptionExpenses<T extends ConsumptionExpense>(
  expenses: T[],
  memberIds: string[],
): T[] {
  const members = [...new Set(memberIds.filter(Boolean))];

  return expenses.flatMap((expense) => {
    if (expense.source_type === "settlement_payment") return [];
    if (expense.use_type !== "함께" || expense.payment_type !== "나눠내기") {
      return [expense];
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
    const rows: T[] = [];

    if (receiverAmount > 0) {
      rows.push({ ...expense, user_id: receiverId, amount: receiverAmount });
    }
    if (debtorId && settled > 0) {
      rows.push({
        ...expense,
        id: `${expense.id}:settled:${debtorId}`,
        user_id: debtorId,
        amount: settled,
      });
    }
    return rows;
  });
}
