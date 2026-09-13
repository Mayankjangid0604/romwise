"use client";

import { useActionState } from "react";
import { login, type AuthState } from "@/app/actions/auth";
import Link from "next/link";
import { Alert, Card, Field, Input, Button, CenteredShell } from "@/components/ui";

const initialState: AuthState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <CenteredShell>
      <div className="text-center mb-7">
        <h1 className="font-display text-3xl font-semibold text-ink-900">
          Welcome back
        </h1>
        <p className="text-ink-600 mt-1.5">Log in to your Roamwise account.</p>
      </div>

      <Card>
        <form action={formAction} className="space-y-4">
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
