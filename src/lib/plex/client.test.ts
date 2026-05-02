import { describe, expect, it } from "vitest";

import { buildPlexMusicTranscodePath } from "./client";

describe("Plex music transcode paths", () => {
  it("builds a browser-friendly MP3 transcode URL", () => {
    const path = buildPlexMusicTranscodePath({
      metadataKey: "/library/metadata/151671",
      transcodeSessionId: "plexster-session-track"
    });
    const url = new URL(path, "http://plex.example");

    expect(url.pathname).toBe("/music/:/transcode/universal/start.mp3");
    expect(url.searchParams.get("path")).toBe("/library/metadata/151671");
    expect(url.searchParams.get("protocol")).toBe("http");
    expect(url.searchParams.get("directPlay")).toBe("0");
    expect(url.searchParams.get("directStream")).toBe("0");
    expect(url.searchParams.get("directStreamAudio")).toBe("0");
    expect(url.searchParams.get("mediaIndex")).toBe("0");
    expect(url.searchParams.get("partIndex")).toBe("0");
    expect(url.searchParams.get("musicBitrate")).toBe("320");
    expect(url.searchParams.get("session")).toBe("plexster-session-track");
  });
});
