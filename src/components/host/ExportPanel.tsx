"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { CARD_H, CARD_W, DnaCard, WallCard } from "./ExportCards";
import { Button } from "@/components/ui/Button";
import { buildSummaryPdf } from "@/lib/export/summary-pdf";
import type { DeckExport } from "@/lib/export/types";
import type { SessionSummary } from "@/lib/types";

/**
 * Everything the facilitator takes away.
 *
 * All four formats are anonymous by construction — the API strips respondent
 * keys before the data ever reaches this component, so there is nothing here
 * that could accidentally export an identity.
 */
export function ExportPanel({
  code,
  token,
  summary,
}: {
  code: string;
  token: string;
  summary: SessionSummary | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dnaRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);

  const stamp = new Date().toISOString().slice(0, 10);

  const fetchDeck = async (): Promise<DeckExport> => {
    const res = await fetch(`/api/sessions/${code}/export?format=json`, {
      headers: { "x-facilitator-token": token },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Could not build the export.");
    return (await res.json()) as DeckExport;
  };

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoke on the next tick — Safari needs the URL alive for the click.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const downloadFile = async (format: "csv" | "json", filename: string) => {
    const res = await fetch(`/api/sessions/${code}/export?format=${format}`, {
      headers: { "x-facilitator-token": token },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Export failed.");
    download(await res.blob(), filename);
  };

  const snapshot = async (node: HTMLDivElement | null, filename: string) => {
    if (!node) throw new Error("Nothing to export yet.");
    const dataUrl = await toPng(node, {
      width: CARD_W,
      height: CARD_H,
      pixelRatio: 2,
      backgroundColor: "#fbfaf7",
      cacheBust: true,
    });
    const blob = await (await fetch(dataUrl)).blob();
    download(blob, filename);
  };

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-lift ring-1 ring-ink/10 ring-inset">
      <h2 className="text-sm font-bold text-ink">Take it away</h2>
      <p className="mt-1 text-[0.76rem] leading-snug text-ink-3">
        Exports are anonymous. Responses carry no respondent key and row order is shuffled, so
        answers cannot be linked back to a person.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            run("pdf", async () => {
              const deck = await fetchDeck();
              buildSummaryPdf(deck).save(`team-pulse-${code}-${stamp}.pdf`);
            })
          }
        >
          {busy === "pdf" ? "Building…" : "Summary PDF"}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={() => run("csv", () => downloadFile("csv", `team-pulse-${code}-${stamp}.csv`))}
        >
          {busy === "csv" ? "Building…" : "Responses CSV"}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null || !summary}
          onClick={() => run("dna", () => snapshot(dnaRef.current, `team-pulse-${code}-dna.png`))}
        >
          {busy === "dna" ? "Rendering…" : "Team DNA PNG"}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null || !summary}
          onClick={() => run("wall", () => snapshot(wallRef.current, `team-pulse-${code}-wall.png`))}
        >
          {busy === "wall" ? "Rendering…" : "Wall PNG"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="col-span-2"
          disabled={busy !== null}
          onClick={() => run("json", () => downloadFile("json", `team-pulse-${code}-${stamp}.json`))}
        >
          {busy === "json" ? "Building…" : "Slide deck data (JSON)"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[0.78rem] font-semibold text-alert-deep">
          {error}
        </p>
      )}

      {/*
        Rendered off-screen rather than hidden with `display: none` — a node
        with no layout box cannot be rasterised.
      */}
      {summary && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: -100000,
            width: CARD_W,
            height: CARD_H * 2 + 40,
            pointerEvents: "none",
            opacity: 0,
          }}
        >
          <DnaCard ref={dnaRef} summary={summary} />
          <WallCard ref={wallRef} summary={summary} />
        </div>
      )}
    </section>
  );
}
