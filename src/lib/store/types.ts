import type { SessionRecord } from "@/lib/types";

/**
 * Mutator contract: mutate the draft in place. Return `false` to abort the
 * write (nothing is persisted, nothing is broadcast).
 */
export type Mutator<T> = (draft: SessionRecord) => T | false;

export interface UpdateResult<T> {
  session: SessionRecord;
  value: T;
}

export interface SessionStore {
  readonly driver: "memory" | "postgres";
  init(): Promise<void>;
  create(record: SessionRecord): Promise<SessionRecord>;
  getByCode(code: string): Promise<SessionRecord | null>;
  /**
   * Read-modify-write under a per-session lock. Returns `null` when the
   * session does not exist or the mutator aborted.
   */
  update<T>(code: string, mutator: Mutator<T>): Promise<UpdateResult<T> | null>;
  remove(code: string): Promise<void>;
  /** Codes with any activity since `since` (ms epoch). Used for cleanup. */
  listCodes(): Promise<string[]>;
  /**
   * Cross-process fan-out. The memory driver resolves this locally; the
   * Postgres driver rides LISTEN/NOTIFY so multiple app instances stay in sync.
   */
  subscribe(handler: (code: string) => void): Promise<() => void>;
  publish(code: string): Promise<void>;
}
