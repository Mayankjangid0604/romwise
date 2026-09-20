"use client";

import { useState } from "react";
import { Card, Button, Input, Select, formatInr } from "@/components/ui";

export function ExpenseList({ tripId, initialExpenses }: { tripId: string, initialExpenses: { id: string, amountInr: number, description: string, category: string, payer?: { name: string | null } | null }[] }) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("food");
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountInr: amount, description, category })
      });
      const newExpense = await res.json();
      if (res.ok) {
        setExpenses([newExpense, ...expenses]);
        setAmount("");
        setDescription("");
      }
    } finally {
      setLoading(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountInr, 0);

  return (
    <Card className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-lg font-semibold text-ink-800">Actual Expenses</h2>
        <span className="font-semibold text-ink-900">{formatInr(totalExpenses)}</span>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <Input 
          type="number" 
          placeholder="Amount (₹)" 
          value={amount} 
          onChange={(e) => setAmount(e.target.value)} 
          required 
          className="w-32"
        />
        <Input 
          type="text" 
          placeholder="What was it for?" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          required 
          className="flex-1"
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-32">
          <option value="food">Food</option>
          <option value="transport">Transport</option>
          <option value="stay">Stay</option>
          <option value="activity">Activity</option>
          <option value="other">Other</option>
        </Select>
        <Button type="submit" disabled={loading}>{loading ? "..." : "Add"}</Button>
      </form>

      <div className="space-y-3">
        {expenses.map(exp => (
          <div key={exp.id} className="flex justify-between items-center py-2 border-b border-ink-100 last:border-0 text-sm">
            <div>
              <p className="font-medium text-ink-800">{exp.description}</p>
              <p className="text-xs text-ink-500 capitalize">{exp.category} • Paid by {exp.payer?.name || "you"}</p>
            </div>
            <span className="font-medium text-ink-900">{formatInr(exp.amountInr)}</span>
          </div>
        ))}
        {expenses.length === 0 && (
          <p className="text-sm text-ink-500 text-center py-4">No expenses recorded yet.</p>
        )}
      </div>
    </Card>
  );
}
