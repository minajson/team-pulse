/**
 * Validates the facilitator QR overlay against the brief's checklist:
 * showing the join screen mid-session must change nothing underneath it.
 */
const B = process.env.TEAM_PULSE_URL ?? "http://localhost:3210";
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const post = async (p, body, headers = {}) => {
  const res = await fetch(B + p, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const get = async (p, headers = {}) => (await fetch(B + p, { headers })).json();

// 1–2. Start a session and join participants.
const s = (await post("/api/sessions", { title: "Overlay test" })).data;
const H = { "x-facilitator-token": s.facilitatorToken };
const cmd = (c) => post(`/api/sessions/${s.code}/control`, { command: c }, H);

await cmd({ type: "start" });
const people = [];
for (let i = 0; i < 6; i++) {
  const r = await post(`/api/sessions/${s.code}/join`, { mode: i < 4 ? "room" : "online" });
  people.push(r.data);
}
check("participants joined", people.length === 6);

// 3–4. Move to Round 2 and submit responses.
await cmd({ type: "goto", stepIndex: 5 });
for (const [i, p] of people.entries()) {
  await post(
    `/api/sessions/${s.code}/respond`,
    { questionId: "r2q1", optionIds: [i % 2 === 0 ? "r2q1-a" : "r2q1-b"] },
    { "x-participant-id": p.participantId, "x-participant-secret": p.secret },
  );
}

// 5. Reveal.
await cmd({ type: "reveal" });
const revealed = await get(`/api/sessions/${s.code}`);
check("round 2 revealed with votes", revealed.phase === "revealed" && revealed.counts.responses === 6,
  `phase=${revealed.phase} responses=${revealed.counts.responses}`);
const tallyBefore = JSON.stringify(revealed.results.options.map((o) => [o.optionId, o.count]));

// 6–7. Show the QR, and verify nothing underneath moved.
await cmd({ type: "showJoin" });
const overlaid = await get(`/api/sessions/${s.code}`);
check("overlay is active", overlaid.overlay === "join", String(overlaid.overlay));
check("step preserved under overlay", overlaid.stepIndex === 5, String(overlaid.stepIndex));
check("phase preserved under overlay", overlaid.phase === "revealed", overlaid.phase);
check("responses preserved under overlay", overlaid.counts.responses === 6, String(overlaid.counts.responses));
check("results preserved under overlay",
  JSON.stringify(overlaid.results.options.map((o) => [o.optionId, o.count])) === tallyBefore);
check("participant count still live", overlaid.counts.total === 6, String(overlaid.counts.total));

// 8. A late participant joins while the QR is up.
const late = (await post(`/api/sessions/${s.code}/join`, { mode: "online" })).data;
check("late participant joined during overlay", Boolean(late.participantId));
const afterLate = await get(`/api/sessions/${s.code}`);
check("late join raised the live count", afterLate.counts.total === 7, String(afterLate.counts.total));
check("late join did not disturb the round", afterLate.stepIndex === 5 && afterLate.phase === "revealed");

// 9–10. Return, and confirm the exact prior state.
await cmd({ type: "hideJoin" });
const back = await get(`/api/sessions/${s.code}`);
check("overlay cleared", back.overlay === null, String(back.overlay));
check("returned to the same step", back.stepIndex === 5, String(back.stepIndex));
check("returned to the revealed state", back.phase === "revealed", back.phase);
check("all previous votes intact",
  JSON.stringify(back.results.options.map((o) => [o.optionId, o.count])) === tallyBefore, tallyBefore);

// 11. Repeat from an open-voting state.
await cmd({ type: "goto", stepIndex: 6 });
const votingBefore = await get(`/api/sessions/${s.code}`);
check("now on an open-voting question", votingBefore.phase === "voting", votingBefore.phase);
await post(
  `/api/sessions/${s.code}/respond`,
  { questionId: "r2q2", optionIds: ["r2q2-a"] },
  { "x-participant-id": people[0].participantId, "x-participant-secret": people[0].secret },
);
await cmd({ type: "showJoin" });

// Participants must still be able to answer while the QR is on the projector.
const duringOverlay = await post(
  `/api/sessions/${s.code}/respond`,
  { questionId: "r2q2", optionIds: ["r2q2-b"] },
  { "x-participant-id": people[1].participantId, "x-participant-secret": people[1].secret },
);
check("participants can still answer while the QR is up", duringOverlay.status === 200, `status ${duringOverlay.status}`);

await cmd({ type: "hideJoin" });
const backVoting = await get(`/api/sessions/${s.code}`);
check("returned to open voting", backVoting.phase === "voting" && backVoting.stepIndex === 6,
  `phase=${backVoting.phase} step=${backVoting.stepIndex}`);
check("answers given during the overlay counted", backVoting.counts.responses === 2,
  String(backVoting.counts.responses));

// 12. Repeat from Round 5 and from a closing screen.
await cmd({ type: "goto", stepIndex: 11 });
await cmd({ type: "showJoin" });
const r5 = await get(`/api/sessions/${s.code}`);
check("overlay works on round 5", r5.overlay === "join" && r5.stepIndex === 11, `step=${r5.stepIndex}`);
await cmd({ type: "hideJoin" });
check("round 5 restored", (await get(`/api/sessions/${s.code}`)).stepIndex === 11);

await cmd({ type: "gotoClosing" });
await cmd({ type: "showJoin" });
const closing = await get(`/api/sessions/${s.code}`);
check("overlay works on closing screens", closing.overlay === "join" && closing.step.type === "closing");
check("closing summary survives the overlay", closing.summary !== null);
await cmd({ type: "hideJoin" });
const backClosing = await get(`/api/sessions/${s.code}`);
check("closing screen restored", backClosing.step.type === "closing" && backClosing.overlay === null);

// Navigating away should dismiss the overlay rather than strand it on screen.
await cmd({ type: "showJoin" });
await cmd({ type: "next" });
check("navigating dismisses the overlay", (await get(`/api/sessions/${s.code}`)).overlay === null);

/* ------------------------------------------------------------------ */
/* Late joiners                                                        */
/* ------------------------------------------------------------------ */
//
// Someone scanning the corner QR mid-session must land on whatever is on
// screen right now — not be walked through the rounds they missed.

await cmd({ type: "goto", stepIndex: 8 });   // Round 2, Q4
await cmd({ type: "reopen" });

const beforeLate = await get(`/api/sessions/${s.code}`);
const r1Before = (await get(`/api/sessions/${s.code}/control`, H)).progress.find(
  (p) => p.questionId === "r1q1",
).responses;
const latecomer = (await post(`/api/sessions/${s.code}/join`, { mode: "room" })).data;
check("late joiner gets an identity", Boolean(latecomer.participantId));

// The state handed back at join is what their phone renders first.
check(
  "late joiner lands on the current question",
  latecomer.state.step?.questionId === "r2q4",
  JSON.stringify(latecomer.state.step),
);
check("late joiner sees it open for answers", latecomer.state.phase === "voting", latecomer.state.phase);
check(
  "late joiner has no answer to the current question",
  latecomer.state.you?.answered === false,
  JSON.stringify(latecomer.state.you),
);

// Denominator moves, numerator does not.
const afterJoin = await get(`/api/sessions/${s.code}`);
check(
  "joining raises the denominator only",
  afterJoin.counts.total === beforeLate.counts.total + 1 &&
    afterJoin.counts.responses === beforeLate.counts.responses,
  `${afterJoin.counts.responses}/${afterJoin.counts.total} (was ${beforeLate.counts.responses}/${beforeLate.counts.total})`,
);

// They can answer the current question...
const lateAnswer = await post(
  `/api/sessions/${s.code}/respond`,
  { questionId: "r2q4", optionIds: ["r2q4-a"] },
  { "x-participant-id": latecomer.participantId, "x-participant-secret": latecomer.secret },
);
check("late joiner can answer the current question", lateAnswer.status === 200, `status ${lateAnswer.status}`);

// ...but cannot backfill one they missed.
const backfill = await post(
  `/api/sessions/${s.code}/respond`,
  { questionId: "r1q1", optionIds: ["r1q1-a"] },
  { "x-participant-id": latecomer.participantId, "x-participant-secret": latecomer.secret },
);
check("late joiner cannot backfill a missed question", backfill.status === 409, `status ${backfill.status}`);

const afterAnswer = await get(`/api/sessions/${s.code}`);
check(
  "late answer counts toward the current question",
  afterAnswer.counts.responses === beforeLate.counts.responses + 1,
  `${afterAnswer.counts.responses}/${afterAnswer.counts.total}`,
);

// Their missed rounds stay empty rather than being back-filled.
const hostAfter = await get(`/api/sessions/${s.code}/control`, H);
const r1After = hostAfter.progress.find((p) => p.questionId === "r1q1").responses;
check(
  "arriving late did not back-fill a missed round",
  r1After === r1Before,
  `r1q1 has ${r1After} responses (was ${r1Before})`,
);

console.log(`\n${failures === 0 ? "ALL OVERLAY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
