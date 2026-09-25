"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { Search, MapPin } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface DestinationResult {
  id: string;
  name: string;
  state: string;
}

export function DestinationSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DestinationResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    async function fetchResults() {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(`/api/destinations?q=${encodeURIComponent(debouncedQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.destinations || []);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchResults();
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent, selectedName?: string) => {
    e.preventDefault();
    const finalQuery = selectedName || query.trim();
    if (finalQuery) {
      setIsOpen(false);
      router.push(`/discovery/${encodeURIComponent(finalQuery)}`);
    }
  };

  return (
    <form ref={containerRef} onSubmit={e => handleSearch(e)} className="flex gap-2 max-w-xl mb-10 relative z-40">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-ink-400" />
        </div>
        <Input
          type="search"
          className="pl-10 h-12 text-base rounded-xl border-ink-200 bg-white shadow-sm"
          placeholder="Search destinations (e.g., Goa, Manali)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        
        {isOpen && query.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-ink-100 overflow-hidden z-50">
            {isLoading ? (
              <div className="p-4 text-sm text-ink-500 text-center">Searching...</div>
            ) : results.length > 0 ? (
              <ul className="max-h-64 overflow-y-auto">
                {results.map((dest) => (
                  <li key={dest.id}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-lagoon-50 focus:bg-lagoon-50 transition-colors flex items-center gap-3 border-b border-ink-50 last:border-0"
                      onClick={(e) => handleSearch(e, dest.name)}
                    >
                      <MapPin className="h-4 w-4 text-lagoon-600 shrink-0" />
                      <div className="flex-1 truncate">
                        <span className="font-medium text-ink-900">{dest.name}</span>
                        <span className="text-ink-500 text-sm ml-2">{dest.state}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-sm text-ink-500 text-center">No destinations found.</div>
            )}
          </div>
        )}
      </div>
      <Button type="submit" className="h-12 px-6 rounded-xl shadow-sm">
        Explore
      </Button>
    </form>
  );
}
