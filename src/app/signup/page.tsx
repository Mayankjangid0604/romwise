"use client";

import { useActionState } from "react";
import { signup, type AuthState } from "@/app/actions/auth";
import Link from "next/link";
import { Alert, Card, Field, Input, Button, CenteredShell } from "@/components/ui";

const initialState: AuthState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <CenteredShell>
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
        <Link
          href="/login"
          className="font-medium text-lagoon-700 hover:text-lagoon-800"
        >
          Log in
        </Link>
      </p>
    </CenteredShell>
  );
}
