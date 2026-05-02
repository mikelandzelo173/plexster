export type PlexConnection = {
  uri: string;
  local: boolean;
  relay: boolean;
  protocol?: string;
};

export type PlexResource = {
  id: string;
  name: string;
  product?: string;
  owned: boolean;
  provides?: string;
  accessToken: string;
  connections: PlexConnection[];
};

export type PlexLibrary = {
  key: string;
  title: string;
  type: string;
};

export type PlexPlaylist = {
  key: string;
  ratingKey: string;
  title: string;
  type: string;
  leafCount?: number;
  smart: boolean;
};
