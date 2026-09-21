"use client";

import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-muted/20 animate-pulse rounded-xl flex items-center justify-center border">
      <span className="text-muted-foreground text-sm">Loading map...</span>
    </div>
  ),
});

export default DynamicMap;
