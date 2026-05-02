import { advanceTrack, toPublicTrack } from "@/lib/game/queue";
import { jsonError } from "@/lib/server/http";
import { requirePlexSession, saveSession } from "@/lib/server/session";

export async function POST() {
  try {
    const session = await requirePlexSession();

    if (!session.game) {
      return Response.json({ error: "No active game session." }, { status: 404 });
    }

    const nextTrack = advanceTrack(session.game);

    if (!nextTrack) {
      await saveSession(session);

      return Response.json({
        done: true,
        playlistTitle: session.game.playlistTitle,
        remaining: 0,
        total: session.game.queue.length
      });
    }

    await saveSession(session);

    return Response.json({
      done: false,
      playlistTitle: session.game.playlistTitle,
      remaining: session.game.queue.length - session.game.playedIds.size,
      total: session.game.queue.length,
      current: toPublicTrack(nextTrack, session.game.revealed)
    });
  } catch (error) {
    return jsonError(error);
  }
}
