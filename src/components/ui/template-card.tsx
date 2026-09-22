"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TripTemplate } from "@/lib/trip-templates";
import { createTripFromTemplate } from "@/app/actions/template-actions";
import { Button, Input, Card } from "@/components/ui";
import { Loader2 } from "lucide-react";

const templateEmoji: Record<string, string> = {
  "weekend-getaway": "⚡",
  "honeymoon": "💕",
  "family-vacation": "👨‍👩‍👧‍👦",
  "solo-adventure": "🎒",
  "backpacking": "🏕️",
};

export function TemplateCard({ template }: { template: TripTemplate }) {
  const [isExpanding, setIsExpanding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const destination = formData.get("destination") as string;
    const startDate = formData.get("startDate") as string;
    
    try {
      const result = await createTripFromTemplate(template.id, destination, startDate);
      router.push(`/trips/${result.tripId}`);
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col h-full hover:shadow-lift transition-all hover:-translate-y-0.5 bg-white">
      <div className="p-5 flex-1">
        <div className="text-2xl mb-2">{templateEmoji[template.id] || "✈️"}</div>
        <h3 className="font-display font-semibold text-lg text-ink-900 mb-1">{template.title}</h3>
        <p className="text-sm text-ink-600 mb-4">{template.description}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs bg-ink-100 text-ink-700 px-2 py-1 rounded-md font-medium">{template.durationDays} days</span>
          <span className="text-xs bg-ink-100 text-ink-700 px-2 py-1 rounded-md capitalize font-medium">{template.paceLevel} pace</span>
          <span className="text-xs bg-lagoon-50 text-lagoon-700 px-2 py-1 rounded-md font-medium">₹{(template.budgetInr / 1000).toFixed(0)}k</span>
        </div>
        
        {!isExpanding ? (
          <Button 
            variant="secondary" 
            className="w-full mt-auto"
            onClick={() => setIsExpanding(true)}
          >
            Use Template
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 mt-4 bg-ink-50 p-4 rounded-xl border border-ink-100 relative z-10">
            <div>
              <label htmlFor={`dest-${template.id}`} className="block text-xs font-medium text-ink-700 mb-1">Destination</label>
              <Input 
                id={`dest-${template.id}`} 
                name="destination" 
                placeholder="e.g. Paris, Tokyo" 
                required 
                className="bg-white"
              />
            </div>
            <div>
              <label htmlFor={`date-${template.id}`} className="block text-xs font-medium text-ink-700 mb-1">Start Date</label>
              <Input 
                id={`date-${template.id}`} 
                name="startDate" 
                type="date" 
                required 
                className="bg-white"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsExpanding(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid={`submit-${template.id}`} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
