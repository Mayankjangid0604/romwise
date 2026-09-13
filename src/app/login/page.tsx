"use client";

import { useActionState, useState } from "react";
import { login, type AuthState } from "@/app/actions/auth";
import { requestOtp, verifyOtpAction, type PhoneAuthState } from "@/app/actions/phone-auth";
import Link from "next/link";
import { Alert, Card, Field, Input, Button, CenteredShell } from "@/components/ui";

const emailInitial: AuthState = {};

export default function LoginPage() {
  const [method, setMethod] = useState<"email" | "phone">("phone");
  const [emailState, emailAction, emailPending] = useActionState(login, emailInitial);

  return (
    <CenteredShell>
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
    </CenteredShell>
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
  const [state, setState] = useState<PhoneAuthState>({ step: "phone" });
  const [pending, setPending] = useState(false);

  async function handleRequestOtp(formData: FormData) {
    setPending(true);
    const result = await requestOtp(state, formData);
    setState(result);
    setPending(false);
  }

  async function handleVerifyOtp(formData: FormData) {
    setPending(true);
    const result = await verifyOtpAction(state, formData);
    setState(result);
    setPending(false);
  }

  if (state.step === "otp") {
    return (
      <form action={handleVerifyOtp} className="space-y-4">
        {state.error && <Alert tone="danger">{state.error}</Alert>}

        <p className="text-[0.8125rem] text-ink-600">
          We sent a 6-digit code to <strong>{state.phone}</strong>
        </p>

        <input type="hidden" name="phone" value={state.phone} />

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

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Verifying..." : "Verify"}
        </Button>

        <button
          type="button"
          onClick={() => setState({ step: "phone" })}
          className="w-full text-[0.8125rem] text-lagoon-700 hover:text-lagoon-800 font-medium"
        >
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form action={handleRequestOtp} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Field label="Phone number" htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+91 98765 43210"
          required
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending code..." : "Send verification code"}
      </Button>
    </form>
  );
}
