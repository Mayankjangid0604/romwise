"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { Search } from "lucide-react";

export function DestinationSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/trips/new?destination=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mb-10">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-ink-400" />
        </div>
        <Input
          type="search"
          className="pl-10 h-12 text-base rounded-xl border-ink-200 bg-white"
          placeholder="Search destinations (e.g., Delhi, Goa, Manali)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <Button type="submit" className="h-12 px-6 rounded-xl">
        Plan Trip
      </Button>
    </form>
  );
}
