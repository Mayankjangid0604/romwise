"use client";

import { useActionState, useState } from "react";
import { login, type AuthState } from "@/app/actions/auth";
import { requestOtp, verifyOtpAction } from "@/app/actions/phone-auth";
import Link from "next/link";
import { Alert, Card, Field, Input, Button, CenteredShell } from "@/components/ui";
import { Plane, Sparkles, Users, WifiOff } from "lucide-react";

const emailInitial: AuthState = {};

export default function LoginPage() {
  const [method, setMethod] = useState<"email" | "phone">("phone");
  const [emailState, emailAction, emailPending] = useActionState(login, emailInitial);

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel - hidden on mobile */}
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
            Your next adventure<br />starts here.
          </h2>
          <p className="text-lagoon-200 text-lg leading-relaxed max-w-md">
            AI-powered itineraries, group collaboration, budget tracking, and offline access — all in one place.
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
              Welcome back
            </h1>
            <p className="text-ink-600 mt-1.5">Log in to your Roamwise account.</p>
          </div>

          <div className="flex gap-1 mb-5 p-1 bg-ink-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMethod("phone")}
              className={`flex-1 py-2 text-[0.8125rem] font-medium rounded-md transition-colors ${
                method === "phone"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-700"
              }`}
            >
              Phone
            </button>
            <button
              type="button"
              onClick={() => setMethod("email")}
              className={`flex-1 py-2 text-[0.8125rem] font-medium rounded-md transition-colors ${
                method === "email"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-700"
              }`}
            >
              Email
            </button>
          </div>

          <Card>
            {method === "email" ? (
              <EmailForm state={emailState} action={emailAction} pending={emailPending} />
            ) : (
              <PhoneForm />
            )}
          </Card>

          <p className="text-center text-[0.875rem] text-ink-600 mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-lagoon-700 hover:text-lagoon-800"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function EmailForm({
  state,
  action,
  pending,
}: {
  state: AuthState;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" required />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}

function PhoneForm() {
  const [phoneState, phoneAction, phonePending] = useActionState(requestOtp, {
    step: "phone" as const,
  });
  const [otpState, otpAction, otpPending] = useActionState(verifyOtpAction, {
    step: "otp" as const,
  });

  if (phoneState.step === "otp") {
    return (
      <form action={otpAction} className="space-y-4">
        {otpState.error && <Alert tone="danger">{otpState.error}</Alert>}

        <p className="text-[0.8125rem] text-ink-600">
          We sent a 6-digit code to <strong>{phoneState.phone}</strong>
        </p>

        <input type="hidden" name="phone" value={phoneState.phone} />

        <Field label="Verification code" htmlFor="code">
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
          />
        </Field>

        <Button type="submit" disabled={otpPending} className="w-full">
          {otpPending ? "Verifying..." : "Verify"}
        </Button>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full text-[0.8125rem] text-lagoon-700 hover:text-lagoon-800 font-medium"
        >
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form action={phoneAction} className="space-y-4">
      {phoneState.error && <Alert tone="danger">{phoneState.error}</Alert>}

      <Field label="Phone number" htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+91 98765 43210"
          required
        />
      </Field>

      <Button type="submit" disabled={phonePending} className="w-full">
        {phonePending ? "Sending code..." : "Send verification code"}
      </Button>
    </form>
  );
}
