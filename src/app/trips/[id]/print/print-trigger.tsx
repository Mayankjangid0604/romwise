"use client";

import { useEffect } from "react";

export function PrintTrigger() {
  useEffect(() => {
    // Wait a brief moment for images to load before popping print dialog
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
