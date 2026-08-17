import { notFound } from "next/navigation";
import { ParticipantApp } from "@/components/participant/ParticipantApp";
import { normalizeCode } from "@/lib/session/service";

export const metadata = { title: "Team Pulse" };
export const dynamic = "force-dynamic";

export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = normalizeCode(code);
  if (clean.length !== 4) notFound();
  return <ParticipantApp code={clean} />;
}
