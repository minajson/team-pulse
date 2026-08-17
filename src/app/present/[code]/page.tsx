import { notFound } from "next/navigation";
import { PresentationApp } from "@/components/present/PresentationApp";
import { normalizeCode } from "@/lib/session/service";

export const metadata = { title: "Team Pulse — Presentation" };
export const dynamic = "force-dynamic";

export default async function PresentPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const query = await searchParams;
  const clean = normalizeCode(code);
  if (clean.length !== 4) notFound();

  // `?preview=1` renders the same stage inside the facilitator's dashboard,
  // minus the fullscreen affordances and sound.
  const preview = query.preview === "1";
  return <PresentationApp code={clean} preview={preview} />;
}
