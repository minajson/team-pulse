# TEAM PULSE

**What does our team really think?**

A live team-engagement tool for facilitated hybrid sessions. Six rounds that get
a team talking honestly about collaboration, trust, accountability and how they
actually prefer to work together — with half the room in the room and half of it
online.

It is not a quiz. Nothing is scored, nothing is marked correct, and no
participant is ever named on screen.

```bash
npm install
npm run dev          # http://localhost:3000
```

Open `/` → **Start a session** → you get a room code and the facilitator
dashboard. Open the presentation on the projector, and participants join by
scanning the QR.

---

## The three surfaces

| Surface | Route | Who it's for |
| --- | --- | --- |
| Participant | `/j/[code]` | Phones. Scan → pick room/online → answer. |
| Facilitator | `/host/[code]` | The presenter's laptop. All controls, moderation, exports. |
| Presentation | `/present/[code]` | The projector. Read-only, fullscreen, large type. |

`/join` is the manual code-entry route for anyone who can't scan.

All three read from the same live stream, so they cannot drift apart. The
facilitator's preview pane is a real embed of the presentation route — what it
shows is exactly what the room sees.

## The session

| # | Round | Interaction |
| --- | --- | --- |
| 1 | You Decide | 5 scenarios, one of four reactions |
| 2 | Room vs Online | 4 questions, results split 🏢 vs 💻 |
| 3 | Who Would You Pick? | Four profile cards — who stays behind |
| 4 | The $10,000 Decision | Pick exactly two of six investments |
| 5 | Build Our Perfect Team | Allocate exactly 100 points across 8 values |
| 6 | Our Voice | One priority, then a six-word sentence + hearts |

Then three closing screens generated from the session's own data — *What we
value*, *How we think*, *Our voice* — and a final screen.

Round 2 fires a **We don't agree 👀** or **Great minds…** callout when the room
and the online half diverge by more than the configured threshold (default 20
points, needs at least 3 responses per side so one remote participant can't
trigger it). Both the callouts and the threshold are facilitator settings.

## How each question is answered

Every question declares its own `selection` metadata, and validation, the tally
and the input component all read that same field — so the phone, the server and
the chart cannot disagree about what a valid answer is. `npm run audit:questions`
prints the current map:

| Question | Selection mode | Rule |
| --- | --- | --- |
| R1 Q1–Q5, R2 Q1–Q4, R6 Q1 | single-select | exactly 1 — tapping another replaces it |
| R3 Q1 | multi-select | exactly 3 — **stores the option NOT picked** |
| R4 Q1 | multi-select | exactly 2 |
| R5 Q1 | slider allocation | must total 100 |
| R6 Q2 | free text | 1–6 words, moderated |
| R6 Q2 wall | heart / reaction | one heart per person per statement |

Two of these are worth knowing about:

**Round 3 asks the question twice, differently.** The projector asks "who stays
behind?" because that is what the room discusses. The phone asks participants to
*select three people for the project*, because picking a team is the decision
they are actually making — and nominating a colleague to exclude is a needlessly
uncomfortable way to collect the same data. The one they leave out is derived at
tally time, so the round's insight is unchanged. Responses are stored as
submitted, which keeps the echo-back correct on refresh and the CSV honest.

**At the maximum, an extra tap is refused, not absorbed.** Both multi-select
rounds show "choose only N — deselect one first" rather than silently evicting an
earlier pick. Quietly dropping a deliberate choice is worse than a moment of
friction: nobody notices until after they have submitted the wrong answer.

Multi-select never auto-submits — the answer is only meaningful once complete, so
it is confirmed with a button. Single-select still submits on tap.

## Adding rounds and question packs

`src/lib/content/session-plan.ts` is the single source of truth for session
content. Adding a question, or a whole round, means editing that file — the
transport, store, tally, facilitator and export layers all derive from it and
need no changes. A genuinely new *interaction* additionally needs a
`QuestionKind`, a participant input, and a projector stage.

## Architecture

```
Participant / Facilitator / Projector
              │  SSE over fetch (credentials in headers, never the URL)
              ▼
      /api/sessions/[code]/stream
              │
         realtime hub  ──── coalesces bursts, one store read per change
              │
        SessionStore ──┬── memory   (default: in-process + JSON snapshot)
                       └── postgres (TEAM_PULSE_DATABASE_URL, LISTEN/NOTIFY)
```

**Light throughout.** Participants, facilitator and projector all sit on warm
white. A workshop projected into a lit meeting room reads better on white than
on black, and the product should feel like a premium workshop rather than a BI
dashboard. Money is the one thing with its own colour: everything in the
$10,000 round — the figure, the banknotes, the allocations — is green, because
the brand amber is used for emphasis everywhere else and cash needs to read as
cash.

**Realtime** is server-sent events consumed with `fetch` + `ReadableStream`
rather than `EventSource`, because `EventSource` cannot set request headers and
would force session credentials into the query string. Clients reconnect with
capped backoff, and immediately when a phone wakes from sleep. Frames carry a
monotonic `revision` so a late frame can never roll the projector backwards.

**Storage** is behind a driver interface:

- **memory** (default) — authoritative in-process copy, snapshotted to
  `./.data/sessions.json` so a server restart mid-session doesn't lose the room.
  Writes are serialised per session. Correct for the single-node deployment this
  product actually runs on.
- **postgres** — set `TEAM_PULSE_DATABASE_URL`. Atomicity via
  `SELECT … FOR UPDATE`, cross-instance fan-out via `LISTEN/NOTIFY`. Works with
  any Postgres 13+, including the database behind a Supabase project. The schema
  applies itself on first use.

Both drivers pass the same end-to-end suite.

## Privacy

The product only works if people believe it. So:

- No accounts, no email, no names. A participant is an opaque id and a
  room/online flag, and nothing else.
- Participants get a secret at join, held only on their own device, which proves
  "this answer is mine" without identifying who they are.
- The projector never receives anyone's individual answer. A participant's own
  answer is echoed back to that participant alone.
- **Exports carry no respondent key at all** — not even a pseudonymous one. With
  a team of twelve, a stable id across six rounds is an identity in everything
  but name. Rows are shuffled so order can't be read back as submission order.
- Free text is sanitised, capped at six words, and passes a profanity check.
  Anything flagged goes to the facilitator's moderation queue rather than being
  silently dropped — a false positive costs one click, not a voice.

## Facilitator controls

Start · pause · resume · restart · next · back · skip · jump to any round ·
reveal · hide · lock · reopen · discuss · reset a single round · end session ·
show/hide QR · mute all sounds · disagreement threshold · moderation queue ·
demo mode · exports.

**Show join QR** puts the join screen back on the projector at any point — mid
round, mid vote, after a reveal, or during the closing screens — for anyone who
walks in late. It is an overlay, not navigation: the step, the phase and every
response underneath are untouched, participants can keep answering while it is
up, and **Return to session** puts the room back exactly where it was. **Copy
join link** is next to it for pasting into Teams or Zoom chat.

Keyboard: `→` next · `←` back · `R` reveal · `L` lock · `O` reopen · `D` discuss.

**Demo mode** (`Simulate 30 participants`) fills every round with believably
shaped answers — including a real room-vs-online divide — so the whole arc,
closing screens included, can be rehearsed without an audience. Simulated
participants are flagged and removable in one click.

## Exports

Summary PDF (typeset as a document, not a screenshot of a slide), anonymous
responses CSV, Team DNA PNG, response wall PNG, and slide-deck JSON. The PNGs render from
fixed off-screen 1600×900 cards, so output doesn't depend on the presenter's
window size or which frame of an animation was on screen.

## Sound

A reusable manager with fifteen cues, all synthesised in the browser via Web
Audio — no files to ship, and short, quiet cues by construction. Audio unlocks
on the first real gesture, respecting autoplay policy rather than working around
it. The facilitator's mute travels down the session stream and silences the
projector *and* every phone.

To swap in recorded audio, drop files in `public/sounds/` and map them in
`SOUND_SOURCES` in `src/lib/sound/cues.ts`. The manager prefers a file wherever
one exists and falls back to the synth otherwise; no other code changes.

## Accessibility

- Every ink step, and every accent used as text, clears **4.5:1** against the
  surface it sits on — computed, not eyeballed. Base accent colours are tuned
  for solid fills; the `-deep` steps exist for text on their own pale washes.
- Keyboard navigable throughout, with a visible focus ring that adapts to light
  and night surfaces.
- Heading outlines start at `h1` and skip no levels on all surfaces.
- Live regions announce response counts and remaining points.
- 44px minimum touch targets on the participant interface.
- `prefers-reduced-motion` strips decoration but keeps meaning — bars still
  reach their final width and counters still land on their number.
- Results never rely on colour alone: every bar carries its label and percentage.
- The response wall places cards by measured geometry and rejects any position
  that collides with one already placed, so statements cannot overlap at any
  count or sentence length. Anything that genuinely cannot fit is counted as
  "+N more" rather than stacked on top of somebody else's words.

## Testing

```bash
npm run dev
npm run test:e2e     # in a second terminal
```

```bash
npm run test:overlay # in the same second terminal
npm run audit:questions
```

62 checks covering the live transport, reconnection, answer validation for every
round type, moderation, hearts, facilitator authorisation, demo mode, the
closing summary, and the promise that no export contains anything traceable to a
person — plus 25 more asserting that showing the join QR mid-session changes
nothing underneath it. Point either at another server with `TEAM_PULSE_URL`.

To run it against Postgres instead of the default driver:

```bash
docker run -d --name team-pulse-pg -e POSTGRES_PASSWORD=pulse \
  -e POSTGRES_DB=teampulse -p 54999:5432 postgres:17-alpine
TEAM_PULSE_DATABASE_URL="postgres://postgres:pulse@127.0.0.1:54999/teampulse" npm run dev
```

## Deploying

`npm run build && npm start` behind any Node host that supports long-lived
responses (Fly, Railway, Render, a VPS, Docker). SSE needs streaming, so disable
response buffering at the proxy — the app already sends `X-Accel-Buffering: no`
for nginx.

For more than one instance, set `TEAM_PULSE_DATABASE_URL` so sessions are shared
and `LISTEN/NOTIFY` keeps instances in sync. A single instance needs no database.

### On Vercel

It works, with two constraints worth knowing before you pick a host.

**A database is mandatory, not optional.** The default driver keeps sessions in
process memory. Vercel autoscales to many concurrent instances, so a `POST` that
records an answer often lands on a different instance than the one holding the
projector's SSE stream — and the projector would never hear about it. The
filesystem snapshot does not save you either: the runtime filesystem is
read-only, so the write fails (silently, by design) and each instance keeps its
own divergent copy. Set `TEAM_PULSE_DATABASE_URL` and the Postgres driver's
`LISTEN/NOTIFY` restores cross-instance fan-out.

**Streams are capped at the function duration.** Vercel counts streamed
responses against max duration — 300s on Hobby, up to 800s on Pro. Every SSE
connection is therefore terminated on a timer and re-established. Clients already
reconnect with capped backoff and re-sync from the latest revision, so nothing is
lost, but a 40-minute session means roughly eight reconnects per open screen.

If the room can tolerate that, Vercel is fine. If you would rather the projector
simply held one connection for the whole session, a long-lived-process host
(Fly, Railway, Render) suits this design better and needs no database at all for
a single instance.

Whichever you choose, the QR needs nothing configured: every join URL is derived
from the request origin at render time, so it encodes whatever public domain the
app is actually served from. There is no base-URL environment variable to get
wrong.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Framer Motion · `pg` ·
`qrcode` · `jspdf` · `html-to-image`. No 3D, no runtime AI dependency — the
opening visual is a canvas the app draws itself, so it scales to any projector
and never buffers mid-session.
