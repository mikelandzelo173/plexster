export type GameTrack = {
  id: string;
  key: string;
  streamKey: string;
  title: string;
  artist?: string;
  album?: string;
  year?: string;
  duration?: number;
  thumb?: string;
};

export type PublicTrack = {
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

export type GameSession = {
  id: string;
  serverId: string;
  playlistKey: string;
  playlistTitle: string;
  queue: GameTrack[];
  playedIds: Set<string>;
  currentIndex: number;
  revealed: boolean;
  createdAt: number;
};
