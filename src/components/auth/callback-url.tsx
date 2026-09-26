"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeCallbackUrl } from "@/lib/safe-redirect";

function useCallbackUrl(): string {
  const searchParams = useSearchParams();
  return safeCallbackUrl(searchParams.get("callbackUrl"), "");
}

function CallbackUrlInputInner() {
  const callbackUrl = useCallbackUrl();
  return callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null;
}

/** Hidden form field carrying `?callbackUrl=` into the auth server actions. */
export function CallbackUrlInput() {
  return (
    <Suspense fallback={null}>
      <CallbackUrlInputInner />
    </Suspense>
  );
}

function AuthSwitchLinkInner({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const callbackUrl = useCallbackUrl();
  const target = callbackUrl ? `${href}?callbackUrl=${encodeURIComponent(callbackUrl)}` : href;
  return (
    <Link href={target} className={className}>
      {children}
    </Link>
  );
}

/** Login ↔ signup link that keeps the pending `callbackUrl` (e.g. an invite link). */
export function AuthSwitchLink(props: { href: string; className?: string; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Link href={props.href} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <AuthSwitchLinkInner {...props} />
    </Suspense>
  );
}
