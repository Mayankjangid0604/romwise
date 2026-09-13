import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "./cn";

const controlBase =
  "w-full rounded-control border bg-white px-3 text-[0.9375rem] text-ink-800 " +
  "placeholder:text-ink-400 transition-colors " +
  "focus:outline-none focus:border-lagoon-500 focus:ring-2 focus:ring-lagoon-400/30 " +
  "disabled:bg-ink-100 disabled:text-ink-400";

const controlBorder = "border-ink-300";
const controlError = "border-danger-600 focus:border-danger-600 focus:ring-danger-600/25";

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        controlBase,
        "h-10",
        invalid ? controlError : controlBorder,
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        controlBase,
        "py-2 leading-relaxed",
        invalid ? controlError : controlBorder,
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        controlBase,
        "h-10",
        invalid ? controlError : controlBorder,
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[0.8125rem] font-medium text-ink-700 mb-1.5"
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="text-[0.8125rem] text-danger-600 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-[0.8125rem] text-ink-500 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}
