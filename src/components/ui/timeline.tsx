import React from "react";
import { cn } from "./cn";

export interface TimelineProps {
  children: React.ReactNode;
  className?: string;
}

export function Timeline({ children, className }: TimelineProps) {
  return (
    <div className={cn("relative border-l-2 border-ink-100 ml-4 pl-6 pb-6", className)}>
      {children}
    </div>
  );
}

export interface TimelineItemProps {
  title: string;
  time?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

export function TimelineItem({
  title,
  time,
  icon,
  children,
  className,
  iconClassName,
}: TimelineItemProps) {
  return (
    <div className={cn("relative mb-10 last:mb-0", className)}>
      <div className={cn("absolute -left-[43px] top-1 w-10 h-10 rounded-full bg-white border-2 border-ink-100 flex items-center justify-center shadow-sm", iconClassName)}>
        {icon || <div className="w-2.5 h-2.5 rounded-full bg-ink-300" />}
      </div>
      
      {title && (
        <div className="mb-3">
          <h3 className="text-lg font-bold text-ink-900">{title}</h3>
          {time && <p className="text-sm font-medium text-ink-500 mt-0.5">{time}</p>}
        </div>
      )}
      
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
