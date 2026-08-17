"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const LENGTH = 4;

/**
 * Four separate boxes rather than one text field: it reads as a code, gives a
 * numeric keypad on phones, and makes a mistyped digit obvious. Paste of a
 * full code still works, because half the room will paste from chat.
 */
export function JoinCodeEntry({ className }: { className?: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const code = digits.join("");

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    setError(null);

    if (clean.length > 1) {
      // A paste: spread it across the boxes from here.
      const next = [...digits];
      for (let i = 0; i < clean.length && index + i < LENGTH; i += 1) {
        next[index + i] = clean[i];
      }
      setDigits(next);
      refs.current[Math.min(LENGTH - 1, index + clean.length)]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < LENGTH - 1) refs.current[index + 1]?.focus();
    if (e.key === "Enter") void submit();
  };

  const submit = async () => {
    if (code.length !== LENGTH) {
      setError("Enter all four digits.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${code}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 404 ? "No session with that code." : "Could not reach that session.");
        setBusy(false);
        return;
      }
      router.push(`/j/${code}`);
    } catch {
      setError("Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex gap-3" role="group" aria-label="Four digit room code">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={digit}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={LENGTH}
            aria-label={`Digit ${i + 1} of ${LENGTH}`}
            className={cn(
              "tnum h-20 w-full rounded-2xl bg-surface text-center text-4xl font-bold text-ink",
              "shadow-lift ring-1 ring-ink/12 ring-inset transition",
              "focus:ring-2 focus:ring-cobalt",
              digit && "ring-ink/25",
            )}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-alert-deep">
          {error}
        </p>
      )}

      <Button size="lg" block onClick={submit} disabled={busy || code.length !== LENGTH}>
        {busy ? "Finding the room…" : "Continue"}
      </Button>
    </div>
  );
}
