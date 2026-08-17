"use client";

import { jsPDF } from "jspdf";
import type { DeckExport } from "./types";

const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait, points
const M = 48; // margin

type Rgb = readonly [number, number, number];

const INK: Rgb = [12, 13, 18];
const INK_2: Rgb = [74, 77, 87];
const INK_3: Rgb = [131, 135, 143];
const COBALT: Rgb = [30, 62, 240];
const AMBER: Rgb = [242, 166, 26];
const RULE: Rgb = [222, 222, 228];

/**
 * Session summary as a PDF the facilitator can send round afterwards.
 *
 * Built with jsPDF's primitives rather than by screenshotting the projector:
 * a document that will be read on a laptop wants document typography and
 * selectable text, not a picture of a dark slide.
 */
export function buildSummaryPdf(deck: DeckExport): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  let y = M;

  const setColor = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2]);

  const room = (needed: number) => {
    if (y + needed > PAGE.h - M) {
      doc.addPage();
      y = M;
    }
  };

  const heading = (text: string, size = 20) => {
    room(size + 24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    setColor(INK);
    doc.text(text, M, y);
    y += size * 0.6 + 14;
  };

  const label = (text: string) => {
    room(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(INK_3);
    doc.text(text.toUpperCase(), M, y);
    y += 14;
  };

  const body = (text: string, size = 10, color = INK_2) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    setColor(color);
    const lines = doc.splitTextToSize(text, PAGE.w - M * 2) as string[];
    room(lines.length * (size + 3));
    doc.text(lines, M, y);
    y += lines.length * (size + 3) + 6;
  };

  const rule = () => {
    room(16);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.7);
    doc.line(M, y, PAGE.w - M, y);
    y += 16;
  };

  /** A labelled bar. Percentages are drawn, not described, so scanning works. */
  const bar = (text: string, pct: number, tint: Rgb) => {
    room(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setColor(INK);
    const labelWidth = PAGE.w - M * 2 - 46;
    const lines = doc.splitTextToSize(text, labelWidth) as string[];
    doc.text(lines[0] ?? text, M, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setColor(tint);
    doc.text(`${Math.round(pct)}%`, PAGE.w - M, y, { align: "right" });

    y += 6;
    setFill([238, 238, 243]);
    doc.roundedRect(M, y, PAGE.w - M * 2, 6, 3, 3, "F");
    const width = Math.max(0, Math.min(1, pct / 100)) * (PAGE.w - M * 2);
    if (width > 0) {
      setFill(tint);
      doc.roundedRect(M, y, width, 6, 3, 3, "F");
    }
    y += 18;
  };

  /* ---------------- Cover ---------------- */

  setFill(INK);
  doc.rect(0, 0, PAGE.w, 190, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(247, 247, 250);
  doc.text("TEAM PULSE", M, 88);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(169, 173, 186);
  doc.text("What does our team really think?", M, 112);

  doc.setFontSize(9);
  const started = deck.session.startedAt ? new Date(deck.session.startedAt) : null;
  doc.text(
    [
      `Session ${deck.session.code}`,
      started ? started.toLocaleDateString(undefined, { dateStyle: "long" }) : "",
      `${deck.participants.total} participants — ${deck.participants.room} in the room, ${deck.participants.online} online`,
    ]
      .filter(Boolean)
      .join("   ·   "),
    M,
    150,
  );

  y = 232;

  /* ---------------- What we value ---------------- */

  heading("What we value");
  label("Where we put the $10,000");
  if (deck.summary.values.investments.length === 0) {
    body("No responses recorded for this round.");
  } else {
    for (const line of deck.summary.values.investments.slice(0, 6)) {
      bar(line.label, line.pct, AMBER);
    }
  }

  y += 6;
  label("What we built our team from");
  if (deck.summary.values.dna.length === 0) {
    body("No responses recorded for this round.");
  } else {
    for (const line of deck.summary.values.dna) {
      bar(line.label, line.pct, COBALT);
    }
  }

  rule();

  /* ---------------- How we think ---------------- */

  heading("How we think");
  const insights = [
    { label: "Where we agreed most", value: deck.summary.thinking.strongestAgreement },
    { label: "Room vs Online", value: deck.summary.thinking.biggestDivide },
    { label: "A decision we made", value: deck.summary.thinking.decisionPattern },
  ];
  let printedInsight = false;
  for (const insight of insights) {
    if (!insight.value) continue;
    printedInsight = true;
    label(insight.label);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setColor(INK);
    const headLines = doc.splitTextToSize(
      `${insight.value.stat} — ${insight.value.label}`,
      PAGE.w - M * 2,
    ) as string[];
    room(headLines.length * 16 + 8);
    doc.text(headLines, M, y);
    y += headLines.length * 16 + 2;
    body(insight.value.detail, 10);
    y += 4;
  }
  if (!printedInsight) body("Not enough responses to describe a pattern.");

  rule();

  /* ---------------- Our voice ---------------- */

  heading("Our voice");
  body("Our team would be stronger if we…", 12, INK);
  y += 2;

  if (deck.summary.voice.topStatements.length === 0) {
    body("No statements were submitted.");
  } else {
    doc.setFontSize(12);
    for (const [index, statement] of deck.summary.voice.topStatements.entries()) {
      room(24);
      doc.setFont("helvetica", "bold");
      setColor(INK_3);
      doc.setFontSize(9);
      doc.text(String(index + 1).padStart(2, "0"), M, y);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      setColor(INK);
      doc.text(statement.text, M + 22, y);

      if (statement.hearts > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        setColor(AMBER);
        doc.text(`${statement.hearts} hearts`, PAGE.w - M, y, { align: "right" });
      }
      y += 20;
    }
  }

  /* ---------------- Round detail ---------------- */

  doc.addPage();
  y = M;
  heading("Every round, in full", 18);
  body(
    "Percentages are of the people who answered that question. Nothing below identifies any participant.",
    9,
    INK_3,
  );
  y += 4;

  let lastRound: number | undefined;
  for (const round of deck.rounds) {
    if (round.totalResponses === 0) continue;

    if (round.round !== lastRound) {
      lastRound = round.round;
      y += 8;
      heading(`${round.round}. ${round.roundTitle ?? ""}`, 13);
    }

    room(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setColor(INK);
    const promptLines = doc.splitTextToSize(round.prompt, PAGE.w - M * 2) as string[];
    doc.text(promptLines, M, y);
    y += promptLines.length * 13 + 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(INK_3);
    doc.text(
      `${round.totalResponses} responses · 🏢 ${round.roomResponses} · 💻 ${round.onlineResponses}`,
      M,
      y,
    );
    y += 12;

    if (round.kind === "points") {
      for (const point of [...round.points].sort((a, b) => b.pct - a.pct)) {
        bar(point.label, point.pct, COBALT);
      }
    } else if (round.kind === "split") {
      for (const option of round.options) {
        bar(`${option.label}  —  room`, option.roomPct, COBALT);
        bar(`${option.label}  —  online`, option.onlinePct, AMBER);
      }
    } else {
      for (const option of [...round.options].sort((a, b) => b.pct - a.pct)) {
        bar(option.label, option.pct, COBALT);
      }
    }
    y += 6;
  }

  /* ---------------- Footer on every page ---------------- */

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(INK_3);
    doc.text(
      `Team Pulse · session ${deck.session.code} · anonymous — no participant is identified in this document`,
      M,
      PAGE.h - 24,
    );
    doc.text(`${page} / ${pages}`, PAGE.w - M, PAGE.h - 24, { align: "right" });
  }

  return doc;
}
