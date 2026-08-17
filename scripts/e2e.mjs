/**
 * End-to-end checks against a running Team Pulse server.
 *
 *   npm run dev            # in one terminal
 *   npm run test:e2e       # in another
 *
 * Covers the three things that are expensive to get wrong in front of a room:
 * the live transport, the answer validation, and the promise that nothing
 * traceable to a person ever leaves the server.
 */
const BASE = process.env.TEAM_PULSE_URL ?? "http://localhost:3000";
let failures = 0;

const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const post = async (path, body, headers = {}) => {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const get = async (path, headers = {}) => {
  const res = await fetch(BASE + path, { headers });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

// ---- create -------------------------------------------------------
const created = await post("/api/sessions", { title: "Test Session" });
check("create session", created.status === 201 && /^\d{4}$/.test(created.data.code ?? ""), created.data.code);
const code = created.data.code;
const token = created.data.facilitatorToken;
const hdrHost = { "x-facilitator-token": token };

// ---- SSE stream ---------------------------------------------------
const streamFrames = [];
const ac = new AbortController();
const streamDone = (async () => {
  const res = await fetch(`${BASE}/api/sessions/${code}/stream`, { signal: ac.signal });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = frame.split("\n").find((l) => l.startsWith("data:"));
      if (data) streamFrames.push(JSON.parse(data.slice(5)));
    }
  }
})().catch(() => {});

const waitFor = async (predicate, timeoutMs = 8000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
};

check(
  "SSE delivers initial state",
  await waitFor(() => streamFrames.length >= 1),
  `${streamFrames.length} frame(s)`,
);
check("SSE state has no facilitatorToken", !("facilitatorToken" in (streamFrames[0] ?? {})));
check("SSE state has no participants array", !("participants" in (streamFrames[0] ?? {})));

// ---- join ---------------------------------------------------------
const participants = [];
for (let i = 0; i < 8; i += 1) {
  const mode = i < 5 ? "room" : "online";
  const r = await post(`/api/sessions/${code}/join`, { mode });
  participants.push({ ...r.data, mode });
}
check("8 participants joined", participants.every((p) => p.participantId && p.secret));

const afterJoin = await get(`/api/sessions/${code}`);
check(
  "counts split room/online",
  afterJoin.data.counts.total === 8 && afterJoin.data.counts.room === 5 && afterJoin.data.counts.online === 3,
  JSON.stringify(afterJoin.data.counts),
);

// ---- reconnect (same identity, no duplicate) ----------------------
const rejoin = await post(`/api/sessions/${code}/join`, {
  mode: "room",
  participantId: participants[0].participantId,
  secret: participants[0].secret,
});
check("reconnect reuses identity", rejoin.data.participantId === participants[0].participantId);
const afterRejoin = await get(`/api/sessions/${code}`);
check("reconnect did not add a participant", afterRejoin.data.counts.total === 8, String(afterRejoin.data.counts.total));

// ---- forged secret rejected ---------------------------------------
const forged = await post(`/api/sessions/${code}/join`, {
  mode: "room",
  participantId: participants[0].participantId,
  secret: "deadbeefdeadbeefdeadbeef",
});
check("forged secret creates a new participant instead of hijacking", forged.data.participantId !== participants[0].participantId);

// ---- responses before start rejected ------------------------------
const early = await post(
  `/api/sessions/${code}/respond`,
  { questionId: "r1q1", optionIds: ["r1q1-b"] },
  { "x-participant-id": participants[0].participantId, "x-participant-secret": participants[0].secret },
);
check("response rejected before session starts", early.status === 409, `status ${early.status}`);

// ---- unauthorised control rejected --------------------------------
const badControl = await post(`/api/sessions/${code}/control`, { command: { type: "start" } }, { "x-facilitator-token": "0".repeat(32) });
check("control rejected with wrong token", badControl.status === 403, `status ${badControl.status}`);

const noToken = await post(`/api/sessions/${code}/control`, { command: { type: "start" } });
check("control rejected with no token", noToken.status === 403, `status ${noToken.status}`);

// ---- start & answer -----------------------------------------------
await post(`/api/sessions/${code}/control`, { command: { type: "start" } }, hdrHost);

const optionOrder = ["r1q1-a", "r1q1-b", "r1q1-c", "r1q1-d"];
for (const [i, p] of participants.entries()) {
  const r = await post(
    `/api/sessions/${code}/respond`,
    { questionId: "r1q1", optionIds: [optionOrder[i % 4]] },
    { "x-participant-id": p.participantId, "x-participant-secret": p.secret },
  );
  if (r.status !== 200) check(`respond ${i}`, false, JSON.stringify(r.data));
}
const voting = await get(`/api/sessions/${code}`);
check("responses counted", voting.data.counts.responses === 8, String(voting.data.counts.responses));
check("results hidden before reveal", voting.data.results === null);

// ---- own answer echoed back ---------------------------------------
const mine = await get(`/api/sessions/${code}?participantId=${participants[0].participantId}`);
check("own answer echoed to its owner", mine.data.you?.optionIds?.[0] === "r1q1-a", JSON.stringify(mine.data.you));
check("other participants' answers not exposed", !("responses" in mine.data));

// ---- reveal --------------------------------------------------------
await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hdrHost);
const revealed = await get(`/api/sessions/${code}`);
check("results present after reveal", revealed.data.results !== null);
const total = (revealed.data.results?.options ?? []).reduce((s, o) => s + o.count, 0);
check("tally totals match responses", total === 8, String(total));
const pctSum = (revealed.data.results?.options ?? []).reduce((s, o) => s + o.pct, 0);
check("percentages sum to 100", Math.abs(pctSum - 100) < 0.001, pctSum.toFixed(3));

// ---- answering a locked question ----------------------------------
const late = await post(
  `/api/sessions/${code}/respond`,
  { questionId: "r1q1", optionIds: ["r1q1-a"] },
  { "x-participant-id": participants[1].participantId, "x-participant-secret": participants[1].secret },
);
check("late response rejected after reveal", late.status === 409, `status ${late.status}`);

// ---- selection modes -------------------------------------------------
//
// Each question declares how it is answered (single / exactly-N / points /
// text). These check the server enforces that declaration, because the input
// component and the validator reading the same metadata is the only thing
// keeping the phone and the tally in agreement.

// Round 3 — exactly THREE, and the tally records the one NOT chosen.
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stepIndex: 9 } }, hdrHost);
const step9 = await get(`/api/sessions/${code}`);
check("step 9 is the profile round", step9.data.step?.questionId === "r3q1", JSON.stringify(step9.data.step));

const hdrFor = (p) => ({ "x-participant-id": p.participantId, "x-participant-secret": p.secret });
const pick3 = (ids) => post(`/api/sessions/${code}/respond`, { questionId: "r3q1", optionIds: ids }, hdrFor(participants[0]));

check("round 3 rejects one profile", (await pick3(["nory"])).status === 422);
check("round 3 rejects two profiles", (await pick3(["nory", "dove"])).status === 422);
check("round 3 rejects all four profiles", (await pick3(["nory", "dove", "nia", "ria"])).status === 422);
check("round 3 rejects an unknown profile", (await pick3(["nory", "dove", "ghost"])).status === 422);
check("round 3 accepts exactly three", (await pick3(["nory", "dove", "nia"])).status === 200);

// The participant's own echo must be what they picked, not the inverse —
// otherwise a refresh mid-round would restore the wrong three cards.
const mine3 = await get(`/api/sessions/${code}?participantId=${participants[0].participantId}`);
check(
  "round 3 echoes back the three chosen",
  ["nory", "dove", "nia"].every((id) => mine3.data.you.optionIds.includes(id)) &&
    mine3.data.you.optionIds.length === 3,
  JSON.stringify(mine3.data.you.optionIds),
);

// Everyone else takes a different three, leaving a different person behind.
for (const p of participants.slice(1, 5)) {
  await post(`/api/sessions/${code}/respond`, { questionId: "r3q1", optionIds: ["dove", "nia", "ria"] }, hdrFor(p));
}
await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hdrHost);
const r3 = await get(`/api/sessions/${code}`);
const leftBehind = Object.fromEntries(r3.data.results.options.map((o) => [o.optionId, o.count]));
check(
  "tally counts the profile left behind, not the ones taken",
  leftBehind.ria === 1 && leftBehind.nory === 4 && leftBehind.dove === 0 && leftBehind.nia === 0,
  JSON.stringify(leftBehind),
);
const r3pct = r3.data.results.options.reduce((sum, o) => sum + o.pct, 0);
check("round 3 percentages sum to 100 (one left behind each)", Math.abs(r3pct - 100) < 0.001, r3pct.toFixed(3));

// Round 6 Q1 — single-select must replace, never accumulate.
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stepIndex: 12 } }, hdrHost);
const step12 = await get(`/api/sessions/${code}`);
check("step 12 is the single-select priority question", step12.data.step?.questionId === "r6q1");
await post(`/api/sessions/${code}/respond`, { questionId: "r6q1", optionIds: ["communication"] }, hdrFor(participants[0]));
await post(`/api/sessions/${code}/respond`, { questionId: "r6q1", optionIds: ["collaboration"] }, hdrFor(participants[0]));
const singleEcho = await get(`/api/sessions/${code}?participantId=${participants[0].participantId}`);
check(
  "single-select replaces rather than accumulating",
  singleEcho.data.you.optionIds.length === 1 && singleEcho.data.you.optionIds[0] === "collaboration",
  JSON.stringify(singleEcho.data.you.optionIds),
);
check(
  "changing a single-select answer does not add a second response",
  singleEcho.data.counts.responses === 1,
  String(singleEcho.data.counts.responses),
);
const twoAtOnce = await post(`/api/sessions/${code}/respond`, { questionId: "r6q1", optionIds: ["trust", "listening"] }, hdrFor(participants[0]));
check("single-select rejects two options", twoAtOnce.status === 422, `status ${twoAtOnce.status}`);

// ---- validation ----------------------------------------------------
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stepIndex: 10 } }, hdrHost); // r4q1 ($10k)
const step10 = await get(`/api/sessions/${code}`);
check("goto step 10 is the $10,000 round", step10.data.step?.questionId === "r4q1", JSON.stringify(step10.data.step));

const hdrP0 = { "x-participant-id": participants[0].participantId, "x-participant-secret": participants[0].secret };
const onePick = await post(`/api/sessions/${code}/respond`, { questionId: "r4q1", optionIds: ["training"] }, hdrP0);
check("pick-two rejects a single choice", onePick.status === 422, `status ${onePick.status}`);

const threePicks = await post(`/api/sessions/${code}/respond`, { questionId: "r4q1", optionIds: ["training", "wellbeing", "technology"] }, hdrP0);
check("pick-two rejects three choices", threePicks.status === 422, `status ${threePicks.status}`);

const bogus = await post(`/api/sessions/${code}/respond`, { questionId: "r4q1", optionIds: ["training", "not-an-option"] }, hdrP0);
check("unknown option rejected", bogus.status === 422, `status ${bogus.status}`);

const goodPick = await post(`/api/sessions/${code}/respond`, { questionId: "r4q1", optionIds: ["training", "wellbeing"] }, hdrP0);
check("pick-two accepts exactly two", goodPick.status === 200, `status ${goodPick.status}`);

// points round
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stepIndex: 11 } }, hdrHost);
const short = await post(`/api/sessions/${code}/respond`, { questionId: "r5q1", points: { trust: 50, communication: 30 } }, hdrP0);
check("points rejects a total under 100", short.status === 422, `status ${short.status}`);

const fractional = await post(`/api/sessions/${code}/respond`, { questionId: "r5q1", points: { trust: 50.5, communication: 49.5, respect: 0, accountability: 0, competence: 0, leadership: 0, innovation: 0, fun: 0 } }, hdrP0);
check("points rejects fractions", fractional.status === 422, `status ${fractional.status}`);

const exact = { trust: 20, communication: 20, respect: 15, accountability: 15, competence: 10, leadership: 10, innovation: 5, fun: 5 };
const goodPoints = await post(`/api/sessions/${code}/respond`, { questionId: "r5q1", points: exact }, hdrP0);
check("points accepts exactly 100", goodPoints.status === 200, `status ${goodPoints.status}`);

// free text
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stepIndex: 13 } }, hdrHost);
const stepText = await get(`/api/sessions/${code}`);
check("step 13 is the free-text question", stepText.data.step?.questionId === "r6q2", JSON.stringify(stepText.data.step));

const tooLong = await post(`/api/sessions/${code}/respond`, { questionId: "r6q2", text: "one two three four five six seven" }, hdrP0);
check("text rejects seven words", tooLong.status === 422, `status ${tooLong.status}`);

const empty = await post(`/api/sessions/${code}/respond`, { questionId: "r6q2", text: "   " }, hdrP0);
check("text rejects blank", empty.status === 422, `status ${empty.status}`);

const clean = await post(`/api/sessions/${code}/respond`, { questionId: "r6q2", text: "  listened   to  each other more " }, hdrP0);
check("text accepts and normalises whitespace", clean.status === 200, `status ${clean.status}`);

const profane = await post(
  `/api/sessions/${code}/respond`,
  { questionId: "r6q2", text: "stopped this sh1t now" },
  { "x-participant-id": participants[1].participantId, "x-participant-secret": participants[1].secret },
);
check("profanity accepted but queued", profane.status === 200, `status ${profane.status}`);

const wallState = await get(`/api/sessions/${code}`);
const wallTexts = wallState.data.wall.map((w) => w.text);
check("clean text is on the wall", wallTexts.includes("listened to each other more"), JSON.stringify(wallTexts));
check("flagged text is NOT on the wall", !wallTexts.some((t) => t.includes("sh1t")), JSON.stringify(wallTexts));

const hostView = await get(`/api/sessions/${code}/control`, hdrHost);
const pending = hostView.data.moderation.filter((m) => m.moderation === "pending");
check("flagged text is in the moderation queue", pending.length === 1, JSON.stringify(pending.map((p) => p.text)));

// ---- hearts --------------------------------------------------------
const target = wallState.data.wall[0];
const hdrP2 = { "x-participant-id": participants[2].participantId, "x-participant-secret": participants[2].secret };
await post(`/api/sessions/${code}/react`, { responseId: target.id }, hdrP2);
const hearted = await get(`/api/sessions/${code}?participantId=${participants[2].participantId}`);
check("heart registered", hearted.data.wall[0].hearts === 1, String(hearted.data.wall[0].hearts));
check("hearted flag set for the reactor", hearted.data.wall[0].hearted === true);
const otherView = await get(`/api/sessions/${code}?participantId=${participants[3].participantId}`);
check("hearted flag not set for others", otherView.data.wall[0].hearted === false);

await post(`/api/sessions/${code}/react`, { responseId: target.id }, hdrP2);
const unhearted = await get(`/api/sessions/${code}`);
check("heart toggles off", unhearted.data.wall[0].hearts === 0, String(unhearted.data.wall[0].hearts));

// ---- SSE convergence -------------------------------------------------
//
// Deliberately not "how many frames arrived": the hub coalesces bursts, so a
// fast run legitimately collapses many changes into one frame. What has to be
// true is that an open screen ends up holding the latest state.
const revisions = streamFrames.map((f) => f.revision);
check(
  "SSE revisions never move backwards",
  revisions.every((r, i) => i === 0 || r >= revisions[i - 1]),
  JSON.stringify(revisions.slice(0, 12)),
);

const before = streamFrames.at(-1)?.revision ?? 0;
await post(`/api/sessions/${code}/control`, { command: { type: "settings", patch: { showQr: false } } }, hdrHost);
const serverRevision = (await get(`/api/sessions/${code}`)).data.revision;
const converged = await waitFor(() => (streamFrames.at(-1)?.revision ?? 0) >= serverRevision, 5000);
check(
  "an open stream converges on the latest state",
  converged,
  `client rev ${streamFrames.at(-1)?.revision} vs server rev ${serverRevision} (was ${before})`,
);
check(
  "converged frame carries the change",
  streamFrames.at(-1)?.settings?.showQr === false,
  JSON.stringify(streamFrames.at(-1)?.settings),
);

// ---- simulate --------------------------------------------------------
await post(`/api/sessions/${code}/control`, { command: { type: "simulate", count: 30 } }, hdrHost);
const simulated = await get(`/api/sessions/${code}/control`, hdrHost);
// 8 joined + 1 created by the forged-secret check above + 30 simulated.
check("simulate added 30 participants", simulated.data.counts.total === 39, String(simulated.data.counts.total));
check("simulate flagged them", simulated.data.simulatedCount === 30, String(simulated.data.simulatedCount));
const answered = simulated.data.progress.filter((p) => p.responses > 0);
check("simulate answered every round", answered.length === simulated.data.progress.length, `${answered.length}/${simulated.data.progress.length}`);

// ---- closing summary --------------------------------------------------
await post(`/api/sessions/${code}/control`, { command: { type: "gotoClosing" } }, hdrHost);
const closing = await get(`/api/sessions/${code}`);
check("closing step reached", closing.data.step?.type === "closing", JSON.stringify(closing.data.step));
check("summary generated", closing.data.summary !== null);
check("summary has investments", (closing.data.summary?.values.investments ?? []).length > 0);
check("summary has DNA", (closing.data.summary?.values.dna ?? []).length > 0);
const dnaSum = (closing.data.summary?.values.dna ?? []).reduce((s, d) => s + d.pct, 0);
check("DNA percentages sum to ~100", Math.abs(dnaSum - 100) < 1.5, dnaSum.toFixed(2));
check("summary has statements", (closing.data.summary?.voice.topStatements ?? []).length > 0);
check("summary names no participant", !JSON.stringify(closing.data.summary).includes(participants[0].participantId));

// ---- exports ----------------------------------------------------------
const csvRes = await fetch(`${BASE}/api/sessions/${code}/export?format=csv`, { headers: hdrHost });
const csv = await csvRes.text();
check("CSV export succeeds", csvRes.status === 200 && csv.split("\r\n").length > 5, `${csv.split("\r\n").length} rows`);
check("CSV has no participant ids", !participants.some((p) => csv.includes(p.participantId)));
check("CSV header has no respondent key", csv.split("\r\n")[0].includes("round") && !csv.split("\r\n")[0].includes("participant"));

const csvUnauth = await fetch(`${BASE}/api/sessions/${code}/export?format=csv`);
check("CSV export requires the facilitator token", csvUnauth.status === 403, `status ${csvUnauth.status}`);

const jsonRes = await fetch(`${BASE}/api/sessions/${code}/export?format=json`, { headers: hdrHost });
const deck = await jsonRes.json();
check("JSON deck export succeeds", jsonRes.status === 200 && Array.isArray(deck.rounds), `${deck.rounds?.length} rounds`);
check("JSON deck has no participant ids", !participants.some((p) => JSON.stringify(deck).includes(p.participantId)));

// ---- end ---------------------------------------------------------------
await post(`/api/sessions/${code}/control`, { command: { type: "end" } }, hdrHost);
const ended = await get(`/api/sessions/${code}`);
check("session ended", ended.data.status === "ended");

const joinAfterEnd = await post(`/api/sessions/${code}/join`, { mode: "room" });
check("join rejected after end", joinAfterEnd.status === 410, `status ${joinAfterEnd.status}`);

// ---- unknown session ---------------------------------------------------
const missing = await get(`/api/sessions/0000`);
check("unknown session is 404", missing.status === 404, `status ${missing.status}`);

ac.abort();
await streamDone;

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
