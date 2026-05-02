import { getCurrentTrack } from "@/lib/game/queue";
import { fetchPlexMusicTranscode, getResource } from "@/lib/plex/client";
import { jsonError } from "@/lib/server/http";
import { requirePlexSession } from "@/lib/server/session";

function transcodeSessionId(gameId: string, trackId: string): string {
  return `plexster-${gameId}-${trackId}`.replace(/[^\dA-Za-z_-]/g, "-").slice(0, 80);
}

export async function GET(request: Request) {
  try {
    const session = await requirePlexSession();

    if (!session.game) {
      return Response.json({ error: "No active game session." }, { status: 404 });
    }

    const current = getCurrentTrack(session.game);
    const requestedTrackId = new URL(request.url).searchParams.get("trackId");

    if (!current) {
      return Response.json({ error: "The game session has no current track." }, { status: 404 });
    }

    if (requestedTrackId && requestedTrackId !== current.id) {
      return Response.json({ error: "Requested stream is no longer current." }, { status: 409 });
    }

    const resource = await getResource(session.plexToken!, session.clientIdentifier, session.game.serverId);
    const plexResponse = await fetchPlexMusicTranscode({
      resource,
      clientIdentifier: session.clientIdentifier,
      metadataKey: current.key,
      transcodeSessionId: transcodeSessionId(session.game.id, current.id)
    });

    const headers = new Headers();
    for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = plexResponse.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    }

    headers.set("Cache-Control", "no-store");
    if (!headers.has("content-type")) {
      headers.set("content-type", "audio/mpeg");
    }

    return new Response(plexResponse.body, {
      status: plexResponse.status,
      statusText: plexResponse.statusText,
      headers
    });
  } catch (error) {
    return jsonError(error);
  }
}
