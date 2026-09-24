"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send } from "lucide-react";
import { Button, Input, Card } from "@/components/ui";

export function AICopilot({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hi! I'm your AI Copilot. I can help you adjust your itinerary. Try asking 'Swap my afternoon activity with a museum' or 'Remove the hike'." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const toggleCopilot = () => setIsOpen(!isOpen);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user" as const, content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { executeCopilotIntent } = await import("@/app/actions/copilot");
      const res = await executeCopilotIntent(tripId, userMessage.content);
      
      if (res.success) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.message }]);
        if (res.action !== "NO_ACTION") {
          router.refresh();
        }
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: res.error }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={toggleCopilot}
          className="fixed bottom-6 right-6 z-50 bg-lagoon-600 hover:bg-lagoon-700 text-white rounded-full p-4 shadow-xl flex items-center justify-center gap-2 group transition-all"
        >
          <Sparkles className="w-5 h-5" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[120px] transition-all duration-300 ease-in-out font-medium">
            Ask Roamwise
          </span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-ink-200 animate-slide-in-right">
          <div className="p-4 border-b border-ink-100 flex items-center justify-between bg-lagoon-50 text-lagoon-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">Roamwise Copilot</h3>
            </div>
            <button onClick={toggleCopilot} className="text-lagoon-700 hover:text-lagoon-900 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-ink-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === "user" ? "bg-lagoon-600 text-white rounded-br-sm" : "bg-white border border-ink-200 text-ink-800 rounded-bl-sm shadow-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-ink-200 p-3 rounded-2xl rounded-bl-sm flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-lagoon-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-lagoon-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-lagoon-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-4 border-t border-ink-100 bg-white flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Add a nice cafe for lunch on Day 2"
              className="flex-1 bg-ink-50 border-ink-200"
              disabled={isLoading}
            />
            <Button type="submit" size="sm" disabled={isLoading || !input.trim()} className="shrink-0 w-10 h-10 p-0 bg-lagoon-600 hover:bg-lagoon-700 text-white flex items-center justify-center rounded-md">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
