"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "amber" | "money" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-cobalt text-white shadow-lift hover:bg-cobalt-deep active:bg-cobalt-deep disabled:bg-ink-4",
  secondary:
    "bg-surface text-ink ring-1 ring-inset ring-ink/12 shadow-lift hover:ring-ink/25 hover:bg-paper-2 disabled:text-ink-3",
  ghost: "bg-transparent text-ink-2 hover:bg-ink/6 hover:text-ink disabled:text-ink-4",
  amber: "bg-amber text-ink shadow-lift hover:bg-amber-lift disabled:bg-ink-4",
  money: "bg-money text-white shadow-lift hover:bg-money-deep disabled:bg-ink-4",
  danger:
    "bg-alert-wash text-alert ring-1 ring-inset ring-alert/25 hover:bg-alert hover:text-white disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  // 44px minimum on every size — these are tapped on phones in dim rooms.
  sm: "h-9 px-3 text-[0.8rem] gap-1.5 rounded-lg",
  md: "h-11 px-4 text-[0.9rem] gap-2 rounded-xl",
  lg: "h-14 px-6 text-base gap-2.5 rounded-2xl",
  xl: "min-h-16 px-7 py-4 text-lg gap-3 rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, icon, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-[background-color,color,box-shadow,transform] duration-200",
        "active:scale-[0.985] disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});
