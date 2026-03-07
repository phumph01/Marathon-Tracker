# Owner-only Upload Roadmap

This document outlines a future phase to make uploads/write actions owner-only while keeping read access public.

## Target model

- Public users: read-only access to graph, calendar, weekly, data, and fitness tabs.
- Owner user: authenticated access to all upload and data-manipulation controls.

## Recommended stack

- Auth: Supabase Auth (email or OAuth) with one owner account.
- Data: Supabase Postgres (or equivalent hosted DB) for server-backed state.
- API: server routes/functions that enforce auth checks before writes.

## Guard points to implement

1. Hide/disable `Utilities` upload controls unless authenticated as owner.
2. Move write operations behind authenticated API endpoints:
   - plan upload
   - Garmin activities upload
   - single activity upload
   - race/settings updates that mutate shared data
3. Keep chart/calendar/data read endpoints public (or cacheable).

## Migration path from current local persistence

1. Keep `localStorage` as a temporary fallback and local cache.
2. On owner login, sync local unsynced writes to server.
3. Read from server as source of truth, with local cache hydration for faster startup.

## Security notes

- Do not trust client-side role checks alone; enforce owner role on the server.
- Validate payload shape/date formats server-side before saving.
- Add audit metadata (`updatedBy`, `updatedAt`) for all write operations.
