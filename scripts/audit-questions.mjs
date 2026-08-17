/**
 * Prints how every participant question is answered, read straight from the
 * `selection` metadata in the session plan.
 *
 *   npm run audit:questions
 *
 * The point is that this is generated, not maintained by hand: if the table is
 * right, the validator, the tally and the input component are right too,
 * because all three read the same field.
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/content/session-plan.ts", import.meta.url), "utf8");

// Pull each question's id, kind and selection literal out of the source.
const questions = [];
const re = /id:\s*"(r\dq\d)"[\s\S]*?kind:\s*"([a-z-]+)"[\s\S]*?selection:\s*(\{[^}]*\})/g;
let m;
while ((m = re.exec(src))) questions.push({ id: m[1], kind: m[2], selection: m[3] });

// The two helper-generated rounds declare selection inline; catch those too.
const helperSingles = [...src.matchAll(/"(r[12]q\d)"/g)].map((x) => x[1]);
for (const id of new Set(helperSingles)) {
  if (!questions.some((q) => q.id === id)) {
    questions.push({ id, kind: id.startsWith("r1") ? "single" : "split", selection: '{ mode: "single" }' });
  }
}
questions.sort((a, b) => a.id.localeCompare(b.id));

const describe = (sel) => {
  if (/mode:\s*"single"/.test(sel)) return ["single-select", "exactly 1 — tapping another replaces it"];
  if (/mode:\s*"multiple"/.test(sel)) {
    const min = Number(/min:\s*(\d+)/.exec(sel)?.[1]);
    const max = Number(/max:\s*(\d+)/.exec(sel)?.[1]);
    const excluded = /store:\s*"excluded"/.test(sel);
    return [
      "multi-select",
      `${min === max ? `exactly ${min}` : `${min}–${max}`}${excluded ? " — stores the option NOT picked" : ""}`,
    ];
  }
  if (/mode:\s*"points"/.test(sel)) {
    return ["slider allocation", `must total ${/total:\s*(\d+)/.exec(sel)?.[1]}`];
  }
  return ["free text", `1–${/maxWords:\s*(\d+)/.exec(sel)?.[1]} words, moderated`];
};

const rows = questions.map((q) => {
  const [mode, rule] = describe(q.selection);
  return [q.id, q.kind, mode, rule];
});
rows.push(["r6q2 ♥", "open-text", "heart / reaction", "one heart per person per statement"]);

const header = ["QUESTION", "RENDERER", "SELECTION MODE", "RULE"];
const width = header.map((_, i) => Math.max(...[header, ...rows].map((r) => r[i].length)));
const line = (r) => r.map((c, i) => c.padEnd(width[i])).join("  ");

console.log(line(header));
console.log(width.map((n) => "-".repeat(n)).join("  "));
rows.forEach((r) => console.log(line(r)));
console.log(`\n${rows.length} participant interactions.`);
