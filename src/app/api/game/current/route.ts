import { getCurrentTrack, toPublicTrack } from "@/lib/game/queue";
import { jsonError } from "@/lib/server/http";
import { requirePlexSession } from "@/lib/server/session";

export async function GET() {
  try {
    const session = await requirePlexSession();

    if (!session.game) {
      return Response.json({ error: "No active game session." }, { status: 404 });
    }

    const current = getCurrentTrack(session.game);

    if (!current) {
      return Response.json({ error: "The game session has no current track." }, { status: 404 });
    }

    return Response.json({
      playlistTitle: session.game.playlistTitle,
      remaining: session.game.queue.length - session.game.playedIds.size,
      total: session.game.queue.length,
      current: toPublicTrack(current, session.game.revealed)
    });
  } catch (error) {
    return jsonError(error);
  }
}
