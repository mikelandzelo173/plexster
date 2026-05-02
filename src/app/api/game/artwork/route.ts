import { getCurrentTrack } from "@/lib/game/queue";
import { fetchPlexStream, getResource, PLEX_ARTWORK_TIMEOUT_MS } from "@/lib/plex/client";
import { jsonError } from "@/lib/server/http";
import { requirePlexSession } from "@/lib/server/session";

export async function GET(request: Request) {
  try {
    const session = await requirePlexSession();

    if (!session.game) {
      return Response.json({ error: "No active game session." }, { status: 404 });
    }

    const current = getCurrentTrack(session.game);
    const requestedTrackId = new URL(request.url).searchParams.get("trackId");

    if (!current?.thumb) {
      return Response.json({ error: "The current track has no artwork." }, { status: 404 });
    }

    if (requestedTrackId && requestedTrackId !== current.id) {
      return Response.json({ error: "Requested artwork is no longer current." }, { status: 409 });
    }

    const resource = await getResource(session.plexToken!, session.clientIdentifier, session.game.serverId);
    const plexResponse = await fetchPlexStream({
      resource,
      clientIdentifier: session.clientIdentifier,
      streamKey: current.thumb,
      timeoutMs: PLEX_ARTWORK_TIMEOUT_MS
    });

    const headers = new Headers();
    for (const header of ["content-type", "content-length"]) {
      const value = plexResponse.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    }

    headers.set("Cache-Control", "no-store");

    return new Response(plexResponse.body, {
      status: plexResponse.status,
      statusText: plexResponse.statusText,
      headers
    });
  } catch (error) {
    return jsonError(error);
  }
}
