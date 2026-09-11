# VoxReels

VoxReels is an npm-workspace monorepo with a Next.js frontend and a separate Express API.

## Applications

- `apps/web`: Next.js frontend on `http://localhost:3000`
- `apps/api`: Express API on `http://localhost:4000`
- PostgreSQL/pgvector: Docker container `voxreels-postgres` on host port `5433`

## Local setup

1. Copy `apps/api/.env.example` to `apps/api/.env` and replace the development secrets.
2. Create `apps/web/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:4000`.
3. Start the `voxreels-postgres` Docker container.
4. Run `npm install` at the repository root.
5. Run `npm run prisma:migrate -w apps/api -- --name init` when initializing a fresh database.
6. Run `npm run prisma:seed -w apps/api` to create the default workspace and brands.
7. Run `npm run dev` to start the frontend and API together.

## Useful commands

```text
npm run dev
npm run build
npm run typecheck -w apps/api
npm run prisma:generate -w apps/api
npm run prisma:seed -w apps/api
```

## API baseline

All JSON endpoints are under `/api/v1`.

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | API and database health |
| POST | `/auth/register` | Public when enabled | Create an account, personal workspace, and starter brand |
| POST | `/auth/login` | Public | Log in and create a session |
| POST | `/auth/refresh` | Refresh cookie | Rotate the refresh token and issue an access token |
| POST | `/auth/logout` | Refresh cookie | Revoke the current refresh session |
| GET | `/auth/me` | Bearer access token | Return the current user |
| POST | `/auth/switch-workspace` | Bearer access token | Start a session in another joined workspace |
| GET | `/brands` | Bearer access token | List brands in the current workspace |

Registration and login return a short-lived access token in the response body. Send it as
`Authorization: Bearer <token>`. The refresh token is stored in an HTTP-only cookie and only
its SHA-256 hash is retained in PostgreSQL.

Each registration creates an isolated workspace where the new user is the owner. A user can also
belong to additional workspaces through `WorkspaceMembership`; invitation endpoints will be added
when team collaboration is implemented.

## API architecture

The API follows this request flow:

```text
route -> controller -> service -> Prisma
```

- Routes declare paths, middleware, and controllers.
- Controllers translate HTTP input and output, including cookies and status codes.
- Services own workflows, authorization decisions, and business rules.
- Repositories contain Prisma queries and database transactions.

```text
apps/api/src/
├── config/
├── controllers/
├── middlewares/
├── repositories/
├── routes/
├── schemas/
├── services/
├── types/
├── utils/
├── app.ts
└── index.ts
```

## Creative data ownership

```text
Workspace
└── Brand
    └── Project (topic, goal, offer, CTA, target duration)
        ├── ScriptVersion
        │   └── ScriptBeat
        │       ├── VoiceTake
        │       └── BeatMediaAsset -> MediaAsset
        ├── Timeline
        │   └── TimelineItem
        └── Export
```

PostgreSQL stores project inputs, script history, beat planning, asset metadata, voice-generation
metadata, normalized timeline items, and export records. Binary audio, video, and images will live
in object storage later; their `storageKey` and provenance remain in PostgreSQL.

JSON is limited to data whose shape genuinely varies by provider or visual type, such as asset
metadata, text-overlay style properties, and export metadata. Timeline ordering, timing, trims,
tracks, volume, transforms, transitions, and asset references are relational columns.

## UI direction

VoxReels should use a restrained neumorphic visual style within an interface inspired by
ElevenLabs. It should feel calm, spacious, focused, and professional rather than decorative.

### Structure

- Persistent left navigation for projects, the library, voices, assets, and performance.
- A large central workspace dedicated to the current script, voice, visual, or editing task.
- A contextual right panel for settings, history, source details, and generated outputs.
- A slim top bar for project context, search, account controls, and global actions.
- A persistent bottom action/player area when audio or video controls are relevant.

### Visual language

- Warm white and soft neutral-grey surfaces with near-black typography.
- Strong, oversized typography for the public landing page, balanced by quiet application UI.
- Subtle grid lines or structural guides may be used on marketing pages.
- Rounded cards, controls, media frames, navigation pills, and primary action buttons.
- Soft raised and inset shadows for neumorphic depth, used selectively on cards and controls.
- Thin borders should preserve structure and clarity where shadows alone are too subtle.
- Mostly monochrome styling with one restrained accent color for active states and status.
- Generous whitespace and minimal visual noise, similar to ElevenLabs' working interface.

### Interaction and accessibility rules

- Neumorphism must not be the only signal that an element is interactive.
- Text, icons, focus rings, selected states, and form boundaries need sufficient contrast.
- One obvious primary action per stage; secondary controls should remain visually quieter.
- Motion should be short and functional, limited to state changes and generation progress.
- Desktop is the main workspace, while script review and approval should remain adaptable to mobile.
