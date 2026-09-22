import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Sparkles,
  Users,
  Wallet,
  WifiOff,
  MapPin,
  ArrowRight,
  Plane,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Itineraries",
    description: "Describe your dream trip in plain English. Roamwise crafts a full day-by-day plan in seconds.",
    color: "bg-lagoon-50 text-lagoon-600",
  },
  {
    icon: Users,
    title: "Built for Groups",
    description: "Invite friends, align on preferences, split expenses. Everyone on the same page, no WhatsApp chaos.",
    color: "bg-ember-50 text-ember-600",
  },
  {
    icon: Wallet,
    title: "Budget-Aware Planning",
    description: "Set a budget and Roamwise keeps your itinerary within it. Track actual expenses and settle debts.",
    color: "bg-success-50 text-success-600",
  },
  {
    icon: WifiOff,
    title: "Offline Ready",
    description: "Save your trip before you board. Access your full itinerary, packing list, and maps — no signal needed.",
    color: "bg-caution-50 text-caution-600",
  },
];

const steps = [
  { step: "01", title: "Describe your trip", body: "Tell the AI where you're going, who's coming, and what you love." },
  { step: "02", title: "Generate itinerary", body: "Get a personalized, budget-aware day-by-day plan instantly." },
  { step: "03", title: "Collaborate", body: "Invite your group, collect preferences, vote on activities." },
  { step: "04", title: "Travel!", body: "Use Live Mode offline for your full plan at every destination." },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-ink-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-lagoon-600 flex items-center justify-center shadow-sm">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-lg text-ink-900">Roamwise</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-ink-600 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-ink-100 transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="text-sm font-medium px-4 py-2 rounded-lg bg-lagoon-600 text-white hover:bg-lagoon-700 transition-colors shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-lagoon-50 via-ink-50 to-ember-50 gradient-animate" />
        <div className="absolute inset-0 bg-[url('/globe-pattern.svg')] opacity-[0.03] bg-repeat bg-center" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lagoon-50 border border-lagoon-200 text-lagoon-700 text-xs font-semibold uppercase tracking-widest mb-8">
            <Sparkles className="w-3 h-3" />
            AI-Powered Group Trip Planning
          </div>

          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold text-ink-900 leading-[1.05] tracking-tight mb-6">
            Plan trips your
            <br />
            <span className="text-lagoon-600">whole group</span> will love
          </h1>

          <p className="text-xl text-ink-600 max-w-2xl mx-auto leading-relaxed mb-10">
            Roamwise combines AI itinerary generation, group preference alignment, 
            budget tracking, and offline maps — all in one beautifully simple app.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Link
              href="/signup"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-lagoon-600 text-white font-semibold hover:bg-lagoon-700 transition-all shadow-lg shadow-lagoon-600/25 hover:shadow-lagoon-600/35 hover:-translate-y-0.5"
            >
              Start planning free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-ink-700 font-semibold border border-ink-200 hover:bg-ink-50 transition-all hover:-translate-y-0.5"
            >
              Log in
            </Link>
          </div>

          {/* Social proof pills */}
          <div className="flex flex-wrap justify-center gap-3 text-sm text-ink-500">
            {["No credit card required", "Free to start", "Works offline"].map((pill) => (
              <div key={pill} className="flex items-center gap-1.5 bg-white/70 border border-ink-200/60 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
                {pill}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-lagoon-600 mb-3">Features</p>
            <h2 className="font-display text-4xl font-bold text-ink-900">Everything your trip needs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, description, color }) => (
              <div key={title} className="p-6 rounded-2xl bg-ink-50 border border-ink-100 hover:shadow-lift transition-shadow">
                <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-lg text-ink-900 mb-2">{title}</h3>
                <p className="text-sm text-ink-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 bg-ink-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-lagoon-600 mb-3">How It Works</p>
            <h2 className="font-display text-4xl font-bold text-ink-900">From idea to adventure in minutes</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(({ step, title, body }) => (
              <div key={step} className="relative p-6 rounded-2xl bg-white border border-ink-200 shadow-card">
                <div className="text-4xl font-display font-bold text-ink-100 mb-4">{step}</div>
                <h3 className="font-semibold text-ink-900 mb-2">{title}</h3>
                <p className="text-sm text-ink-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-lagoon-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/globe-pattern.svg')] opacity-5 bg-repeat" />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">Ready to explore?</h2>
          <p className="text-lagoon-200 text-lg mb-8">Join thousands of travelers using Roamwise to plan smarter group trips.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-lagoon-800 font-semibold hover:bg-lagoon-50 transition-all shadow-lg hover:-translate-y-0.5"
          >
            <MapPin className="w-4 h-4" />
            Start your first trip
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 bg-ink-900">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white">
            <Plane className="w-4 h-4" />
            <span className="font-display font-semibold">Roamwise</span>
          </div>
          <p className="text-ink-500 text-sm">© {new Date().getFullYear()} Roamwise. Built for travelers.</p>
        </div>
      </footer>
    </div>
  );
}
