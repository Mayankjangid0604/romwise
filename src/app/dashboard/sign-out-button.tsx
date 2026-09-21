"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";

export function SignOutButton() {
  const handleSignOut = async () => {
    try {
      // Clear Service Worker caches to prevent cross-account exposure of offline trips
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Clear offline user identifier
      localStorage.removeItem('roamwise_user_id');
      // Clear offline trips list
      localStorage.removeItem('roamwise_offline_trips');
    } catch (e) {
      console.error('Error clearing offline data during sign out', e);
    }
    signOut({ callbackUrl: "/login" });
  };

  return (
    <Button variant="ghost" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
