import { handleError, json, readJson } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/text";
import { createSession } from "@/lib/session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limit = rateLimit(clientKey(req, "create"), 10, 60_000);
    if (!limit.ok) return json({ error: "Slow down a moment." }, { status: 429 });

    const body = await readJson<{ title?: string }>(req).catch(() => ({ title: undefined }));
    const title = sanitizeText(body.title).slice(0, 80) || "Team Pulse";
    const session = await createSession(title);

    return json(
      {
        code: session.code,
        facilitatorToken: session.facilitatorToken,
        title: session.title,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
