"use client";

import { useState, useTransition } from "react";
import { generatePacking, addCustomPackingItem } from "@/app/actions/packing";
import { Button, Card, Field, Input, Select } from "@/components/ui";

export function PackingActions({
  tripId,
  hasItems,
}: {
  tripId: string;
  hasItems: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("misc");
  const [essential, setEssential] = useState(false);

  function handleGenerate() {
    startTransition(() => generatePacking(tripId));
  }

  function handleAdd() {
    if (!label.trim()) return;
    startTransition(async () => {
      await addCustomPackingItem(tripId, label, category, essential);
      setLabel("");
      setEssential(false);
      setShowAdd(false);
    });
  }

  return (
    <div className="flex flex-wrap gap-3 items-start">
      <Button onClick={handleGenerate} disabled={pending}>
        {pending
          ? "Working..."
          : hasItems
            ? "Regenerate List"
            : "Generate Packing List"}
      </Button>

      {hasItems && !showAdd && (
        <Button variant="secondary" onClick={() => setShowAdd(true)}>
          + Add Item
        </Button>
      )}

      {showAdd && (
        <Card className="w-full mt-1">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Label">
                <Input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Flip flops"
                />
              </Field>
              <Field label="Category">
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="clothing">Clothing</option>
                  <option value="toiletries">Toiletries</option>
                  <option value="electronics">Electronics</option>
                  <option value="documents">Documents</option>
                  <option value="health">Health</option>
                  <option value="accessories">Accessories</option>
                  <option value="misc">Misc</option>
                </Select>
              </Field>
            </div>

            <label className="flex items-center gap-2 text-[0.875rem] text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={essential}
                onChange={(e) => setEssential(e.target.checked)}
                className="accent-lagoon-600 w-4 h-4"
              />
              Essential item
            </label>

            <div className="flex gap-2">
              <Button
                variant="success"
                size="sm"
                onClick={handleAdd}
                disabled={pending || !label.trim()}
              >
                Add
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
