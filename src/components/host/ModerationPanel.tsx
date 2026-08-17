"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ControlCommand, ModerationItem, ModerationStatus } from "@/lib/types";

const FILTERS: { id: "pending" | "approved" | "hidden" | "all"; label: string }[] = [
  { id: "pending", label: "Needs review" },
  { id: "approved", label: "On screen" },
  { id: "hidden", label: "Hidden" },
  { id: "all", label: "All" },
];

/**
 * The moderation queue for the one free-text round.
 *
 * Approve / hide / remove rather than a single delete: hiding takes something
 * off the projector without destroying it, which is what a facilitator
 * actually wants when a sentence is fine but lands badly in the moment.
 */
export function ModerationPanel({
  items,
  autoApprove,
  send,
}: {
  items: ModerationItem[];
  autoApprove: boolean;
  send: (command: ControlCommand) => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("pending");

  const pendingCount = items.filter((i) => i.moderation === "pending").length;
  const visible = items.filter((i) => (filter === "all" ? true : i.moderation === filter));

  const moderate = (responseId: string, status: ModerationStatus) =>
    send({ type: "moderate", responseId, status });

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-lift ring-1 ring-ink/10 ring-inset">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">
          Response wall
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-amber px-2 py-0.5 text-[0.68rem] font-black text-night">
              {pendingCount} to review
            </span>
          )}
        </h2>

        <label className="flex cursor-pointer items-center gap-2 text-[0.72rem] font-semibold text-ink-2">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => send({ type: "settings", patch: { autoApprove: e.target.checked } })}
            className="h-4 w-4 accent-cobalt"
          />
          Auto-approve
        </label>
      </div>

      <div className="mt-3 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              "rounded-full px-2.5 py-1 text-[0.7rem] font-bold transition",
              filter === f.id ? "bg-ink text-white" : "bg-ink/6 text-ink-3 hover:bg-ink/12",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="no-scrollbar mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {visible.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "rounded-xl px-3 py-2.5 ring-1 ring-inset",
                item.moderation === "pending"
                  ? "bg-amber-wash ring-amber/30"
                  : item.moderation === "approved"
                    ? "bg-paper-2 ring-ink/8"
                    : "bg-ink/4 ring-ink/8",
              )}
            >
              <p
                className={cn(
                  "text-[0.88rem] leading-snug font-semibold",
                  item.moderation === "hidden" || item.moderation === "removed"
                    ? "text-ink-3 line-through"
                    : "text-ink",
                )}
              >
                {item.text}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[0.65rem] font-bold text-ink-3">
                  {item.mode === "room" ? "🏢" : "💻"} · ❤ {item.hearts}
                </span>
                <span className="flex-1" />
                {item.moderation !== "approved" && (
                  <Action onClick={() => moderate(item.id, "approved")} tone="positive">
                    Approve
                  </Action>
                )}
                {item.moderation !== "hidden" && item.moderation !== "removed" && (
                  <Action onClick={() => moderate(item.id, "hidden")}>Hide</Action>
                )}
                {item.moderation !== "removed" && (
                  <Action onClick={() => moderate(item.id, "removed")} tone="danger">
                    Remove
                  </Action>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>

        {visible.length === 0 && (
          <li className="py-6 text-center text-[0.8rem] text-ink-3">
            {filter === "pending" ? "Nothing waiting for you." : "Nothing here yet."}
          </li>
        )}
      </ul>
    </section>
  );
}

function Action({
  children,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "positive" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-2 py-1 text-[0.68rem] font-bold transition",
        tone === "positive"
          ? "bg-positive text-white hover:bg-positive/85"
          : tone === "danger"
            ? "text-alert hover:bg-alert hover:text-white"
            : "bg-ink/8 text-ink-2 hover:bg-ink/16",
      )}
    >
      {children}
    </button>
  );
}
