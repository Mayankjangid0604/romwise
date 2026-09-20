"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function ExportButton({ tripId, tripName }: { tripId: string, tripName: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleExportIcs = () => {
    window.location.href = `/api/trips/${tripId}/export/ics`;
    setIsOpen(false);
  };

  const handleExportPdf = () => {
    window.print();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(!isOpen)}>
        Export
      </Button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-ink-200 shadow-xl rounded-lg z-50 flex flex-col py-1">
          <button 
            onClick={handleExportIcs}
            className="text-left px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 hover:text-ink-900"
          >
            Calendar (.ics)
          </button>
          <button 
            onClick={handleExportPdf}
            className="text-left px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 hover:text-ink-900"
          >
            Print / PDF
          </button>
        </div>
      )}
    </div>
  );
}
