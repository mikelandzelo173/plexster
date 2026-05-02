import type { GameSession, GameTrack, PublicTrack } from "./types";

export const MAX_GAME_TRACKS = 1000;

export function shuffleTracks<T>(tracks: T[], random = Math.random): T[] {
  const shuffled = [...tracks];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function createGameSession(input: {
  id: string;
  serverId: string;
  playlistKey: string;
  playlistTitle: string;
  tracks: GameTrack[];
  random?: () => number;
}): GameSession {
  if (input.tracks.length > MAX_GAME_TRACKS) {
    throw new Error(`Playlists are limited to ${MAX_GAME_TRACKS} playable tracks.`);
  }

  const queue = shuffleTracks(input.tracks, input.random);

  return {
    id: input.id,
    serverId: input.serverId,
    playlistKey: input.playlistKey,
    playlistTitle: input.playlistTitle,
    queue,
    playedIds: new Set(queue.length > 0 ? [queue[0].id] : []),
    currentIndex: 0,
    revealed: false,
    createdAt: Date.now()
  };
}

export function getCurrentTrack(session: GameSession): GameTrack | undefined {
  return session.queue[session.currentIndex];
}

export function advanceTrack(session: GameSession): GameTrack | undefined {
  if (session.currentIndex >= session.queue.length - 1) {
    return undefined;
  }

  session.currentIndex += 1;
  session.revealed = false;

  const track = getCurrentTrack(session);
  if (track) {
    session.playedIds.add(track.id);
  }

  return track;
}

export function toPublicTrack(
  track: GameTrack,
  revealed: boolean,
  streamUrl = `/api/game/stream?trackId=${encodeURIComponent(track.id)}`
): PublicTrack {
  return {
    id: track.id,
    streamUrl,
    revealed,
    solution: revealed
      ? {
          title: track.title,
          artist: track.artist,
          album: track.album,
          year: track.year,
          duration: track.duration,
          thumb: track.thumb,
          artworkUrl: track.thumb ? `/api/game/artwork?trackId=${encodeURIComponent(track.id)}` : undefined
        }
      : undefined
  };
}
