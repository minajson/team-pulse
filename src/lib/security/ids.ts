import { randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

export const uuid = () => randomUUID();

/** 32-hex facilitator token — the only thing standing between a guest and the controls. */
export const facilitatorToken = () => randomBytes(16).toString("hex");

/** Per-participant secret, issued once at join and used to prove ownership of answers. */
export const participantSecret = () => randomBytes(12).toString("hex");

/**
 * Four-digit room code, readable across a conference room. Excludes codes
 * starting with 0 so the projector never shows a leading-zero ambiguity.
 */
export function joinCode(): string {
  return String(randomInt(1000, 10000));
}

/** Constant-time compare, so token checks do not leak length or prefix. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a ?? "", "utf8");
  const bufB = Buffer.from(b ?? "", "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
