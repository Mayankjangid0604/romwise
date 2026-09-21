export type ExpenseRecord = {
  id: string;
  payerId: string;
  amountInr: number;
  ExpenseParticipant: {
    userId: string;
    owedInr: number;
  }[];
};

export type SettlementTransaction = {
  fromUserId: string;
  toUserId: string;
  amountInr: number;
};

export type SettlementSummary = {
  balances: Record<string, number>; // userId -> net balance (positive = owed to them, negative = they owe)
  transactions: SettlementTransaction[]; // who owes whom
};

export function calculateSettlements(expenses: ExpenseRecord[]): SettlementSummary {
  const balances: Record<string, number> = {};

  // Calculate net balance for each user
  for (const expense of expenses) {
    // Payer gets credited
    balances[expense.payerId] = (balances[expense.payerId] || 0) + expense.amountInr;

    // Participants get debited
    for (const participant of expense.ExpenseParticipant) {
      balances[participant.userId] = (balances[participant.userId] || 0) - participant.owedInr;
    }
  }

  // Separate into debtors (negative balance) and creditors (positive balance)
  const debtors: { userId: string; amount: number }[] = [];
  const creditors: { userId: string; amount: number }[] = [];

  for (const [userId, balance] of Object.entries(balances)) {
    if (balance < 0) {
      debtors.push({ userId, amount: -balance }); // amount they owe (positive number for logic)
    } else if (balance > 0) {
      creditors.push({ userId, amount: balance }); // amount owed to them
    }
  }

  // Sort by amount descending to minimize transactions (greedy approach)
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: SettlementTransaction[] = [];
  let dIndex = 0;
  let cIndex = 0;

  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex];
    const creditor = creditors[cIndex];

    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0) {
      transactions.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountInr: settleAmount,
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount === 0) dIndex++;
    if (creditor.amount === 0) cIndex++;
  }

  return { balances, transactions };
}
