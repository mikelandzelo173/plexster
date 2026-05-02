# Plexster

Plexster is a browser-based music guessing game inspired by Hitster. Connect a Plex account, choose a Plex server and playlist, and play randomly selected songs without repeats during a session.

## Disclaimer

This app is for educational purposes only. Plexster is an independent project and is not affiliated with, endorsed by, sponsored by, or otherwise connected to Plex Inc., Plex, or any Plex products or services.

## Features

- Plex PIN login from the browser.
- Plex server and audio playlist selection.
- Random no-repeat queue per play session.
- Browser audio playback through a server-side Plex stream proxy.
- Pause, restart from the beginning, skip, and reveal-solution controls.
- Responsive UI for desktop, tablet, and phone browsers.

## Requirements

- Node.js 20 or newer.
- npm.
- A Plex account with access to a Plex Media Server.
- At least one non-smart Plex audio playlist with playable tracks.

The app is designed as a self-hosted personal app. Your browser talks to the Plexster server, and Plexster talks to Plex and proxies the current audio stream back to the browser.

## Install

```sh
npm install
```

## Run Locally

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect your Plex account, select a server and playlist, then start a play session.

## Build

```sh
npm run build
```

To run the production build locally:

```sh
npm run build
npm start
```

## Useful Commands

```sh
npm run lint
npm run typecheck
npm run test
```

## Deploy

Plexster is a Next.js app and can be deployed anywhere that supports a Node.js Next.js server, such as a home server, NAS, VPS, Docker host, or platforms like Vercel.

For a simple self-hosted Node deployment:

```sh
npm install
npm run build
npm start
```

Then expose the server on your local network or behind your preferred reverse proxy. If you deploy outside your home network, make sure your Plex server is reachable from the deployment environment. Local-only Plex server connections may not work from a remote host unless Plex remote access, VPN, or a tunnel is configured.

## Docker

The repository includes a `Dockerfile` (Next.js [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)) and `docker-compose.yml` for a production image that listens on port **3000**.

Requirements: [Docker Engine](https://docs.docker.com/engine/install/) with [Compose](https://docs.docker.com/compose/install/) (the `docker compose` plugin).

From the repository root:

```sh
docker compose up -d --build
```

Then open [http://localhost:3000](http://localhost:3000). To stop and remove the container:

```sh
docker compose down
```

The same Plex reachability considerations as in [Deploy](#deploy) apply: the container must be able to reach your Plex Media Server from its network (e.g. bridge mode to the host LAN, or the same Docker network as Plex if both run in containers).

## Runtime Notes

Session state is kept in memory for now. Restarting the server clears the Plex connection and active game.

The Plex token is stored only server-side in the in-memory session and referenced by an HTTP-only browser cookie. Do not deploy this MVP as a shared public service without adding durable session storage, stronger secret handling, and multi-user isolation.

## Game Flow

1. Connect your Plex account.
2. Select a Plex server.
3. Select an audio playlist.
4. Start a play session.
5. Play, pause, restart, skip, or reveal the solution for each song.

No song is selected twice within the same play session.
