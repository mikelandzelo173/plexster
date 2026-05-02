import { getResources } from "@/lib/plex/client";
import { jsonError } from "@/lib/server/http";
import { requirePlexSession } from "@/lib/server/session";

export async function GET() {
  try {
    const session = await requirePlexSession();
    const resources = await getResources(session.plexToken!, session.clientIdentifier);

    return Response.json({ resources });
  } catch (error) {
    return jsonError(error);
  }
}
