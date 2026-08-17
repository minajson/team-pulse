import { handleError, json, participantAuth, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { SessionError, toggleReaction } from "@/lib/session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { participantId, secret } = participantAuth(req);
    if (!participantId || !secret) throw new SessionError("Rejoin to react.", 401);

    const limit = rateLimit(`react:${participantId}`, 60, 60_000);
    if (!limit.ok) return json({ error: "Easy on the hearts." }, { status: 429 });

    const { code } = await ctx.params;
    const body = await readJson<{ responseId?: string }>(req);
    if (!body.responseId) throw new SessionError("Missing response.", 400);

    const state = await toggleReaction(code, participantId, secret, body.responseId);
    return json({ state });
  } catch (error) {
    return handleError(error);
  }
}
