import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client, Pool } from "pg";
import type { SessionRecord } from "@/lib/types";
import type { Mutator, SessionStore, UpdateResult } from "./types";

const CHANNEL = "team_pulse";

/**
 * Postgres driver — used when TEAM_PULSE_DATABASE_URL is set. Works against
 * any Postgres, including the one behind a Supabase project.
 *
 * Atomicity comes from `SELECT … FOR UPDATE` inside a transaction, so two app
 * instances writing the same session serialise on the row rather than racing.
 * Realtime fan-out rides LISTEN/NOTIFY (see schema.sql).
 */
export class PostgresStore implements SessionStore {
  readonly driver = "postgres" as const;

  private pool: Pool;
  private listener: Client | null = null;
  private subscribers = new Set<(code: string) => void>();
  private ready: Promise<void> | null = null;

  constructor(private readonly connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.TEAM_PULSE_PG_POOL ?? 10),
      // Supabase's pooler and most managed Postgres require TLS but present
      // certificates this process has no root for.
      ssl: /localhost|127\.0\.0\.1/.test(connectionString)
        ? undefined
        : { rejectUnauthorized: false },
    });
  }

  init(): Promise<void> {
    this.ready ??= this.bootstrap();
    return this.ready;
  }

  private async bootstrap(): Promise<void> {
    const schemaPath = path.join(process.cwd(), "src", "lib", "store", "schema.sql");
    try {
      const sql = await readFile(schemaPath, "utf8");
      await this.pool.query(sql);
    } catch (error) {
      // The schema may already be applied by an operator with rights this
      // role lacks. Verify the table is reachable before giving up.
      await this.pool.query("SELECT 1 FROM team_pulse_sessions LIMIT 1").catch(() => {
        throw error;
      });
    }
    await this.startListener();
  }

  private async startListener(): Promise<void> {
    if (this.listener) return;
    const client = new Client({
      connectionString: this.connectionString,
      ssl: /localhost|127\.0\.0\.1/.test(this.connectionString)
        ? undefined
        : { rejectUnauthorized: false },
    });
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      for (const handler of this.subscribers) {
        try {
          handler(msg.payload);
        } catch {
          // One broken subscriber must not stop the others.
        }
      }
    });
    client.on("error", () => {
      // Reconnect on the next tick; SSE clients re-sync on their own poll.
      this.listener = null;
      setTimeout(() => void this.startListener().catch(() => {}), 2000).unref?.();
    });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    this.listener = client;
  }

  async create(record: SessionRecord): Promise<SessionRecord> {
    await this.init();
    await this.pool.query(
      `INSERT INTO team_pulse_sessions (code, id, facilitator_token, data)
       VALUES ($1, $2, $3, $4)`,
      [record.code, record.id, record.facilitatorToken, record],
    );
    return record;
  }

  async getByCode(code: string): Promise<SessionRecord | null> {
    await this.init();
    const { rows } = await this.pool.query<{ data: SessionRecord }>(
      "SELECT data FROM team_pulse_sessions WHERE code = $1",
      [code],
    );
    return rows[0]?.data ?? null;
  }

  async update<T>(code: string, mutator: Mutator<T>): Promise<UpdateResult<T> | null> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ data: SessionRecord }>(
        "SELECT data FROM team_pulse_sessions WHERE code = $1 FOR UPDATE",
        [code],
      );
      const current = rows[0]?.data;
      if (!current) {
        await client.query("ROLLBACK");
        return null;
      }
      const draft = current;
      const value = mutator(draft);
      if (value === false) {
        await client.query("ROLLBACK");
        return null;
      }
      draft.updatedAt = Date.now();
      draft.revision = (draft.revision ?? 0) + 1;
      await client.query(
        "UPDATE team_pulse_sessions SET data = $2, updated_at = now() WHERE code = $1",
        [code, draft],
      );
      await client.query("COMMIT");
      return { session: draft, value: value as T };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async remove(code: string): Promise<void> {
    await this.init();
    await this.pool.query("DELETE FROM team_pulse_sessions WHERE code = $1", [code]);
  }

  async listCodes(): Promise<string[]> {
    await this.init();
    const { rows } = await this.pool.query<{ code: string }>(
      "SELECT code FROM team_pulse_sessions ORDER BY updated_at DESC LIMIT 500",
    );
    return rows.map((r) => r.code);
  }

  async subscribe(handler: (code: string) => void): Promise<() => void> {
    await this.init();
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  async publish(code: string): Promise<void> {
    await this.init();
    await this.pool.query("SELECT pg_notify($1, $2)", [CHANNEL, code]);
  }
}
