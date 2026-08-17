/**
 * Free-text handling for the one place participants can type: the six-word
 * sentence in the final round.
 *
 * React escapes on render and nothing here is ever inserted as HTML, so this
 * is about keeping the projector clean rather than preventing injection:
 * strip anything that could break layout, and flag anything that should not
 * appear on a wall in front of a room.
 */

export const MAX_TEXT_LENGTH = 120;

/**
 * Drops control characters, zero-width/bidi-override characters (invisible on
 * screen but able to shred a line of centred type), and angle brackets.
 * Written as a code-point scan rather than a regex so the ranges stay legible.
 */
function stripUnsafe(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    // C0 and C1 control ranges — replaced with a space so words stay separated.
    if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) {
      out += " ";
      continue;
    }
    // Zero-width space/joiners, bidi overrides, invisible formatters, BOM.
    if (
      (cp >= 0x200b && cp <= 0x200f) ||
      (cp >= 0x202a && cp <= 0x202e) ||
      (cp >= 0x2060 && cp <= 0x206f) ||
      cp === 0xfeff
    ) {
      continue;
    }
    if (ch === "<" || ch === ">") continue;
    out += ch;
  }
  return out;
}

export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return stripUnsafe(input.normalize("NFKC"))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export interface TextValidation {
  ok: boolean;
  value: string;
  words: number;
  error?: string;
}

export function validateWords(input: unknown, maxWords: number): TextValidation {
  const value = sanitizeText(input);
  const words = wordCount(value);
  if (words === 0) {
    return { ok: false, value, words, error: "Add a few words first." };
  }
  if (words > maxWords) {
    return {
      ok: false,
      value,
      words,
      error: `${maxWords} words maximum — you have ${words}.`,
    };
  }
  return { ok: true, value, words };
}

/* ------------------------------------------------------------------ */
/* Moderation                                                          */
/* ------------------------------------------------------------------ */

/**
 * A deliberately small blocklist covering slurs and the strongest profanity —
 * enough that an obvious troll does not land on the projector unreviewed.
 * Anything it flags goes to the facilitator's moderation queue rather than
 * being silently dropped, so a false positive costs one click, not a voice.
 *
 * Swap `isFlagged` for a hosted moderation call if a deployment needs more.
 */
const BLOCKED = [
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "bastard",
  "asshole",
  "dickhead",
  "wanker",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "whore",
  "slut",
  "rape",
  "kill yourself",
  "kys",
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z ]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

export function isFlagged(text: string): boolean {
  const normalized = normalizeForMatch(text);
  const spaceless = normalized.replace(/ /g, "");
  return BLOCKED.some((word) => {
    const collapsed = word.replace(/ /g, "");
    return normalized.includes(word) || spaceless.includes(collapsed);
  });
}

/** Decided once at submit time; the facilitator can always override. */
export function moderationVerdict(text: string, autoApprove: boolean) {
  if (isFlagged(text)) return "pending" as const;
  return autoApprove ? ("approved" as const) : ("pending" as const);
}
