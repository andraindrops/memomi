# coputo

Todo desktop app built with Electron Forge + Vite + React. Migrated from a Bun
web app: the HTTP API was replaced with Electron IPC and Postgres was replaced
with a local SQLite database.

## Getting Started

```sh
npm install
npm start
```

## Architecture

- **main process** (`src/main.ts`, `src/main/`) — owns the SQLite database
  (`better-sqlite3` + Kysely) and the service layer. Exposes operations over
  `ipcMain.handle`. Serves stored images through the custom `app://` protocol.
- **preload** (`src/preload.ts`) — exposes a typed `window.api` via
  `contextBridge` (`src/shared/ipc.ts`).
- **renderer** (`src/renderer/`) — the React UI. Calls `window.api` instead of
  `fetch`. Routing uses wouter's hash location.
- **shared** (`src/shared/`) — zod schemas, DB types, and the IPC contract used
  by both processes.

Single-user app: there is no auth. Every request runs as a fixed `LOCAL_USER_ID`,
but the per-user columns/logic are retained.

Data is stored under Electron's `userData` directory: `app.db` (SQLite) and
`uploads/` (images). The schema is created on startup by `src/main/migrate.ts`.

## Testing

```sh
npm test            # vitest: service integration tests (in-memory SQLite) + component tests
```

### Native module note (better-sqlite3)

`better-sqlite3` is a native addon and can only be compiled for one runtime ABI
at a time:

- `npm install` / `npm test` build it for **Node** (your system Node).
- `npm start` (Electron Forge) rebuilds it for **Electron**.

So after running `npm start`, the tests will fail to load the module until you
rebuild for Node:

```sh
npm run rebuild:node   # then `npm test` works again
```

## Other scripts

```sh
npm run lint
npm run format
npm run make        # package the app
```
