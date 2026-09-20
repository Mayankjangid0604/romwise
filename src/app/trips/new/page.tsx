"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { createTrip } from "@/app/actions/trips";
import { motion, AnimatePresence } from "framer-motion";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  Input,
  Button,
} from "@/components/ui";
import { Sparkles, MapPin, Calendar, Users, Wallet, CheckCircle2, ChevronRight, XCircle } from "lucide-react";
import type { PlannerExtractedData, PlannerPreferenceItem } from "@/app/api/chat/planner/route";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function NewTripPage() {
  return (
    <Suspense>
      <ConversationalPlanner />
    </Suspense>
  );
}

function ConversationalPlanner() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm Roamwise. I can help you plan your perfect trip. Where are you dreaming of going?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<PlannerExtractedData | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user" as const, content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to communicate with AI";
        try {
          const errorData = await res.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // ignore JSON parse error
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);

      if (data.type === "complete" && data.extractedData) {
        setExtractedData(data.extractedData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.slice(0, -1)); // Remove the user message on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTrip = async () => {
    if (!extractedData) return;
    setIsCreating(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("title", `Trip to ${extractedData.destination || "Unknown"}`);
      formData.append("destination", extractedData.destination || "");
      if (extractedData.startDate) formData.append("startDate", extractedData.startDate);
      if (extractedData.endDate) formData.append("endDate", extractedData.endDate);
      
      
      formData.append("dateStatus", extractedData.startDate && extractedData.endDate ? "exact" : "flexible");
      if (extractedData.tripType) formData.append("tripType", extractedData.tripType);
      if (extractedData.timeStatus) formData.append("timeStatus", extractedData.timeStatus);
      if (extractedData.startTime) formData.append("startTime", extractedData.startTime);
      if (extractedData.endTime) formData.append("endTime", extractedData.endTime);
      if (extractedData.travelSegments && extractedData.travelSegments.length > 0) {
        formData.append("travelSegments", JSON.stringify(extractedData.travelSegments));
      }
      if (extractedData.accommodations && extractedData.accommodations.length > 0) {
        formData.append("accommodations", JSON.stringify(extractedData.accommodations));
      }

      formData.append("budget", (extractedData.budgetInr || 50000).toString());
      formData.append("maxTravelers", (extractedData.maxTravelers || 2).toString());
      formData.append("paceLevel", extractedData.paceLevel || "balanced");

      // Pass accessibility notes (F-001 fix)
      if (extractedData.accessibilityNotes) {
        formData.append("accessibilityNotes", extractedData.accessibilityNotes);
      }

      // Pass preferences as JSON (F-001 fix)
      if (extractedData.preferences && extractedData.preferences.length > 0) {
        formData.append("preferences", JSON.stringify(extractedData.preferences));
      }

      const state = await createTrip({}, formData);
      if (state?.error || state?.fieldErrors) {
        setError(state.error || Object.values(state.fieldErrors || {})[0] || "Validation failed");
        setIsCreating(false);
      }
      // Note: createTrip calls redirect() on success, so we don't need to do anything here if successful
    } catch (err) {
      setError("Failed to create trip");
      setIsCreating(false);
    }
  };

  const preferenceLabel = (pref: PlannerPreferenceItem) => {
    const emoji: Record<string, string> = {
      dining: "🍽️", culture: "🏛️", nature: "🌿", adventure: "🧗",
      sightseeing: "📸", shopping: "🛍️", relaxation: "🧘", nightlife: "🌙",
    };
    const isExclusion = pref.priority === "never" || pref.priority === "avoid";
    return `${isExclusion ? "✗" : "✓"} ${emoji[pref.category] ?? ""} ${pref.category}`;
  };

  return (
    <PageShell width="form">
      <PageHeader backHref="/dashboard" backLabel="Dashboard" title="Plan Your Next Adventure" />

      <Card className="flex flex-col h-[650px] shadow-lift overflow-hidden border-ink-200">
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 shrink-0">
            <Alert tone="danger">{error}</Alert>
          </motion.div>
        )}

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gradient-to-b from-ink-50 to-white"
        >
          <AnimatePresence>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-lagoon-100 flex items-center justify-center mr-3 mt-1 shrink-0 text-lagoon-700">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm text-[15px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-ink-900 text-white rounded-br-sm"
                      : "bg-white border border-ink-100 text-ink-800 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {messages.length === 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col gap-3 mt-6 ml-11 max-w-[85%]"
            >
              <p className="text-xs text-ink-400 font-medium tracking-wide uppercase">Start with a template</p>
              
              <button 
                onClick={() => setInput("Plan a picnic day trip to Lonavala for 4 friends, budget ₹5,000. Just a fun afternoon.")}
                className="group flex items-center gap-3 text-left text-sm bg-white border border-ink-100 p-4 rounded-xl hover:border-lagoon-400 hover:shadow-card transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-600 group-hover:scale-110 transition-transform">🧺</div>
                <div className="flex-1">
                  <div className="font-medium text-ink-800">Picnic Outing</div>
                  <div className="text-ink-400 text-xs mt-0.5">Half day • 4 people • Local</div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-lagoon-500" />
              </button>

              <button 
                onClick={() => setInput("Plan a day trip from Bangalore to Mysore for 2 people, balanced pace, budget ₹8,000. Include sightseeing and culture.")}
                className="group flex items-center gap-3 text-left text-sm bg-white border border-ink-100 p-4 rounded-xl hover:border-lagoon-400 hover:shadow-card transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">🚗</div>
                <div className="flex-1">
                  <div className="font-medium text-ink-800">Day Trip</div>
                  <div className="text-ink-400 text-xs mt-0.5">1 day • 2 travelers • Culture</div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-lagoon-500" />
              </button>

              <button 
                onClick={() => setInput("Plan an overnight trip to Coorg for a couple, easy pace, budget ₹12,000. Prefer nature and relaxation.")}
                className="group flex items-center gap-3 text-left text-sm bg-white border border-ink-100 p-4 rounded-xl hover:border-lagoon-400 hover:shadow-card transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">🌙</div>
                <div className="flex-1">
                  <div className="font-medium text-ink-800">Overnight Escape</div>
                  <div className="text-ink-400 text-xs mt-0.5">1 night • Couple • Nature</div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-lagoon-500" />
              </button>

              <button 
                onClick={() => setInput("Plan a weekend getaway to Pondicherry for 3 friends, balanced pace, budget ₹25,000.")}
                className="group flex items-center gap-3 text-left text-sm bg-white border border-ink-100 p-4 rounded-xl hover:border-lagoon-400 hover:shadow-card transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">🌅</div>
                <div className="flex-1">
                  <div className="font-medium text-ink-800">Weekend Getaway</div>
                  <div className="text-ink-400 text-xs mt-0.5">2 days • 3 people • Balanced</div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-lagoon-500" />
              </button>

              <button 
                onClick={() => setInput("Plan a 3-day weekend trip to Goa for 2 people with a balanced pace, budget ₹30,000.")}
                className="group flex items-center gap-3 text-left text-sm bg-white border border-ink-100 p-4 rounded-xl hover:border-lagoon-400 hover:shadow-card transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-lagoon-50 flex items-center justify-center text-lagoon-600 group-hover:scale-110 transition-transform">🏖️</div>
                <div className="flex-1">
                  <div className="font-medium text-ink-800">Weekend Beach Trip</div>
                  <div className="text-ink-400 text-xs mt-0.5">3 days • 2 travelers • Balanced</div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-lagoon-500" />
              </button>

              <button 
                onClick={() => setInput("Plan a 7-day honeymoon in Kerala for a couple, relaxed pace, luxurious budget ₹150,000. Prefer nature and relaxation, avoid nightlife.")}
                className="group flex items-center gap-3 text-left text-sm bg-white border border-ink-100 p-4 rounded-xl hover:border-lagoon-400 hover:shadow-card transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-ember-50 flex items-center justify-center text-ember-600 group-hover:scale-110 transition-transform">💖</div>
                <div className="flex-1">
                  <div className="font-medium text-ink-800">Honeymoon Retreat</div>
                  <div className="text-ink-400 text-xs mt-0.5">7 days • Couple • Relaxed pace</div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-lagoon-500" />
              </button>
              
              <button 
                onClick={() => setInput("Plan a 5-day family trip to Jaipur for 4 people (2 adults, 2 kids), easy pace, budget ₹60,000. Include sightseeing and culture, avoid strenuous activities.")}
                className="group flex items-center gap-3 text-left text-sm bg-white border border-ink-100 p-4 rounded-xl hover:border-lagoon-400 hover:shadow-card transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-success-50 flex items-center justify-center text-success-600 group-hover:scale-110 transition-transform">👨‍👩‍👧‍👦</div>
                <div className="flex-1">
                  <div className="font-medium text-ink-800">Family Vacation</div>
                  <div className="text-ink-400 text-xs mt-0.5">5 days • 4 travelers • Easy pace</div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-lagoon-500" />
              </button>

              <button 
                onClick={() => setInput("Plan a 10-day solo trip to Varanasi for 1 person, full pace, budget ₹40,000. Focus on culture, dining, and sightseeing.")}
                className="group flex items-center gap-3 text-left text-sm bg-white border border-ink-100 p-4 rounded-xl hover:border-lagoon-400 hover:shadow-card transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">🎒</div>
                <div className="flex-1">
                  <div className="font-medium text-ink-800">Solo Explorer</div>
                  <div className="text-ink-400 text-xs mt-0.5">10 days • 1 traveler • Full pace</div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-lagoon-500" />
              </button>

              <button 
                onClick={() => setInput("Plan a 14-day backpacking trip across Himachal Pradesh for 2 people, full pace, budget ₹30,000. Focus on adventure and nature, avoid expensive dining.")}
                className="group flex items-center gap-3 text-left text-sm bg-white border border-ink-100 p-4 rounded-xl hover:border-lagoon-400 hover:shadow-card transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">⛺</div>
                <div className="flex-1">
                  <div className="font-medium text-ink-800">Backpacking Adventure</div>
                  <div className="text-ink-400 text-xs mt-0.5">14 days • 2 travelers • Full pace</div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-lagoon-500" />
              </button>
            </motion.div>
          )}

          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex justify-start ml-11"
            >
              <div className="bg-white border border-ink-100 rounded-2xl px-5 py-4 flex items-center gap-2 shadow-sm">
                <span className="h-2 w-2 bg-lagoon-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-lagoon-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-lagoon-400 rounded-full animate-bounce"></span>
              </div>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {extractedData && (
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="p-6 border-t border-ink-200 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-t-3xl absolute bottom-0 left-0 right-0 z-10 max-h-[85%] overflow-y-auto"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-lagoon-100 text-lagoon-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-ink-900">Trip Blueprint Ready</h3>
                  <p className="text-sm text-ink-500">Review your trip details before creating</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm mb-8 bg-ink-50 p-5 rounded-2xl">
                <div className="flex flex-col gap-1">
                  <span className="text-ink-400 text-xs uppercase tracking-wider font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Destination</span>
                  <span className="font-semibold text-ink-900 text-base">{extractedData.destination || "TBD"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-ink-400 text-xs uppercase tracking-wider font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Dates</span>
                  <span className="font-medium text-ink-800">
                    {extractedData.startDate && extractedData.endDate 
                      ? `${extractedData.startDate} to ${extractedData.endDate}`
                      : "Flexible dates"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-ink-400 text-xs uppercase tracking-wider font-medium flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Budget</span>
                  <span className="font-medium text-ink-800">₹{extractedData.budgetInr?.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-ink-400 text-xs uppercase tracking-wider font-medium flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Travelers</span>
                  <span className="font-medium text-ink-800">{extractedData.maxTravelers}</span>
                </div>
              </div>

              {extractedData.preferences && extractedData.preferences.length > 0 && (
                <div className="mb-6">
                  <span className="text-ink-400 text-xs uppercase tracking-wider font-medium mb-3 block">Preferences & Pace</span>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-3 py-1 rounded-full bg-ink-100 text-ink-700 capitalize font-medium border border-ink-200">
                      {extractedData.paceLevel} Pace
                    </span>
                    {extractedData.preferences.map((p, i) => (
                      <span
                        key={i}
                        className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 ${
                          p.priority === "never" || p.priority === "avoid"
                            ? "bg-danger-50 text-danger-700 border border-danger-200"
                            : "bg-success-50 text-success-700 border border-success-200"
                        }`}
                      >
                        {p.priority === "never" || p.priority === "avoid" ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {preferenceLabel(p).replace(/^[✗✓]\s/, '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {extractedData.accessibilityNotes && (
                <div className="mb-8 p-4 bg-lagoon-50 rounded-xl border border-lagoon-100">
                  <span className="text-lagoon-800 text-xs uppercase tracking-wider font-bold mb-1 block">Accessibility Needs</span>
                  <span className="text-sm text-lagoon-900">{extractedData.accessibilityNotes}</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button 
                  variant="secondary" 
                  className="flex-1 bg-white border-ink-200 hover:bg-ink-50 text-ink-700"
                  onClick={() => setExtractedData(null)}
                  disabled={isCreating}
                >
                  Edit Details
                </Button>
                <Button 
                  className="flex-[2] bg-lagoon-600 hover:bg-lagoon-700 text-white shadow-md shadow-lagoon-600/20"
                  onClick={handleCreateTrip}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Building...
                    </span>
                  ) : "Create Trip"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!extractedData && (
          <form onSubmit={handleSend} className="p-4 md:p-6 bg-white border-t border-ink-100 flex gap-3 shrink-0 relative z-0 rounded-b-xl">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., I want to go to Tokyo for 5 days..."
              disabled={isLoading}
              className="flex-1 bg-ink-50 border-ink-200 focus-visible:ring-lagoon-500 rounded-xl px-4 py-6 text-[15px]"
              autoFocus
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="rounded-xl px-6 bg-ink-900 hover:bg-ink-800 text-white"
            >
              Send
            </Button>
          </form>
        )}
      </Card>
    </PageShell>
  );
}
