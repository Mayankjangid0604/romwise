"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTrip } from "@/app/actions/trips";
import { Trash2, AlertTriangle, X } from "lucide-react";

export function DeleteTripButton({ tripId, tripTitle }: { tripId: string; tripTitle: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteTrip(tripId);
    if (result.error) {
      setError(result.error);
      setDeleting(false);
    } else {
      // replace: Back must not return to the page of a trip that no longer exists
      router.replace("/dashboard");
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-danger-700 hover:bg-danger-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />
          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-float max-w-sm w-full p-6 animate-fade-up">
            <button
              onClick={() => setShowConfirm(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-ink-400 hover:bg-ink-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-danger-50 flex items-center justify-center text-danger-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-ink-900">Delete trip?</h3>
            </div>

            <p className="text-sm text-ink-600 mb-1">
              Are you sure you want to delete <strong className="text-ink-900">{tripTitle}</strong>?
            </p>
            <p className="text-xs text-ink-500 mb-6">
              This will permanently remove the itinerary, packing list, budget, group data, and all associated content. This action cannot be undone.
            </p>

            {error && (
              <div className="text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-ink-100 text-ink-700 hover:bg-ink-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-danger-600 text-white hover:bg-danger-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
