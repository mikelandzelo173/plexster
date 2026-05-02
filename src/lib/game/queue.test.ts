import { describe, expect, it } from "vitest";

import { advanceTrack, createGameSession, getCurrentTrack, toPublicTrack } from "./queue";
import type { GameTrack } from "./types";

const tracks: GameTrack[] = [
  { id: "1", key: "/library/metadata/1", streamKey: "/library/parts/1", title: "One" },
  { id: "2", key: "/library/metadata/2", streamKey: "/library/parts/2", title: "Two" },
  { id: "3", key: "/library/metadata/3", streamKey: "/library/parts/3", title: "Three" }
];

describe("game queue", () => {
  it("creates a session with the first queued track marked as played", () => {
    const session = createGameSession({
      id: "session",
      serverId: "server",
      playlistKey: "playlist",
      playlistTitle: "Playlist",
      tracks,
      random: () => 0
    });

    expect(getCurrentTrack(session)?.id).toBe("2");
    expect(session.playedIds).toEqual(new Set(["2"]));
  });

  it("advances through each queued track without repeats", () => {
    const session = createGameSession({
      id: "session",
      serverId: "server",
      playlistKey: "playlist",
      playlistTitle: "Playlist",
      tracks,
      random: () => 0.99
    });

    const visited = [getCurrentTrack(session)?.id];
    visited.push(advanceTrack(session)?.id);
    visited.push(advanceTrack(session)?.id);

    expect(new Set(visited).size).toBe(3);
    expect(session.playedIds.size).toBe(3);
    expect(advanceTrack(session)).toBeUndefined();
  });

  it("uses track-specific stream URLs", () => {
    expect(toPublicTrack(tracks[0], false).streamUrl).toBe("/api/game/stream?trackId=1");
    expect(toPublicTrack(tracks[1], false).streamUrl).toBe("/api/game/stream?trackId=2");
  });
});
