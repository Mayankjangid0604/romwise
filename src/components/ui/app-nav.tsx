"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Compass, LayoutDashboard, Menu, X, Plane, ChevronDown } from "lucide-react";
import { SignOutButton } from "@/app/dashboard/sign-out-button";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discovery", label: "Discover", icon: Compass },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col">{children}</div>;
}

export function AppNavigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-ink-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-lagoon-600 flex items-center justify-center shadow-sm group-hover:bg-lagoon-700 transition-colors">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-lg text-ink-900 tracking-tight">
              Roamwise
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-lagoon-50 text-lagoon-700"
                      : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop User Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/trips/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lagoon-600 text-white text-sm font-medium hover:bg-lagoon-700 transition-colors shadow-sm"
            >
              + New Trip
            </Link>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-ink-600 hover:bg-ink-100 transition-colors text-sm"
              >
                <div className="w-7 h-7 rounded-full bg-lagoon-100 flex items-center justify-center text-lagoon-700 font-semibold text-xs">
                  U
                </div>
                <ChevronDown className="w-3 h-3" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-ink-200 shadow-float py-1 z-50">
                  <div className="px-3 py-1.5 text-xs text-ink-500 font-medium border-b border-ink-100 mb-1">
                    Account
                  </div>
                  <SignOutButton />
                </div>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-ink-600 hover:bg-ink-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden py-3 border-t border-ink-100 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-lagoon-50 text-lagoon-700"
                      : "text-ink-600 hover:bg-ink-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
            <Link
              href="/trips/new"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-lagoon-600 text-white hover:bg-lagoon-700 transition-colors mt-2"
            >
              + New Trip
            </Link>
            <div className="pt-2 border-t border-ink-100 mt-2">
              <SignOutButton />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
