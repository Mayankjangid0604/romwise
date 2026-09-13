import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buttonStyles } from "@/components/ui";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl text-center">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-ink-500 mb-5">
          Group trip planning
        </p>

        <h1 className="font-display text-5xl font-semibold leading-[1.1] text-ink-900">
          Roamwise
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-ink-600">
          Plan group trips with smart itineraries tailored to everyone&apos;s
          preferences.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className={buttonStyles({ className: "px-6" })}>
            Get Started
          </Link>
          <Link
            href="/login"
            className={buttonStyles({ variant: "secondary", className: "px-6" })}
          >
            Log In
          </Link>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[0.8125rem] text-ink-500">
          <span>Deterministic itineraries</span>
          <span className="text-ink-300" aria-hidden="true">
            &middot;
          </span>
          <span>Budget-aware</span>
          <span className="text-ink-300" aria-hidden="true">
            &middot;
          </span>
          <span>Built for groups</span>
        </div>
      </div>
    </div>
  );
}
