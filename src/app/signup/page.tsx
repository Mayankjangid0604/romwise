"use client";

import { useActionState } from "react";
import { signup, type AuthState } from "@/app/actions/auth";
import Link from "next/link";
import { Alert, Card, Field, Input, Button } from "@/components/ui";
import { CallbackUrlInput, AuthSwitchLink } from "@/components/auth/callback-url";
import { Plane, Sparkles, Users, WifiOff } from "lucide-react";

const initialState: AuthState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-lagoon-900 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-[url('/globe-pattern.svg')] opacity-5 bg-repeat" />
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5 mb-16">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <Plane className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-display font-semibold text-xl text-white">Roamwise</span>
          </Link>

          <h2 className="font-display text-4xl font-bold text-white leading-tight mb-6">
            Start planning<br />trips you&apos;ll love.
          </h2>
          <p className="text-lagoon-200 text-lg leading-relaxed max-w-md">
            Create your free account and plan your first group trip with AI in under 5 minutes.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { icon: Sparkles, text: "AI generates full itineraries" },
            { icon: Users, text: "Collaborate with your group" },
            { icon: WifiOff, text: "Works offline on trips" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-lagoon-100">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-ink-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-10">
            <div className="w-9 h-9 rounded-lg bg-lagoon-600 flex items-center justify-center shadow-sm">
              <Plane className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-display font-semibold text-xl text-ink-900">Roamwise</span>
          </div>

          <div className="text-center mb-7">
            <h1 className="font-display text-3xl font-semibold text-ink-900">
              Create your account
            </h1>
            <p className="text-ink-600 mt-1.5">
              Start planning trips with your group.
            </p>
          </div>

          <Card>
            <form action={formAction} className="space-y-4">
              <CallbackUrlInput />
              {state.error && <Alert tone="danger">{state.error}</Alert>}

              <Field label="Name" htmlFor="name">
                <Input id="name" name="name" type="text" required />
              </Field>

              <Field label="Email" htmlFor="email">
                <Input id="email" name="email" type="email" required />
              </Field>

              <Field
                label="Password"
                htmlFor="password"
                hint="At least 8 characters"
              >
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                />
              </Field>

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Creating account..." : "Sign up"}
              </Button>
            </form>
          </Card>

          <p className="text-center text-[0.875rem] text-ink-600 mt-6">
            Already have an account?{" "}
            <AuthSwitchLink
              href="/login"
              className="font-medium text-lagoon-700 hover:text-lagoon-800"
            >
              Log in
            </AuthSwitchLink>
          </p>
        </div>
      </div>
    </div>
  );
}
