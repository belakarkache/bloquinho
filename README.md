# Bloquinho

An installable, offline-first PWA for quick notes. It runs in the browser, on desktop (installed through Chrome or Edge) and on mobile (Add to Home Screen).

**Live:** [bloquinho.pages.dev](https://bloquinho.pages.dev)

- **Signed out:** notes stay on the device (IndexedDB).
- **Signed in:** notes sync across devices through Supabase. Notes created before signing in move to the account automatically.

## Features

- Markdown formatting, checklists and links
- Color labels, pinning, search and drag-and-drop reordering
- Voice dictation with a local Whisper fallback
- Light, dark and system themes
- English and Portuguese

## Tech stack

| Area | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4, Motion, Phosphor Icons |
| Build and PWA | Vite, vite-plugin-pwa (Workbox) |
| Local data | Dexie (IndexedDB) |
| Auth and sync | Supabase (Postgres, Auth, RPC, RLS) |
| i18n | i18next |
| Voice | Web Speech API, Whisper via transformers.js in a Web Worker |
| Testing | Vitest, Testing Library, fake-indexeddb |
| Hosting | Cloudflare Pages |

## Getting started

```bash
npm install
cp .env.example .env.local   # add your Supabase URL and anon key
npm run dev
```

Without `.env.local`, the app runs in local-only mode and hides sign-in.

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run the tests (`npm run test:watch` for watch mode) |
| `npm run lint` | Lint with oxlint |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build (the service worker only runs here) |

## Supabase setup

1. Run every file in `supabase/migrations/`, in filename order, in the project's **SQL Editor**.
2. In **Authentication → URL Configuration**, set the production URL (for example, `https://bloquinho.pages.dev`) as *Site URL* and add it and `http://localhost:5173` to *Redirect URLs*.
3. Enable the **Email** provider.
4. Optional: enable the **Google** provider and set `VITE_AUTH_GOOGLE=true`. The OAuth redirect URI is `https://<your-project>.supabase.co/auth/v1/callback`.

## Deployment

Deploy to Cloudflare Pages with build command `npm run build` and output directory `dist`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and, optionally, `VITE_AUTH_GOOGLE` as environment variables.

## Architecture

### Sync

- Every write goes to IndexedDB first and is marked `pending`.
- The client never accesses the `notes` table directly. It pushes through the `push_notes` RPC and pulls through `pull_notes`.
- Pending changes are pushed with a 2 s debounce, at most once every 5 s, in batches of up to 200 notes.
- Pulls run on startup, when the app comes back online and on window focus.
- Failed requests retry with exponential backoff (30 s to 15 min).
- Conflicts resolve with last-write-wins on `updated_at`, both on the client and in `push_notes`.
- Deletions are soft deletes, so other devices see them. Deleted content is discarded and the record is purged after 30 days.
- Pulls use a server-generated `server_updated_at` cursor with a 60 s overlap to avoid missing concurrent transactions.

### Voice dictation

The Web Speech API is the default. When it is unavailable, offline or fails mid-recording, the app transcribes the audio locally with Whisper (`onnx-community/whisper-base`, q8) in a Web Worker. The model (~85 MB) downloads only after user confirmation and is cached for offline use.

### Usage limits

Per-user quotas and rate limits are enforced in the database (`supabase/migrations/20261008000000_init.sql`) to fit the Supabase free tier: note size, number of notes, storage and requests per minute.

## Project structure

```
src/
  auth/        session and sync context
  components/  UI components and hooks
  db/          Dexie schema
  i18n/        i18n setup and translations
  lib/         Supabase client
  notes/       note types, repository, Markdown and filters
  sync/        sync engine, SyncManager and Supabase adapter
  theme/       theme handling
  voice/       voice dictation
supabase/migrations/  database schema, RLS and RPCs
```

## License

[MIT](LICENSE). Developed by [icka.dev](https://icka.dev).
