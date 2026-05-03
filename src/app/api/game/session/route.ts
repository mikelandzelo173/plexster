import { randomUUID } from "node:crypto";

import { createGameSession, getCurrentTrack, toPublicTrack } from "@/lib/game/queue";
import { getPlaylistTracks, getResource } from "@/lib/plex/client";
import { jsonError } from "@/lib/server/http";
import { requirePlexSession, saveSession } from "@/lib/server/session";

type StartGameBody = {
  serverId?: string;
  playlistKey?: string;
  playlistTitle?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StartGameBody;

    if (!body.serverId || !body.playlistKey || !body.playlistTitle) {
      return Response.json({ error: "Missing game setup selection." }, { status: 400 });
    }

    const session = await requirePlexSession();
    const resource = await getResource(session.plexToken!, session.clientIdentifier, body.serverId);
    const tracks = await getPlaylistTracks({
      resource,
      clientIdentifier: session.clientIdentifier,
      playlistKey: body.playlistKey
    });

    if (tracks.length === 0) {
      return Response.json({ error: "The selected playlist has no playable audio tracks." }, { status: 400 });
    }

    session.game = createGameSession({
      id: randomUUID(),
      serverId: body.serverId,
      playlistKey: body.playlistKey,
      playlistTitle: body.playlistTitle,
      tracks
    });
    await saveSession(session);

    const current = getCurrentTrack(session.game);

    return Response.json({
      playlistTitle: session.game.playlistTitle,
      remaining: session.game.queue.length - session.game.playedIds.size,
      total: session.game.queue.length,
      current: current ? toPublicTrack(current, session.game.revealed) : undefined
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  try {
    const session = await requirePlexSession();
    session.game = undefined;
    await saveSession(session);

    return Response.json({ stopped: true });
  } catch (error) {
    return jsonError(error);
  }
}
