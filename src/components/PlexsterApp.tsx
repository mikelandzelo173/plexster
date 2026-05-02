"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

type Resource = {
  id: string;
  name: string;
  product?: string;
  owned: boolean;
};

type Playlist = {
  key: string;
  ratingKey: string;
  title: string;
  leafCount?: number;
};

type PublicTrack = {
  id: string;
  streamUrl: string;
  revealed: boolean;
  solution?: {
    title: string;
    artist?: string;
    album?: string;
    year?: string;
    duration?: number;
    thumb?: string;
    artworkUrl?: string;
  };
};

type GameState = {
  playlistTitle: string;
  remaining: number;
  total: number;
  current?: PublicTrack;
  done?: boolean;
};

type Pin = {
  id: number;
  code: string;
  authUrl: string;
};

type PlexAccount = {
  identifier?: string;
  username?: string;
  email?: string;
};

type PlexStatus = {
  connected: boolean;
  account?: PlexAccount;
};

type Notification = {
  type: "error" | "success";
  message: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type JsonRequestInit = RequestInit & {
  timeoutMs?: number;
};

const REQUEST_TIMEOUT_MS = 20_000;
const PIN_POLL_TIMEOUT_MS = 10_000;
const AUDIO_STALLED_WARNING_MS = 8_000;
const SUCCESS_SNACKBAR_VISIBLE_MS = 5_000;

class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function requestJson<T>(url: string, init?: JsonRequestInit): Promise<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...requestInit } = init ?? {};
  const controller = requestInit.signal ? undefined : new AbortController();
  const timeout = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const response = await fetch(url, {
      ...requestInit,
      signal: requestInit.signal ?? controller?.signal
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };

    if (!response.ok) {
      throw new HttpRequestError(data.error ?? "Request failed.", response.status);
    }

    return data;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("The request timed out. Check your connection and try again.");
    }

    throw error;
  } finally {
    if (timeout) {
      window.clearTimeout(timeout);
    }
  }
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 5H8V19H5V5Z" />
      <path d="M19 5V19L9 12L19 5Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 5V19L19 12L8 5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 5H10.5V19H7V5Z" />
      <path d="M13.5 5H17V19H13.5V5Z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 5V19L15 12L5 5Z" />
      <path d="M16 5H19V19H16V5Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 6H18V18H6V6Z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 12C14.2 12 16 10.2 16 8C16 5.8 14.2 4 12 4C9.8 4 8 5.8 8 8C8 10.2 9.8 12 12 12Z" />
      <path d="M4 20C4.6 16.6 7.9 14 12 14C16.1 14 19.4 16.6 20 20H4Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6.7 5.3L12 10.6L17.3 5.3L18.7 6.7L13.4 12L18.7 17.3L17.3 18.7L12 13.4L6.7 18.7L5.3 17.3L10.6 12L5.3 6.7L6.7 5.3Z" />
    </svg>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  options: SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const visibleOptions = [{ value: "", label: placeholder }, ...options];
  const selectOpen = open && !disabled;

  useEffect(() => {
    if (!selectOpen) {
      return;
    }

    function closeOnOutsideInteraction(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeOnOutsideInteraction);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideInteraction);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectOpen]);

  return (
    <div className="select-field" ref={rootRef}>
      <span className="select-label">{label}</span>
      <button
        type="button"
        className="select-trigger"
        aria-expanded={selectOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption?.label ?? placeholder}</span>
      </button>
      {selectOpen ? (
        <div className="select-menu" id={listboxId} role="listbox">
          {visibleOptions.map((option) => (
            <button
              type="button"
              className="select-option"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PlexsterApp() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pinPollInFlightRef = useRef(false);
  const pendingPlaybackTrackIdRef = useRef<string | undefined>(undefined);
  const audioStalledWarningTimerRef = useRef<number | undefined>(undefined);
  const [connected, setConnected] = useState(false);
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [pin, setPin] = useState<Pin>();
  const [resources, setResources] = useState<Resource[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedServerId, setSelectedServerId] = useState("");
  const [selectedPlaylistKey, setSelectedPlaylistKey] = useState("");
  const [game, setGame] = useState<GameState>();
  const [loading, setLoading] = useState(false);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [startSessionLoading, setStartSessionLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [notification, setNotification] = useState<Notification>();
  const [blockedPlaybackTrackId, setBlockedPlaybackTrackId] = useState<string>();
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const stopModalCancelRef = useRef<HTMLButtonElement>(null);
  const stopDialogTitleId = useId();
  const stopDialogDescId = useId();

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.key === selectedPlaylistKey),
    [playlists, selectedPlaylistKey]
  );
  const isSessionActive = Boolean(game?.current);
  const currentTrackId = game?.current?.id;

  const notifyError = useCallback((message: string) => {
    setNotification({ type: "error", message });
  }, []);

  const notifySuccess = useCallback((message: string) => {
    setNotification({ type: "success", message });
  }, []);

  const playAudio = useCallback(
    async ({ blockedMessage = "Tap Play to start audio.", notifyOnBlocked = true, userInitiated = false } = {}) => {
      const audio = audioRef.current;

      if (!audio) {
        return false;
      }

      try {
        if (userInitiated && audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
          audio.load();
        }

        await audio.play();
        pendingPlaybackTrackIdRef.current = undefined;
        setBlockedPlaybackTrackId(undefined);
        setNotification((currentNotification) =>
          currentNotification?.message === blockedMessage ? undefined : currentNotification
        );
        return true;
      } catch {
        setIsPlaying(false);
        setBlockedPlaybackTrackId(currentTrackId);
        if (notifyOnBlocked) {
          notifyError(blockedMessage);
        }
        return false;
      }
    },
    [currentTrackId, notifyError]
  );

  const clearAudioStalledWarning = useCallback(() => {
    if (audioStalledWarningTimerRef.current) {
      window.clearTimeout(audioStalledWarningTimerRef.current);
      audioStalledWarningTimerRef.current = undefined;
    }
  }, []);

  const scheduleAudioStalledWarning = useCallback(() => {
    clearAudioStalledWarning();

    audioStalledWarningTimerRef.current = window.setTimeout(() => {
      const audio = audioRef.current;

      if (!audio || audio.paused || audio.ended || audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        return;
      }

      notifyError("Audio is still buffering or transcoding. Wait a moment, then tap Play to resume.");
    }, AUDIO_STALLED_WARNING_MS);
  }, [clearAudioStalledWarning, notifyError]);

  useEffect(() => {
    if (!game?.current || pendingPlaybackTrackIdRef.current !== game.current.id) {
      return;
    }

    void playAudio({ notifyOnBlocked: false });
  }, [game, playAudio]);

  const clearPlayState = useCallback(() => {
    audioRef.current?.pause();
    clearAudioStalledWarning();
    setAccountIdentifier("");
    setResources([]);
    setPlaylists([]);
    setSelectedServerId("");
    setSelectedPlaylistKey("");
    setPlaylistsLoading(false);
    setStartSessionLoading(false);
    setGame(undefined);
    setIsPlaying(false);
    setSolutionLoading(false);
    pendingPlaybackTrackIdRef.current = undefined;
    setBlockedPlaybackTrackId(undefined);
  }, [clearAudioStalledWarning]);

  const clearGameState = useCallback(() => {
    audioRef.current?.pause();
    clearAudioStalledWarning();
    setGame(undefined);
    setStartSessionLoading(false);
    setIsPlaying(false);
    setSolutionLoading(false);
    pendingPlaybackTrackIdRef.current = undefined;
    setBlockedPlaybackTrackId(undefined);
  }, [clearAudioStalledWarning]);

  useEffect(() => {
    if (notification?.type !== "success") {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotification(undefined);
    }, SUCCESS_SNACKBAR_VISIBLE_MS);

    return () => window.clearTimeout(timer);
  }, [notification]);

  useEffect(() => clearAudioStalledWarning, [clearAudioStalledWarning]);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setNotification(undefined);

    try {
      const data = await requestJson<{ resources: Resource[] }>("/api/plex/resources");
      setResources(data.resources);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not load Plex servers.");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    requestJson<PlexStatus>("/api/plex/status")
      .then((status) => {
        setConnected(status.connected);
        setAccountIdentifier(status.account?.identifier ?? status.account?.username ?? status.account?.email ?? "");
        if (status.connected) {
          void loadResources();
        } else {
          clearPlayState();
        }
      })
      .catch((error: Error) => notifyError(error.message));
  }, [clearPlayState, loadResources, notifyError]);

  useEffect(() => {
    if (!pin || connected) {
      return;
    }

    const timer = window.setInterval(() => {
      if (pinPollInFlightRef.current) {
        return;
      }

      pinPollInFlightRef.current = true;
      requestJson<PlexStatus>(`/api/plex/pin/status?pinId=${pin.id}`, { timeoutMs: PIN_POLL_TIMEOUT_MS })
        .then((status) => {
          if (status.connected) {
            setConnected(true);
            setAccountIdentifier(status.account?.identifier ?? status.account?.username ?? status.account?.email ?? "");
            setPin(undefined);
            notifySuccess("Plex account connected.");
            void loadResources();
          }
        })
        .catch((error: Error) => {
          if (error instanceof HttpRequestError && error.status === 404) {
            setPin(undefined);
            notifyError("Plex authorization code expired. Start Plex login again.");
            return;
          }

          notifyError(error.message);
        })
        .finally(() => {
          pinPollInFlightRef.current = false;
        });
    }, 3000);

    return () => window.clearInterval(timer);
  }, [connected, loadResources, notifyError, notifySuccess, pin]);

  async function connectPlex() {
    setLoading(true);
    setNotification(undefined);

    try {
      const nextPin = await requestJson<Pin>("/api/plex/pin", { method: "POST" });
      setPin(nextPin);
      window.open(nextPin.authUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not start Plex login.");
    } finally {
      setLoading(false);
    }
  }

  async function logoutPlex() {
    setLoading(true);
    setNotification(undefined);

    try {
      await requestJson<{ connected: boolean }>("/api/plex/session", { method: "DELETE" });
      setConnected(false);
      clearPlayState();
      notifySuccess("Logged out of Plex.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not log out of Plex.");
    } finally {
      setLoading(false);
    }
  }

  async function selectServer(serverId: string) {
    setSelectedServerId(serverId);
    setSelectedPlaylistKey("");
    setPlaylists([]);
    setGame(undefined);

    if (!serverId) {
      return;
    }

    setLoading(true);
    setPlaylistsLoading(true);
    setNotification(undefined);

    try {
      const playlistData = await requestJson<{ playlists: Playlist[] }>(`/api/plex/playlists?serverId=${serverId}`);
      setPlaylists(playlistData.playlists);

      if (playlistData.playlists.length === 0) {
        notifyError("No non-smart audio playlists were found on this Plex server.");
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not load playlists.");
    } finally {
      setLoading(false);
      setPlaylistsLoading(false);
    }
  }

  async function startGame() {
    if (!selectedServerId || !selectedPlaylist) {
      notifyError("Select a server and playlist first.");
      return;
    }

    setLoading(true);
    setStartSessionLoading(true);
    setNotification(undefined);

    try {
      const nextGame = await requestJson<GameState>("/api/game/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: selectedServerId,
          playlistKey: selectedPlaylist.key,
          playlistTitle: selectedPlaylist.title
        })
      });
      setGame(nextGame);
      setIsPlaying(false);
      setSolutionLoading(false);
      setBlockedPlaybackTrackId(undefined);
      pendingPlaybackTrackIdRef.current = nextGame.current?.id;
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not start game.");
    } finally {
      setLoading(false);
      setStartSessionLoading(false);
    }
  }

  async function revealSolution() {
    if (solutionLoading || game?.current?.revealed) {
      return;
    }

    setSolutionLoading(true);

    try {
      const nextGame = await requestJson<GameState>("/api/game/reveal", { method: "POST" });
      setGame(nextGame);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not reveal solution.");
    } finally {
      setSolutionLoading(false);
    }
  }

  async function skipTrack() {
    try {
      const nextGame = await requestJson<GameState>("/api/game/next", { method: "POST" });
      setGame(nextGame);
      setIsPlaying(false);
      setSolutionLoading(false);
      setBlockedPlaybackTrackId(undefined);
      pendingPlaybackTrackIdRef.current = nextGame.current?.id;
      if (nextGame.done) {
        notifySuccess("Session complete.");
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not skip song.");
    }
  }

  async function stopSession() {
    clearGameState();

    try {
      await requestJson<{ stopped: boolean }>("/api/game/session", { method: "DELETE" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not stop play session.";
      notifyError(`Stopped locally, but server cleanup failed: ${message}`);
    }
  }

  async function confirmStopSession() {
    setStopConfirmOpen(false);
    await stopSession();
  }

  useEffect(() => {
    if (!stopConfirmOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setStopConfirmOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    stopModalCancelRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [stopConfirmOpen]);

  function restartTrack() {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = 0;
    void playAudio({ userInitiated: true });
  }

  function togglePlayback() {
    if (!audioRef.current) {
      return;
    }

    if (audioRef.current.paused) {
      void playAudio({ userInitiated: true });
    } else {
      audioRef.current.pause();
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <h1 className="wordmark" aria-label="plexster">
          <span className="wordmark-plex">plex</span>
          <span className="wordmark-ster">ster</span>
        </h1>
      </section>

      {notification ? (
        <div className={`snackbar ${notification.type}`} role="status" aria-live="polite">
          <p>{notification.message}</p>
          {notification.type === "error" ? (
            <button className="snackbar-close" aria-label="Close notification" onClick={() => setNotification(undefined)}>
              <CloseIcon />
            </button>
          ) : null}
        </div>
      ) : null}

      {stopConfirmOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setStopConfirmOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={stopDialogTitleId}
            aria-describedby={stopDialogDescId}
            className="modal-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={stopDialogTitleId} className="modal-title">
              Stop session?
            </h2>
            <p id={stopDialogDescId} className="modal-body">
              Stop the current play session and return to the playlist selection?
            </p>
            <div className="modal-actions">
              <button type="button" ref={stopModalCancelRef} className="modal-cancel" onClick={() => setStopConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="danger-button modal-confirm-stop" onClick={() => void confirmStopSession()}>
                Stop session
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isSessionActive ? (
        <section className="app-section connect-section">
          {connected ? (
            <div className="account-panel">
              <div className="account-identity">
                <span className="user-avatar">
                  <UserIcon />
                </span>
                <span>{accountIdentifier || "Plex user"}</span>
              </div>
              <button className="danger-button" onClick={logoutPlex}>
                Logout
              </button>
            </div>
          ) : (
            <div className="stack">
              <button className="primary" disabled={loading} onClick={connectPlex}>
                Connect Plex account
              </button>
              {pin ? (
                <p>
                  Enter code <strong>{pin.code}</strong> in the Plex authorization window. If it did not
                  open, <a href={pin.authUrl}>open Plex authorization</a>.
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {connected && !isSessionActive ? (
        <section className="app-section">
          <h2>Select source</h2>
          <div className="grid two-column source-grid">
            <SelectField
              label="Plex server"
              value={selectedServerId}
              placeholder="Choose server"
              options={resources.map((resource) => ({ value: resource.id, label: resource.name }))}
              onChange={(nextServerId) => void selectServer(nextServerId)}
            />

            {selectedServerId ? (
              playlistsLoading || playlists.length ? (
                <SelectField
                  label="Playlist"
                  value={selectedPlaylistKey}
                  placeholder={playlistsLoading ? "Loading playlists..." : "Choose playlist"}
                  options={playlists.map((playlist) => ({
                    value: playlist.key,
                    label: `${playlist.title}${playlist.leafCount ? ` (${playlist.leafCount})` : ""}`
                  }))}
                  disabled={playlistsLoading}
                  onChange={setSelectedPlaylistKey}
                />
              ) : (
                <div className="field-message" role="status">
                  No playlists are available for this server.
                </div>
              )
            ) : null}
          </div>
          {selectedPlaylistKey ? (
            <button className="primary start-session-button" disabled={loading} onClick={startGame}>
              {startSessionLoading ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Loading
                </>
              ) : (
                "Start play session"
              )}
            </button>
          ) : null}
        </section>
      ) : null}

      {connected && selectedServerId && selectedPlaylistKey && game?.current ? (
        <section className="app-section player">
          <div className="section-heading">
            <div>
              <h2>{game.playlistTitle}</h2>
            </div>
          </div>

          <audio
            key={game.current.id}
            ref={audioRef}
            className="player-audio"
            preload="none"
            src={game.current.streamUrl}
            onPause={() => {
              clearAudioStalledWarning();
              setIsPlaying(false);
            }}
            onPlay={() => setIsPlaying(true)}
            onPlaying={clearAudioStalledWarning}
            onCanPlay={clearAudioStalledWarning}
            onProgress={clearAudioStalledWarning}
            onTimeUpdate={clearAudioStalledWarning}
            onEnded={() => {
              clearAudioStalledWarning();
              setIsPlaying(false);
            }}
            onError={() => notifyError("Plex could not transcode this track. Check your server, then try again.")}
            onStalled={scheduleAudioStalledWarning}
            onWaiting={scheduleAudioStalledWarning}
          />

          <div className="controls">
            {blockedPlaybackTrackId === game.current.id ? (
              <p className="manual-playback-hint" role="status">
                Tap Play to start this track.
              </p>
            ) : null}
            <div className="transport-controls" role="group" aria-label="Song navigation">
              <button
                className="icon-button"
                aria-label="Start from beginning"
                title="Start from beginning"
                onClick={restartTrack}
              >
                <BackIcon />
              </button>
              <button
                className="icon-button play-button"
                aria-label={isPlaying ? "Pause" : "Play"}
                title={isPlaying ? "Pause" : "Play"}
                onClick={togglePlayback}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button
                className="icon-button"
                aria-label="Skip song"
                title="Skip song"
                onClick={() => void skipTrack()}
              >
                <NextIcon />
              </button>
            </div>
            <div className="session-actions">
              <button
                className="primary"
                disabled={solutionLoading || game.current.revealed}
                onClick={() => void revealSolution()}
              >
                {solutionLoading ? (
                  <>
                    <span className="button-spinner" aria-hidden="true" />
                    Loading
                  </>
                ) : (
                  "Show solution"
                )}
              </button>
              <button
                className="icon-button stop-button"
                aria-label="Stop session"
                title="Stop session"
                onClick={() => setStopConfirmOpen(true)}
              >
                <StopIcon />
              </button>
            </div>
          </div>

          {game.current.revealed && game.current.solution ? (
            <div className="solution">
              <div className="solution-content">
                {game.current.solution.artworkUrl ? (
                  <div
                    className="solution-cover"
                    aria-label="Cover"
                    role="img"
                    style={{ backgroundImage: `url(${game.current.solution.artworkUrl})` }}
                  />
                ) : (
                  <div className="solution-cover solution-cover-placeholder" aria-hidden="true" />
                )}
                <div>
                  <p className="solution-artist">{game.current.solution.artist ?? "Unknown artist"}</p>
                  <p className="solution-title">{game.current.solution.title}</p>
                  <p className="solution-album">
                    {[game.current.solution.album, game.current.solution.year ? `(${game.current.solution.year})` : undefined]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

    </main>
  );
}
