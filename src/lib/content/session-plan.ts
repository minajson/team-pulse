/**
 * TEAM PULSE — session content.
 *
 * This file is the single source of truth for what a session contains.
 * Adding a new round or question pack means editing this file (and, if the
 * round needs a new interaction, adding a `QuestionKind` renderer) — nothing
 * in the transport, store, or facilitator layers needs to change.
 */

export type RoundId =
  | "you-decide"
  | "room-vs-online"
  | "who-would-you-pick"
  | "ten-thousand"
  | "team-dna"
  | "our-voice";

export type QuestionKind =
  /** Pick exactly one option. Results shown as a single bar chart. */
  | "single"
  /** Pick exactly one option. Results split 🏢 Room vs 💻 Online. */
  | "split"
  /** Pick one profile card. */
  | "profile"
  /** Pick exactly two options. Rendered as the $10,000 investment round. */
  | "pick-two"
  /** Allocate exactly 100 points across the listed values. */
  | "points"
  /** Free text, 1–6 words, moderated, hearted on the live wall. */
  | "open-text";

export interface Option {
  id: string;
  /** Shown as the A/B/C/D marker on participant + projector. */
  marker?: string;
  label: string;
  emoji?: string;
}

export interface Profile {
  id: string;
  name: string;
  title: string;
  traits: string[];
  /** Hue used for the card's accent ring, 0–360. */
  hue: number;
}

export interface ValueDef {
  id: string;
  label: string;
  hue: number;
}

/**
 * How a question is answered.
 *
 * Declared per question rather than inferred from the round or the renderer,
 * because those two are not the same thing: rounds 3 and 4 both pick several
 * options but look nothing alike, and round 3 stores the inverse of what the
 * participant taps. Validation, the tally and the input component all read
 * this, so behaviour cannot drift between them.
 */
export type Selection =
  /** Exactly one option. Tapping another replaces it. */
  | { mode: "single" }
  | {
      /** Between `min` and `max` options; equal values mean "exactly N". */
      mode: "multiple";
      min: number;
      max: number;
      /**
       * "chosen"   — record what they picked (default).
       * "excluded" — record the options they did *not* pick.
       *
       * Round 3 asks the participant to choose three people to take, but the
       * insight the room discusses is who got left behind. Rather than asking
       * the question backwards on the phone, the participant picks the three
       * they want and the tally counts the one they did not.
       */
      store?: "chosen" | "excluded";
    }
  | { mode: "points"; total: number }
  | { mode: "text"; maxWords: number };

export interface Question {
  id: string;
  roundId: RoundId;
  kind: QuestionKind;
  /** Short label for facilitator lists, e.g. "Q3". */
  short: string;
  prompt: string;
  /** Optional line shown above the prompt on the projector. */
  kicker?: string;
  /** Facilitator discussion prompt, revealed in discuss mode. */
  discussPrompt?: string;
  /**
   * Wording for phones, when it differs from the projector's. Round 3 asks
   * "who stays behind?" on the big screen but "select three people" on the
   * phone — same question, stated the way each audience needs it.
   */
  participantPrompt?: string;
  options?: Option[];
  profiles?: Profile[];
  values?: ValueDef[];
  /** The single source of truth for how this question is answered. */
  selection: Selection;
  textPrefix?: string;
}

export interface Round {
  id: RoundId;
  index: number;
  title: string;
  subtitle: string;
  /** One-line description of what the round is exploring. */
  purpose: string;
  questions: Question[];
}

const abcd = ["A", "B", "C", "D"];

const single = (
  roundId: RoundId,
  id: string,
  short: string,
  prompt: string,
  labels: string[],
  discussPrompt?: string,
): Question => ({
  id,
  roundId,
  kind: "single",
  short,
  prompt,
  discussPrompt,
  selection: { mode: "single" },
  options: labels.map((label, i) => ({
    id: `${id}-${abcd[i].toLowerCase()}`,
    marker: abcd[i],
    label,
  })),
});

const split = (
  id: string,
  short: string,
  prompt: string,
  labels: string[],
  discussPrompt?: string,
): Question => ({
  id,
  roundId: "room-vs-online",
  kind: "split",
  short,
  prompt,
  discussPrompt,
  selection: { mode: "single" },
  options: labels.map((label, i) => ({
    id: `${id}-${abcd[i].toLowerCase()}`,
    marker: abcd[i],
    label,
  })),
});

/* ------------------------------------------------------------------ */
/* ROUND 1 — YOU DECIDE                                               */
/* ------------------------------------------------------------------ */

const roundYouDecide: Round = {
  id: "you-decide",
  index: 1,
  title: "You Decide",
  subtitle: "There are no wrong answers here.",
  purpose: "A quick warm-up. Five everyday situations, four honest reactions.",
  questions: [
    single(
      "you-decide",
      "r1q1",
      "Q1",
      "A colleague regularly challenges your ideas during meetings. What do you assume first?",
      [
        "They don't respect my expertise",
        "They're trying to improve the idea",
        "They just like disagreeing",
        "I shouldn't assume — I'd understand why first",
      ],
      "What does our first assumption say about how safe we feel being challenged?",
    ),
    single(
      "you-decide",
      "r1q2",
      "Q2",
      "Someone who normally performs well suddenly starts missing deadlines. What do you do?",
      [
        "Remind them that performance matters",
        "Ask what's changed and whether they need support",
        "Give some of their work to someone else",
        "Wait and see if things improve",
      ],
      "When someone slips, do we lead with the work or with the person?",
    ),
    single(
      "you-decide",
      "r1q3",
      "Q3",
      "Two colleagues strongly disagree about how something should be done. What should happen?",
      [
        "The more experienced person decides",
        "The manager decides",
        "Examine both ideas and choose what best serves the outcome",
        "Each person compromises halfway",
      ],
      "Who do we think should settle a disagreement — and why?",
    ),
    single(
      "you-decide",
      "r1q4",
      "Q4",
      "A colleague makes a mistake that affects something you've been working on together. What's your first response?",
      [
        "Fix it myself",
        "Tell them immediately what they did wrong",
        "Understand what happened and solve it together",
        "Tell the team lead",
      ],
      "What's our instinct when something goes wrong — repair, report, or resolve together?",
    ),
    single(
      "you-decide",
      "r1q5",
      "Q5",
      "You disagree with the direction most of the team supports. What do you do?",
      [
        "Go along with the majority",
        "State my concern and explain why",
        "Discuss it privately afterwards",
        "Keep quiet unless someone asks me",
      ],
      "How much of what we really think makes it into the room?",
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* ROUND 2 — ROOM VS ONLINE                                           */
/* ------------------------------------------------------------------ */

const roundRoomVsOnline: Round = {
  id: "room-vs-online",
  index: 2,
  title: "Room vs Online",
  subtitle: "Same team. Two vantage points.",
  purpose: "Compare how the room and the remote half of the team see the same call.",
  questions: [
    split(
      "r2q1",
      "Q1",
      "One place remains on an important project. Who gets it?",
      [
        "Highly experienced, exceptional performer, but difficult to work with",
        "Less experienced, dependable, and an exceptional team player",
      ],
      "What are we really trading away when we choose brilliance over ease?",
    ),
    split(
      "r2q2",
      "Q2",
      "You can promote only one person.",
      [
        "Your strongest individual performer",
        "The person who consistently makes everyone around them perform better",
      ],
      "Which of these two do we actually reward around here?",
    ),
    split(
      "r2q3",
      "Q3",
      "Your team has an urgent deadline.",
      [
        "Divide the work and let everyone focus on their own part",
        "Keep checking in and helping across responsibilities, even if it slows things initially",
      ],
      "Under pressure, do we default to speed or to each other?",
    ),
    split(
      "r2q4",
      "Q4",
      "You have a new team member with excellent ideas but little organizational experience.",
      ["Let them observe and learn first", "Give them a voice immediately"],
      "How long does someone have to be here before their idea counts?",
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* ROUND 3 — WHO WOULD YOU PICK?                                      */
/* ------------------------------------------------------------------ */

export const PROFILES: Profile[] = [
  {
    id: "nory",
    name: "Nory",
    title: "The Expert",
    traits: [
      "Brilliant technically",
      "Always delivers",
      "Rarely supports others",
      "Prefers working alone",
    ],
    hue: 222,
  },
  {
    id: "dove",
    name: "Dove",
    title: "The Team Player",
    traits: [
      "Reliable performer",
      "Shares knowledge freely",
      "Supports colleagues",
      "Not always the strongest technically",
    ],
    hue: 152,
  },
  {
    id: "nia",
    name: "Nia",
    title: "The Veteran",
    traits: [
      "Highly experienced",
      "Knows the organisation inside out",
      "Dependable",
      "Resistant to new ways of working",
    ],
    hue: 38,
  },
  {
    id: "ria",
    name: "Ria",
    title: "The Challenger",
    traits: [
      "New to the organisation",
      "Curious and energetic",
      "Constantly asks questions",
      "Brings fresh ideas",
      "Still learning the business",
    ],
    hue: 288,
  },
];

const roundWhoWouldYouPick: Round = {
  id: "who-would-you-pick",
  index: 3,
  title: "Who Would You Pick?",
  subtitle: "One critical project. Only three seats.",
  purpose: "Surface what we quietly optimise for when we can't take everyone.",
  questions: [
    {
      id: "r3q1",
      roundId: "who-would-you-pick",
      kind: "profile",
      short: "Q1",
      kicker: "You have ONE critical project.",
      // The projector asks the question that starts the conversation…
      prompt: "Who stays behind?",
      // …while the phone asks for the choice that is actually being made.
      participantPrompt: "Select 3 people for the project",
      discussPrompt: "Why did we leave this person behind?",
      profiles: PROFILES,
      selection: { mode: "multiple", min: 3, max: 3, store: "excluded" },
    },
  ],
};

/* ------------------------------------------------------------------ */
/* ROUND 4 — THE $10,000 DECISION                                     */
/* ------------------------------------------------------------------ */

export const INVESTMENTS: Option[] = [
  { id: "training", emoji: "🎓", label: "Training & Development" },
  { id: "teambuilding", emoji: "🤝", label: "Team Building" },
  { id: "technology", emoji: "💻", label: "Better Technology & Tools" },
  { id: "support", emoji: "👥", label: "Additional Team Support" },
  { id: "wellbeing", emoji: "🧠", label: "Wellbeing Initiatives" },
  { id: "recognition", emoji: "🏆", label: "Recognition & Rewards" },
];

const roundTenThousand: Round = {
  id: "ten-thousand",
  index: 4,
  title: "The $10,000 Decision",
  subtitle: "Unexpected money. Two choices only.",
  purpose: "Where a team puts money is a fair proxy for what it values.",
  questions: [
    {
      id: "r4q1",
      roundId: "ten-thousand",
      kind: "pick-two",
      short: "Q1",
      kicker: "Your team has received an unexpected $10,000.",
      prompt: "You can invest in ONLY TWO things.",
      discussPrompt: "What does where we put our money say about what we value?",
      options: INVESTMENTS,
      selection: { mode: "multiple", min: 2, max: 2 },
    },
  ],
};

/* ------------------------------------------------------------------ */
/* ROUND 5 — BUILD OUR PERFECT TEAM                                   */
/* ------------------------------------------------------------------ */

export const TEAM_VALUES: ValueDef[] = [
  { id: "trust", label: "Trust", hue: 222 },
  { id: "communication", label: "Communication", hue: 252 },
  { id: "respect", label: "Respect", hue: 282 },
  { id: "accountability", label: "Accountability", hue: 328 },
  { id: "competence", label: "Competence", hue: 18 },
  { id: "leadership", label: "Leadership", hue: 40 },
  { id: "innovation", label: "Innovation", hue: 168 },
  { id: "fun", label: "Fun", hue: 192 },
];

const roundTeamDna: Round = {
  id: "team-dna",
  index: 5,
  title: "Build Our Perfect Team",
  subtitle: "One hundred points. Eight things that matter.",
  purpose: "A weighted portrait of what the team believes a great team is made of.",
  questions: [
    {
      id: "r5q1",
      roundId: "team-dna",
      kind: "points",
      short: "Q1",
      kicker: "You have 100 points.",
      prompt: "Build our perfect team.",
      discussPrompt: "Is this who we are today — or who we want to become?",
      values: TEAM_VALUES,
      selection: { mode: "points", total: 100 },
    },
  ],
};

/* ------------------------------------------------------------------ */
/* FINAL ROUND — OUR VOICE                                            */
/* ------------------------------------------------------------------ */

export const STRONGER_OPTIONS: Option[] = [
  { id: "communication", emoji: "💬", label: "Better communication" },
  { id: "collaboration", emoji: "🤝", label: "More collaboration" },
  { id: "trust", emoji: "❤️", label: "More trust" },
  { id: "listening", emoji: "👂", label: "Better listening" },
  { id: "asking-help", emoji: "🙋", label: "More willingness to ask for help" },
  { id: "info-sharing", emoji: "🔄", label: "Better information sharing" },
  { id: "recognition", emoji: "👏", label: "More recognition" },
  { id: "accountability", emoji: "🎯", label: "Clearer accountability" },
  { id: "learning", emoji: "🌱", label: "More opportunities to learn" },
  { id: "connection", emoji: "😊", label: "More connection & fun" },
  { id: "something-else", emoji: "✍️", label: "Something else" },
];

const roundOurVoice: Round = {
  id: "our-voice",
  index: 6,
  title: "Our Voice",
  subtitle: "In our own words.",
  purpose: "Close the loop: one shared priority, then the team's own sentences.",
  questions: [
    {
      id: "r6q1",
      roundId: "our-voice",
      kind: "single",
      short: "Q1",
      prompt: "What ONE thing would make our team stronger?",
      discussPrompt: "Did we pick the thing we need — or the thing that's easiest to say?",
      options: STRONGER_OPTIONS,
      selection: { mode: "single" },
    },
    {
      id: "r6q2",
      roundId: "our-voice",
      kind: "open-text",
      short: "Q2",
      kicker: "Complete this sentence:",
      prompt: "Our team would be stronger if we…",
      discussPrompt: "Which of these sentences do we want to still be true next quarter?",
      textPrefix: "Our team would be stronger if we…",
      selection: { mode: "text", maxWords: 6 },
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Closing                                                             */
/* ------------------------------------------------------------------ */

export type ClosingScreenId = "values" | "thinking" | "voice" | "final";

export interface ClosingScreen {
  id: ClosingScreenId;
  title: string;
  kicker?: string;
}

export const CLOSING_SCREENS: ClosingScreen[] = [
  { id: "values", kicker: "Screen 1", title: "What we value" },
  { id: "thinking", kicker: "Screen 2", title: "How we think" },
  { id: "voice", kicker: "Screen 3", title: "Our voice" },
  { id: "final", title: "One team." },
];

/* ------------------------------------------------------------------ */
/* Assembled plan + step index                                        */
/* ------------------------------------------------------------------ */

export const ROUNDS: Round[] = [
  roundYouDecide,
  roundRoomVsOnline,
  roundWhoWouldYouPick,
  roundTenThousand,
  roundTeamDna,
  roundOurVoice,
];

export const QUESTIONS: Question[] = ROUNDS.flatMap((r) => r.questions);

export type Step =
  | { type: "question"; index: number; questionId: string; roundId: RoundId }
  | { type: "closing"; index: number; screen: ClosingScreenId };

export const STEPS: Step[] = [
  ...QUESTIONS.map((q, i) => ({
    type: "question" as const,
    index: i,
    questionId: q.id,
    roundId: q.roundId,
  })),
  ...CLOSING_SCREENS.map((s, i) => ({
    type: "closing" as const,
    index: QUESTIONS.length + i,
    screen: s.id,
  })),
];

export const STEP_COUNT = STEPS.length;

const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));
const roundById = new Map(ROUNDS.map((r) => [r.id, r]));

export function getQuestion(id: string | null | undefined): Question | null {
  if (!id) return null;
  return questionById.get(id) ?? null;
}

export function getRound(id: RoundId | null | undefined): Round | null {
  if (!id) return null;
  return roundById.get(id) ?? null;
}

export function getStep(index: number): Step | null {
  if (index < 0 || index >= STEPS.length) return null;
  return STEPS[index];
}

export function stepQuestion(index: number): Question | null {
  const step = getStep(index);
  return step?.type === "question" ? getQuestion(step.questionId) : null;
}

/** Index of the first step of a round — used by "jump to round". */
export function firstStepOfRound(roundId: RoundId): number {
  const i = STEPS.findIndex((s) => s.type === "question" && s.roundId === roundId);
  return i === -1 ? 0 : i;
}

export function firstClosingStep(): number {
  const i = STEPS.findIndex((s) => s.type === "closing");
  return i === -1 ? STEPS.length - 1 : i;
}

/** Human label for a step, used in the facilitator dashboard. */
export function stepLabel(index: number): string {
  const step = getStep(index);
  if (!step) return "—";
  if (step.type === "closing") {
    const screen = CLOSING_SCREENS.find((s) => s.id === step.screen);
    return `Closing · ${screen?.title ?? step.screen}`;
  }
  const q = getQuestion(step.questionId);
  const r = getRound(step.roundId);
  return `Round ${r?.index ?? "?"} · ${q?.short ?? ""}`;
}

/** True when a question records the inverse of what the participant picked. */
export function storesExcluded(q: Question): boolean {
  return q.selection.mode === "multiple" && q.selection.store === "excluded";
}

/** How many options a participant must pick. Null for non-option questions. */
export function selectionBounds(q: Question): { min: number; max: number } | null {
  if (q.selection.mode === "single") return { min: 1, max: 1 };
  if (q.selection.mode === "multiple") return { min: q.selection.min, max: q.selection.max };
  return null;
}

/** Options for a question, whatever shape they take. */
export function optionIdsFor(q: Question): string[] {
  if (q.options) return q.options.map((o) => o.id);
  if (q.profiles) return q.profiles.map((p) => p.id);
  if (q.values) return q.values.map((v) => v.id);
  return [];
}
