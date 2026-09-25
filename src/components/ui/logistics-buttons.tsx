"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddTransitButton({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/trips/${tripId}/transit`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(formData)),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        startTransition(() => {
          setOpen(false);
          router.refresh();
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs flex items-center gap-1 text-lagoon-600 bg-lagoon-50 px-2 py-1 rounded hover:bg-lagoon-100 transition-colors font-medium">
        <Plus className="w-3 h-3" /> Add Flight/Train
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">Add Transit</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-ink-500 mb-1 block">Origin</label>
                  <input required name="originName" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. DEL" />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-500 mb-1 block">Destination</label>
                  <input required name="destinationName" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. GOI" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-500 mb-1 block">Mode</label>
                <select name="mode" className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="FLIGHT">Flight</option>
                  <option value="TRAIN">Train</option>
                  <option value="CAR">Car / Bus</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-ink-600 bg-ink-100 rounded-lg hover:bg-ink-200">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-lagoon-600 rounded-lg hover:bg-lagoon-700 disabled:opacity-50">
                  {loading ? "Saving..." : "Save Transit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function AddStayButton({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/trips/${tripId}/stay`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(formData)),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        startTransition(() => {
          setOpen(false);
          router.refresh();
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs flex items-center gap-1 text-ember-600 bg-ember-50 px-2 py-1 rounded hover:bg-ember-100 transition-colors font-medium">
        <Plus className="w-3 h-3" /> Add Stay
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">Add Accommodation</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-ink-500 mb-1 block">Name</label>
                <input required name="name" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Taj Exotica" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-500 mb-1 block">Location / Neighborhood</label>
                <input name="location" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. South Goa" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-ink-600 bg-ink-100 rounded-lg hover:bg-ink-200">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-lagoon-600 rounded-lg hover:bg-lagoon-700 disabled:opacity-50">
                  {loading ? "Saving..." : "Save Stay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
