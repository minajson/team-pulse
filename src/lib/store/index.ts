import "server-only";
import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import type { SessionStore } from "./types";

export type { SessionStore } from "./types";

declare global {
  var __teamPulseStore: SessionStore | undefined;
}

function build(): SessionStore {
  const url = process.env.TEAM_PULSE_DATABASE_URL?.trim();
  return url ? new PostgresStore(url) : new MemoryStore();
}

/**
 * Single store instance per process. Held on `globalThis` so Next's dev-mode
 * module reloading does not spawn a second store (and a second, divergent copy
 * of every live session) on each edit.
 */
export function getStore(): SessionStore {
  globalThis.__teamPulseStore ??= build();
  return globalThis.__teamPulseStore;
}
