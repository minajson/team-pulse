"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { facilitatorKey } from "@/lib/client/useSession";

/**
 * Creates a session and stores the facilitator token on this device only.
 * The token is what separates the control dashboard from a participant's
 * phone, so it never travels in a URL and is never sent to another client.
 */
export function CreateSessionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Team Pulse" }),
      });
      const data = (await res.json()) as { code?: string; facilitatorToken?: string; error?: string };
      if (!res.ok || !data.code || !data.facilitatorToken) {
        throw new Error(data.error ?? "Could not start a session.");
      }
      window.localStorage.setItem(facilitatorKey(data.code), data.facilitatorToken);
      router.push(`/host/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a session.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" onClick={create} disabled={busy} className="text-base">
        {busy ? "Preparing the room…" : "Start a session"}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-alert-deep">
          {error}
        </p>
      )}
    </div>
  );
}
