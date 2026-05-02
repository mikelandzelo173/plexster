import { XMLParser } from "fast-xml-parser";

import type { GameTrack } from "@/lib/game/types";
import type { PlexLibrary, PlexPlaylist, PlexResource } from "./types";

const PLEX_TV_URL = "https://plex.tv";
const PRODUCT = "Plexster";
const VERSION = "0.1.0";
const PLEX_METADATA_TIMEOUT_MS = 15_000;
export const PLEX_ARTWORK_TIMEOUT_MS = 30_000;
export const PLEX_STREAM_TIMEOUT_MS = 30 * 60_000;
const DEFAULT_MUSIC_TRANSCODE_BITRATE_KBPS = 320;
const RESOURCE_CACHE_TTL_MS = 60_000;
const MAX_RESOURCE_CACHE_ENTRIES = 100;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true
});

type XmlRecord = Record<string, unknown>;
type CachedResources = {
  expiresAt: number;
  resources: PlexResource[];
};

const resourceCache = new Map<string, CachedResources>();

export class PlexRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string
  ) {
    super(message);
    this.name = "PlexRequestError";
  }
}

function pruneResourceCache(now = Date.now()): void {
  for (const [cacheKey, cached] of resourceCache) {
    if (cached.expiresAt <= now) {
      resourceCache.delete(cacheKey);
    }
  }

  if (resourceCache.size <= MAX_RESOURCE_CACHE_ENTRIES) {
    return;
  }

  const oldestEntries = [...resourceCache.entries()].sort(([, left], [, right]) => left.expiresAt - right.expiresAt);
  const entriesToRemove = resourceCache.size - MAX_RESOURCE_CACHE_ENTRIES;

  for (const [cacheKey] of oldestEntries.slice(0, entriesToRemove)) {
    resourceCache.delete(cacheKey);
  }
}

export function plexHeaders(clientIdentifier: string, token?: string): Record<string, string> {
  return {
    "X-Plex-Product": PRODUCT,
    "X-Plex-Version": VERSION,
    "X-Plex-Client-Identifier": clientIdentifier,
    ...(token ? { "X-Plex-Token": token } : {})
  };
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, codePoint: string) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([\da-f]+);/gi, (_, codePoint: string) => String.fromCodePoint(parseInt(codePoint, 16)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function text(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number" ? decodeHtmlEntities(String(value)) : undefined;
}

function bool(value: unknown): boolean {
  return value === true || value === "1" || value === 1;
}

function withTimeout(init: RequestInit | undefined, timeoutMs: number): RequestInit {
  return {
    ...init,
    signal: AbortSignal.timeout(timeoutMs)
  };
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = PLEX_METADATA_TIMEOUT_MS): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  const response = await fetch(url, withTimeout({ ...init, headers }, timeoutMs));

  if (!response.ok) {
    throw new PlexRequestError(`Plex request failed with ${response.status}.`, response.status, response.statusText);
  }

  return response.json() as Promise<T>;
}

async function fetchXml(url: string, init?: RequestInit, timeoutMs = PLEX_METADATA_TIMEOUT_MS): Promise<XmlRecord> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/xml");
  const response = await fetch(url, withTimeout({ ...init, headers }, timeoutMs));

  if (!response.ok) {
    throw new PlexRequestError(`Plex request failed with ${response.status}.`, response.status, response.statusText);
  }

  return parser.parse(await response.text()) as XmlRecord;
}

function getOrderedConnections(resource: PlexResource): string[] {
  const score = (uri: string, local: boolean, relay: boolean) => {
    const isHttp = uri.startsWith("http://");
    const isHttps = uri.startsWith("https://");

    if (local && !relay && isHttp) {
      return 0;
    }

    if (local && !relay && isHttps) {
      return 1;
    }

    if (!relay && isHttps) {
      return 2;
    }

    if (!relay && isHttp) {
      return 3;
    }

    return 4;
  };

  return resource.connections
    .filter((connection) => connection.uri)
    .sort((left, right) => score(left.uri, left.local, left.relay) - score(right.uri, right.local, right.relay))
    .map((connection) => connection.uri.replace(/\/$/, ""));
}

async function fetchServerXml(
  resource: PlexResource,
  path: string,
  clientIdentifier: string
): Promise<XmlRecord> {
  const errors: string[] = [];

  for (const baseUrl of getOrderedConnections(resource)) {
    try {
      return await fetchXml(`${baseUrl}${path}`, {
        headers: plexHeaders(clientIdentifier, resource.accessToken)
      });
    } catch (error) {
      errors.push(`${baseUrl}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  throw new Error(
    `Could not reach Plex server "${resource.name}". Tried ${errors.length} connection(s). ${errors.join("; ")}`
  );
}

export async function createPlexPin(clientIdentifier: string): Promise<{
  id: number;
  code: string;
  authUrl: string;
}> {
  const params = new URLSearchParams({ strong: "true" });
  const pin = await fetchJson<{ id: number; code: string }>(`${PLEX_TV_URL}/api/v2/pins?${params}`, {
    method: "POST",
    headers: plexHeaders(clientIdentifier)
  });

  const authParams = new URLSearchParams({
    clientID: clientIdentifier,
    code: pin.code,
    "context[device][product]": PRODUCT
  });

  return { ...pin, authUrl: `https://app.plex.tv/auth/#!?${authParams}` };
}

export async function getPlexPin(clientIdentifier: string, pinId: string): Promise<{
  id: number;
  code: string;
  authToken?: string;
}> {
  return fetchJson(`${PLEX_TV_URL}/api/v2/pins/${pinId}`, {
    headers: plexHeaders(clientIdentifier)
  });
}

export async function getPlexAccount(token: string, clientIdentifier: string): Promise<{
  id?: string;
  username?: string;
  email?: string;
  title?: string;
  identifier?: string;
}> {
  const account = await fetchJson<Record<string, unknown>>(`${PLEX_TV_URL}/api/v2/user`, {
    headers: plexHeaders(clientIdentifier, token)
  });
  const id = text(account.id) ?? text(account.uuid);
  const username = text(account.username);
  const email = text(account.email);
  const title = text(account.title);

  return {
    id,
    username,
    email,
    title,
    identifier: username ?? email ?? title ?? id
  };
}

export async function getResources(token: string, clientIdentifier: string): Promise<PlexResource[]> {
  const cacheKey = `${clientIdentifier}:${token}`;
  const now = Date.now();
  pruneResourceCache(now);

  const cached = resourceCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.resources;
  }

  const data = await fetchXml(
    `${PLEX_TV_URL}/api/resources?includeHttps=1&includeRelay=1&includeIPv6=1`,
    {
      headers: plexHeaders(clientIdentifier, token)
    }
  );
  const container = data.MediaContainer as XmlRecord | undefined;
  const devices = ensureArray(container?.Device as XmlRecord | XmlRecord[] | undefined);

  const resources = devices
    .filter((device) => text(device.provides)?.split(",").includes("server") && text(device.accessToken))
    .map((device) => ({
      id: text(device.clientIdentifier) ?? text(device.name) ?? "",
      name: text(device.name) ?? "Unnamed server",
      product: text(device.product),
      owned: bool(device.owned),
      provides: text(device.provides),
      accessToken: text(device.accessToken) ?? "",
      connections: ensureArray(device.Connection as XmlRecord | XmlRecord[] | undefined).map((connection) => ({
        uri: text(connection.uri) ?? "",
        local: bool(connection.local),
        relay: bool(connection.relay),
        protocol: text(connection.protocol)
      }))
    }))
    .filter((resource) => resource.id && resource.connections.some((connection) => connection.uri));

  resourceCache.set(cacheKey, {
    expiresAt: now + RESOURCE_CACHE_TTL_MS,
    resources
  });

  return resources;
}

export async function getResource(
  token: string,
  clientIdentifier: string,
  resourceId: string
): Promise<PlexResource> {
  const resource = (await getResources(token, clientIdentifier)).find((item) => item.id === resourceId);

  if (!resource) {
    throw new Error("Selected Plex server was not found.");
  }

  return resource;
}

export function getBestConnection(resource: PlexResource): string {
  const connection = getOrderedConnections(resource)[0];

  if (!connection) {
    throw new Error("Selected Plex server has no usable connection.");
  }

  return connection;
}

export async function getLibraries(resource: PlexResource, clientIdentifier: string): Promise<PlexLibrary[]> {
  const data = await fetchServerXml(resource, "/library/sections", clientIdentifier);
  const container = data.MediaContainer as XmlRecord | undefined;

  return ensureArray(container?.Directory as XmlRecord | XmlRecord[] | undefined).map((directory) => ({
    key: text(directory.key) ?? "",
    title: text(directory.title) ?? "Untitled library",
    type: text(directory.type) ?? "unknown"
  }));
}

export async function getPlaylists(resource: PlexResource, clientIdentifier: string): Promise<PlexPlaylist[]> {
  const data = await fetchServerXml(resource, "/playlists", clientIdentifier);
  const container = data.MediaContainer as XmlRecord | undefined;

  return ensureArray(container?.Playlist as XmlRecord | XmlRecord[] | undefined)
    .map((playlist) => {
      const ratingKey = text(playlist.ratingKey) ?? "";
      const rawKey = text(playlist.key)?.replace(/\/items$/, "");

      return {
        key: ratingKey ? `/playlists/${ratingKey}` : (rawKey ?? ""),
        ratingKey,
        title: text(playlist.title) ?? "Untitled playlist",
        type: text(playlist.playlistType) ?? text(playlist.type) ?? "audio",
        leafCount: Number(text(playlist.leafCount) ?? 0),
        smart: bool(playlist.smart)
      };
    })
    .filter((playlist) => playlist.type === "audio" && !playlist.smart);
}

export async function getPlaylistTracks(input: {
  resource: PlexResource;
  clientIdentifier: string;
  playlistKey: string;
  libraryKey?: string;
}): Promise<GameTrack[]> {
  const itemsPath = input.playlistKey.endsWith("/items") ? input.playlistKey : `${input.playlistKey}/items`;
  const data = await fetchServerXml(input.resource, itemsPath, input.clientIdentifier);
  const container = data.MediaContainer as XmlRecord | undefined;
  const tracks = ensureArray(container?.Track as XmlRecord | XmlRecord[] | undefined);

  return tracks
    .filter((track) => !input.libraryKey || text(track.librarySectionID) === input.libraryKey)
    .map((track) => {
      const media = ensureArray(track.Media as XmlRecord | XmlRecord[] | undefined)[0];
      const part = media ? ensureArray(media.Part as XmlRecord | XmlRecord[] | undefined)[0] : undefined;
      const ratingKey = text(track.ratingKey) ?? "";
      const metadataKey = text(track.key) ?? (ratingKey ? `/library/metadata/${ratingKey}` : "");

      return {
        id: ratingKey || metadataKey,
        key: metadataKey,
        streamKey: text(part?.key) ?? "",
        title: text(track.title) ?? "Unknown title",
        artist: text(track.originalTitle) ?? text(track.grandparentTitle),
        album: text(track.parentTitle),
        year:
          text(track.parentYear) ??
          text(track.parentOriginallyAvailableAt)?.slice(0, 4) ??
          text(track.year) ??
          text(track.originallyAvailableAt)?.slice(0, 4),
        duration: Number(text(track.duration) ?? 0),
        thumb: text(track.thumb) ?? text(track.parentThumb) ?? text(track.grandparentThumb)
      };
    })
    .filter((track) => track.id && track.key && track.streamKey);
}

export function buildPlexMusicTranscodePath(input: {
  metadataKey: string;
  transcodeSessionId: string;
  musicBitrate?: number;
}): string {
  const params = new URLSearchParams({
    path: input.metadataKey,
    protocol: "http",
    directPlay: "0",
    directStream: "0",
    directStreamAudio: "0",
    mediaIndex: "0",
    partIndex: "0",
    session: input.transcodeSessionId,
    musicBitrate: String(input.musicBitrate ?? DEFAULT_MUSIC_TRANSCODE_BITRATE_KBPS)
  });

  return `/music/:/transcode/universal/start.mp3?${params}`;
}

export async function fetchPlexStream(input: {
  resource: PlexResource;
  clientIdentifier: string;
  streamKey: string;
  range?: string | null;
  timeoutMs?: number;
}): Promise<Response> {
  const headers: Record<string, string> = {
    ...plexHeaders(input.clientIdentifier, input.resource.accessToken)
  };

  if (input.range) {
    headers.Range = input.range;
  }

  const errors: string[] = [];

  for (const baseUrl of getOrderedConnections(input.resource)) {
    try {
      const response = await fetch(
        `${baseUrl}${input.streamKey}`,
        withTimeout({ headers }, input.timeoutMs ?? PLEX_STREAM_TIMEOUT_MS)
      );

      if (response.ok || response.status === 206) {
        return response;
      }

      errors.push(`${baseUrl}: Plex stream failed with ${response.status}`);
    } catch (error) {
      errors.push(`${baseUrl}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  throw new Error(`Could not stream the selected track. ${errors.join("; ")}`);
}

export async function fetchPlexMusicTranscode(input: {
  resource: PlexResource;
  clientIdentifier: string;
  metadataKey: string;
  transcodeSessionId: string;
  timeoutMs?: number;
}): Promise<Response> {
  const headers = {
    ...plexHeaders(input.clientIdentifier, input.resource.accessToken),
    Accept: "audio/mpeg,*/*",
    "X-Plex-Client-Profile-Name": "generic",
    "X-Plex-Platform": "Chrome"
  };
  const transcodePath = buildPlexMusicTranscodePath({
    metadataKey: input.metadataKey,
    transcodeSessionId: input.transcodeSessionId
  });
  const errors: string[] = [];

  for (const baseUrl of getOrderedConnections(input.resource)) {
    try {
      const response = await fetch(
        `${baseUrl}${transcodePath}`,
        withTimeout({ headers }, input.timeoutMs ?? PLEX_STREAM_TIMEOUT_MS)
      );

      if (response.ok || response.status === 206) {
        return response;
      }

      errors.push(`${baseUrl}: Plex transcode failed with ${response.status}`);
    } catch (error) {
      errors.push(`${baseUrl}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  throw new Error(`Could not transcode the selected track. ${errors.join("; ")}`);
}
