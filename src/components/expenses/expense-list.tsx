"use client";

import { useState, useMemo } from "react";
import { Card, Button, Input, Select, formatInr } from "@/components/ui";
import { calculateSettlements } from "@/lib/settlement";

type ExpenseParticipant = { userId: string; owedInr: number };

type Expense = {
  id: string;
  amountInr: number;
  description: string;
  category: string;
  payerId: string;
  payer?: { name: string | null } | null;
  ExpenseParticipant: ExpenseParticipant[];
};

export function ExpenseList({
  tripId,
  initialExpenses,
  groupMembers,
  currentUserId,
}: {
  tripId: string;
  initialExpenses: Expense[];
  groupMembers: { userId: string; name: string | null }[];
  currentUserId: string;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("food");
  const [payerId, setPayerId] = useState(currentUserId);
  const [splitMethod, setSplitMethod] = useState<"equal" | "custom">("equal");
  
  // Custom split values
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountInr, 0);
  const settlement = useMemo(() => calculateSettlements(expenses), [expenses]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    let participants: ExpenseParticipant[] = [];

    if (splitMethod === "equal") {
      const baseSplit = Math.floor(amountVal / groupMembers.length);
      let remainder = amountVal - (baseSplit * groupMembers.length);
      
      participants = groupMembers.map((m) => {
        let owed = baseSplit;
        if (remainder > 0) {
          owed += 1;
          remainder -= 1;
        }
        return {
          userId: m.userId,
          owedInr: owed,
        };
      });
    } else {
      let customTotal = 0;
      participants = groupMembers.map((m) => {
        const val = parseFloat(customSplits[m.userId] || "0");
        customTotal += val;
        return { userId: m.userId, owedInr: val };
      });
      // Validate custom sum matches total roughly
      if (Math.abs(customTotal - amountVal) > 1) {
        alert("Custom splits must equal the total amount.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountInr: amountVal,
          description,
          category,
          payerId,
          participants,
        }),
      });
      const newExpense = await res.json();
      if (res.ok) {
        setExpenses([newExpense, ...expenses]);
        setAmount("");
        setDescription("");
        setCustomSplits({});
        setSplitMethod("equal");
      } else {
        alert(newExpense.error || "Failed to add expense");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    setDeletingId(expenseId);
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses?expenseId=${expenseId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setExpenses(expenses.filter((e) => e.id !== expenseId));
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete expense");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-lg font-semibold text-ink-800">
            Actual Expenses
          </h2>
          <span className="font-semibold text-ink-900">
            {formatInr(totalExpenses)}
          </span>
        </div>

        <form onSubmit={handleAdd} className="mb-6 bg-ink-50 p-4 rounded-xl space-y-4 border border-ink-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="number"
              placeholder="Amount (₹)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full sm:w-32"
            />
            <Input
              type="text"
              placeholder="What was it for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="flex-1"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex gap-2 items-center">
              <span className="text-sm font-medium text-ink-600">Paid by:</span>
              <Select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="flex-1"
              >
                {groupMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name || "Unknown"}
                  </option>
                ))}
              </Select>
            </div>
            
            <div className="flex-1 flex gap-2 items-center">
              <span className="text-sm font-medium text-ink-600">Category:</span>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1"
              >
                <option value="food">Food</option>
                <option value="transport">Transport</option>
                <option value="stay">Stay</option>
                <option value="activity">Activity</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>

          <div className="pt-2 border-t border-ink-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-ink-700">Split Method:</span>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant={splitMethod === "equal" ? "primary" : "secondary"} 
                  size="sm"
                  onClick={() => setSplitMethod("equal")}
                >
                  Equal
                </Button>
                <Button 
                  type="button" 
                  variant={splitMethod === "custom" ? "primary" : "secondary"} 
                  size="sm"
                  onClick={() => setSplitMethod("custom")}
                >
                  Custom
                </Button>
              </div>
            </div>

            {splitMethod === "custom" && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {groupMembers.map((m) => (
                  <div key={m.userId} className="flex flex-col gap-1">
                    <label className="text-xs text-ink-500 truncate">{m.name}</label>
                    <Input 
                      type="number" 
                      placeholder="₹0"
                      value={customSplits[m.userId] || ""}
                      onChange={(e) => setCustomSplits({...customSplits, [m.userId]: e.target.value})}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : "Add Expense"}
          </Button>
        </form>

        <div className="space-y-3">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="flex justify-between items-center py-2 border-b border-ink-100 last:border-0 text-sm"
            >
              <div>
                <p className="font-medium text-ink-800">{exp.description}</p>
                <p className="text-xs text-ink-500 capitalize">
                  {exp.category} • Paid by {exp.payer?.name || "Unknown"}
                </p>
                {exp.ExpenseParticipant && exp.ExpenseParticipant.length > 0 && (
                   <p className="text-[0.6875rem] text-ink-400 mt-1">
                     Split: {exp.ExpenseParticipant.map(p => {
                       const m = groupMembers.find(gm => gm.userId === p.userId);
                       return `${m?.name || "Unknown"} (${formatInr(p.owedInr)})`;
                     }).join(", ")}
                   </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium text-ink-900">
                  {formatInr(exp.amountInr)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(exp.id)}
                  disabled={deletingId === exp.id}
                  className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors disabled:opacity-50"
                  aria-label="Delete expense"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <p className="text-sm text-ink-500 text-center py-4">
              No expenses recorded yet.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-800 mb-4">
          Settlement Summary
        </h2>
        {settlement.transactions.length === 0 ? (
          <p className="text-sm text-ink-500">Everyone is settled up! No one owes anything.</p>
        ) : (
          <div className="space-y-3">
            {settlement.transactions.map((tx, idx) => {
              const fromUser = groupMembers.find(m => m.userId === tx.fromUserId)?.name || "Unknown";
              const toUser = groupMembers.find(m => m.userId === tx.toUserId)?.name || "Unknown";
              return (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-ink-100 last:border-0 text-sm">
                  <span className="text-ink-700">
                    <span className="font-medium">{fromUser}</span> owes <span className="font-medium">{toUser}</span>
                  </span>
                  <span className="font-semibold text-ink-900">{formatInr(tx.amountInr)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
