import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { cookies } from "next/headers";

import type { GameSession } from "@/lib/game/types";

const SESSION_COOKIE = "plexster_session";
const CLIENT_IDENTIFIER_COOKIE = "plexster_client_id";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;
const SESSION_TTL_MS = ONE_WEEK_SECONDS * 1000;
const MAX_SESSIONS = 100;
const DEV_SESSION_STORE = join(process.cwd(), ".next/cache/plexster-sessions.json");

export type PlexsterSession = {
  id: string;
  clientIdentifier: string;
  plexToken?: string;
  game?: GameSession;
  createdAt: number;
  lastAccessedAt: number;
};

const sessions = new Map<string, PlexsterSession>();
let persistedSessionsLoaded = false;

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type PersistedGameSession = Omit<GameSession, "playedIds"> & {
  playedIds: string[];
};
type PersistedSession = Pick<
  PlexsterSession,
  "id" | "clientIdentifier" | "plexToken" | "createdAt" | "lastAccessedAt"
> & {
  game?: PersistedGameSession;
};

function canPersistSessions(): boolean {
  return process.env.NODE_ENV === "development";
}

function isPersistedSession(value: unknown): value is PersistedSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<PersistedSession>;

  return (
    typeof session.id === "string" &&
    typeof session.clientIdentifier === "string" &&
    typeof session.plexToken === "string" &&
    typeof session.createdAt === "number" &&
    typeof session.lastAccessedAt === "number"
  );
}

function serializeGameSession(game: GameSession): PersistedGameSession {
  return {
    ...game,
    playedIds: [...game.playedIds]
  };
}

function deserializeGameSession(game: PersistedGameSession): GameSession {
  return {
    ...game,
    playedIds: new Set(game.playedIds)
  };
}

async function hydratePersistedSessions(): Promise<void> {
  if (!canPersistSessions() || persistedSessionsLoaded) {
    return;
  }

  persistedSessionsLoaded = true;

  try {
    const rawSessions = JSON.parse(await readFile(DEV_SESSION_STORE, "utf8")) as unknown;

    if (!Array.isArray(rawSessions)) {
      return;
    }

    for (const session of rawSessions) {
      if (isPersistedSession(session) && Date.now() - session.lastAccessedAt <= SESSION_TTL_MS) {
        sessions.set(session.id, {
          ...session,
          game: session.game ? deserializeGameSession(session.game) : undefined
        });
      }
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    console.warn("Could not restore Plexster development sessions.", error);
  }
}

async function persistSessions(): Promise<void> {
  if (!canPersistSessions()) {
    return;
  }

  const persistedSessions: PersistedSession[] = [...sessions.values()]
    .filter((session): session is PlexsterSession & { plexToken: string } => Boolean(session.plexToken))
    .map((session) => ({
      id: session.id,
      clientIdentifier: session.clientIdentifier,
      plexToken: session.plexToken,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt,
      game: session.game ? serializeGameSession(session.game) : undefined
    }));

  try {
    await mkdir(dirname(DEV_SESSION_STORE), { recursive: true });
    await writeFile(DEV_SESSION_STORE, JSON.stringify(persistedSessions, null, 2), "utf8");
  } catch (error) {
    console.warn("Could not persist Plexster development sessions.", error);
  }
}

function isExpired(session: PlexsterSession, now = Date.now()): boolean {
  return now - session.lastAccessedAt > SESSION_TTL_MS;
}

function pruneSessions(now = Date.now()): void {
  for (const [sessionId, session] of sessions) {
    if (isExpired(session, now)) {
      sessions.delete(sessionId);
    }
  }

  if (sessions.size <= MAX_SESSIONS) {
    return;
  }

  const oldestSessions = [...sessions.values()].sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);
  const sessionsToRemove = sessions.size - MAX_SESSIONS;

  for (const session of oldestSessions.slice(0, sessionsToRemove)) {
    sessions.delete(session.id);
  }
}

function touchSession(session: PlexsterSession, now = Date.now()): PlexsterSession {
  session.lastAccessedAt = now;
  return session;
}

function setSessionCookies(cookieStore: CookieStore, session: PlexsterSession): void {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_SECONDS,
    path: "/"
  };

  cookieStore.set(SESSION_COOKIE, session.id, cookieOptions);
  cookieStore.set(CLIENT_IDENTIFIER_COOKIE, session.clientIdentifier, cookieOptions);
}

export async function getOrCreateSession(): Promise<PlexsterSession> {
  await hydratePersistedSessions();
  pruneSessions();

  const cookieStore = await cookies();
  const existingId = cookieStore.get(SESSION_COOKIE)?.value;
  const existingClientIdentifier = cookieStore.get(CLIENT_IDENTIFIER_COOKIE)?.value;

  if (existingId) {
    const existingSession = sessions.get(existingId);
    if (existingSession && !isExpired(existingSession)) {
      setSessionCookies(cookieStore, existingSession);
      return touchSession(existingSession);
    }
  }

  const now = Date.now();
  const session: PlexsterSession = {
    id: existingId ?? randomUUID(),
    clientIdentifier: existingClientIdentifier ?? randomUUID(),
    createdAt: now,
    lastAccessedAt: now
  };

  sessions.set(session.id, session);
  pruneSessions(now);
  setSessionCookies(cookieStore, session);

  return session;
}

export async function getSession(): Promise<PlexsterSession | undefined> {
  await hydratePersistedSessions();
  pruneSessions();

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    return undefined;
  }

  if (isExpired(session)) {
    sessions.delete(session.id);
    await persistSessions();
    return undefined;
  }

  setSessionCookies(cookieStore, session);
  touchSession(session);
  await persistSessions();

  return session;
}

export async function requirePlexSession(): Promise<PlexsterSession> {
  const session = await getSession();

  if (!session?.plexToken) {
    throw Response.json({ error: "Plex account is not connected." }, { status: 401 });
  }

  return session;
}

export async function setPlexToken(session: PlexsterSession, plexToken: string): Promise<void> {
  session.plexToken = plexToken;
  touchSession(session);
  await persistSessions();
}

export async function saveSession(session: PlexsterSession): Promise<void> {
  touchSession(session);
  await persistSessions();
}

export async function clearSession(): Promise<void> {
  await hydratePersistedSessions();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    sessions.delete(sessionId);
    await persistSessions();
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CLIENT_IDENTIFIER_COOKIE);
}
