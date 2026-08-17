"use client";

import { useCallback, useMemo, useState } from "react";
import { selectionBounds, type Question } from "@/lib/content/session-plan";

export interface MultiSelect {
  picks: string[];
  isPicked: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Set when a tap was rejected for exceeding the maximum. */
  notice: string | null;
  min: number;
  max: number;
  complete: boolean;
  /** True when the current picks match what the server already has. */
  unchanged: boolean;
  /** Call after a successful submit so incoming frames resume winning. */
  markSubmitted: () => void;
  counterLabel: string;
}

/**
 * Selection state for a multi-select question.
 *
 * Shared by rounds 3 and 4 so the two cannot drift apart. Two behaviours here
 * were explicit product decisions rather than defaults:
 *
 * 1. At the maximum, an extra tap is *refused* with a message rather than
 *    silently evicting an earlier pick. Quietly dropping a choice someone made
 *    is the kind of thing they only notice after submitting.
 * 2. Nothing auto-submits. A multi-select answer is only meaningful once it is
 *    complete, so the participant confirms it deliberately.
 */
export function useMultiSelect(question: Question, serverPicks: string[]): MultiSelect {
  const bounds = selectionBounds(question) ?? { min: 1, max: 1 };
  const { min, max } = bounds;

  const [picks, setPicks] = useState<string[]>(serverPicks);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Reconcile server state during render rather than in an effect; a mid-edit
  // participant always wins over an incoming frame.
  const serverKey = [...serverPicks].sort().join("|");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (!dirty && serverKey !== seenKey) {
    setSeenKey(serverKey);
    setPicks(serverPicks);
  }

  const toggle = useCallback(
    (id: string) => {
      setNotice(null);
      setDirty(true);
      setPicks((current) => {
        if (current.includes(id)) return current.filter((x) => x !== id);
        if (current.length >= max) {
          setNotice(
            max === 1 ? "Choose only one" : `Choose only ${numberWord(max)} — deselect one first`,
          );
          return current;
        }
        return [...current, id];
      });
    },
    [max],
  );

  const complete = picks.length >= min && picks.length <= max;
  const unchanged = useMemo(
    () =>
      complete &&
      picks.length === serverPicks.length &&
      picks.every((p) => serverPicks.includes(p)),
    [complete, picks, serverPicks],
  );

  return {
    picks,
    isPicked: (id) => picks.includes(id),
    toggle,
    notice,
    min,
    max,
    complete,
    unchanged,
    markSubmitted: () => setDirty(false),
    counterLabel: `${picks.length} of ${max} selected`,
  };
}

function numberWord(n: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six"][n] ?? String(n);
}
