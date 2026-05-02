import { getPlaylists, getResource } from "@/lib/plex/client";
import { jsonError } from "@/lib/server/http";
import { requirePlexSession } from "@/lib/server/session";

export async function GET(request: Request) {
  try {
    const serverId = new URL(request.url).searchParams.get("serverId");

    if (!serverId) {
      return Response.json({ error: "Missing serverId." }, { status: 400 });
    }

    const session = await requirePlexSession();
    const resource = await getResource(session.plexToken!, session.clientIdentifier, serverId);
    const playlists = await getPlaylists(resource, session.clientIdentifier);

    return Response.json({ playlists });
  } catch (error) {
    return jsonError(error);
  }
}
