import "server-only";
import { getStore } from "@/lib/store";
import type { SessionRecord } from "@/lib/types";

type Listener = (session: SessionRecord) => void;

/**
 * Fan-out point between "something changed" and "every open screen knows".
 *
 * The store tells us *which* session changed (locally for the memory driver,
 * over LISTEN/NOTIFY for Postgres). The hub reads that session once and hands
 * the same record to every listener, so a room of 80 phones costs one read per
 * change rather than eighty.
 */
class Hub {
  private listeners = new Map<string, Set<Listener>>();
  private pending = new Map<string, NodeJS.Timeout>();
  private wired: Promise<void> | null = null;

  private wire(): Promise<void> {
    this.wired ??= (async () => {
      const store = getStore();
      await store.init();
      await store.subscribe((code) => this.schedule(code));
    })();
    return this.wired;
  }

  /**
   * Coalesce bursts: thirty people tapping an option in the same second should
   * produce a handful of frames, not thirty.
   */
  private schedule(code: string) {
    if (!this.listeners.get(code)?.size) return;
    if (this.pending.has(code)) return;
    const timer = setTimeout(() => {
      this.pending.delete(code);
      void this.flush(code);
    }, 60);
    timer.unref?.();
    this.pending.set(code, timer);
  }

  private async flush(code: string) {
    const set = this.listeners.get(code);
    if (!set?.size) return;
    const session = await getStore().getByCode(code);
    if (!session) return;
    for (const listener of [...set]) {
      try {
        listener(session);
      } catch {
        // A dead connection must not stop the rest of the room updating.
      }
    }
  }

  async subscribe(code: string, listener: Listener): Promise<() => void> {
    await this.wire();
    const set = this.listeners.get(code) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(code, set);
    return () => {
      const current = this.listeners.get(code);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(code);
        const timer = this.pending.get(code);
        if (timer) {
          clearTimeout(timer);
          this.pending.delete(code);
        }
      }
    };
  }

  connectionCount(code: string): number {
    return this.listeners.get(code)?.size ?? 0;
  }
}

declare global {
  var __teamPulseHub: Hub | undefined;
}

export function getHub(): Hub {
  globalThis.__teamPulseHub ??= new Hub();
  return globalThis.__teamPulseHub;
}
