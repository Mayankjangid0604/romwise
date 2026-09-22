"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

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

      // Wipe IndexedDB trips database
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('roamwise-db');
      }
    } catch (e) {
      console.error('Error clearing offline data during sign out', e);
    }
    signOut({ callbackUrl: "/login" });
  };

  return (
    <button
      onClick={handleSignOut}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 hover:text-danger-700 transition-colors rounded-lg"
    >
      <LogOut className="w-4 h-4" />
      Sign out
    </button>
  );
}
