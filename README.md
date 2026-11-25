# FreillDe SpeechText (React + Node backend)

A full-stack app that records lectures, transcribes audio/video files in the
browser with Whisper, keeps notes, and builds study material from your own notes.

- **Frontend** – React 18 + Vite (`src/`). Recording, Whisper transcription, and
  study tools all run in the browser.
- **Backend** – Express REST API (`server/`). Handles accounts and sessions,
  persists each user's working draft, notes, and tasks to a JSON file on disk,
  and serves the built frontend in production.

The original single-file `freill.html` is left untouched next to the React source.

## Requirements

- Node.js 18 or newer (tested with Node 22)
- A modern browser
  - Live speech-to-text: Chrome, Edge, or Safari (uses the browser's
    `SpeechRecognition` API)
  - File transcription: any current Chromium/Firefox/Safari build. The first run
    downloads the Whisper model from a CDN, so an internet connection is needed
    once. Models are cached by the browser afterwards.

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` starts both processes:

| Process  | URL                     | Command            |
| -------- | ----------------------- | ------------------ |
| Frontend | `http://localhost:5173` | `npm run dev:client` |
| Backend  | `http://127.0.0.1:3001` | `npm run dev:server` |

Vite proxies `/api` requests to the backend, so the frontend can call the API
with relative URLs.

On first launch the app shows a sign-in screen. Use **Create one** to register
an account, then sign in. Every account has its own private draft, notes, and
tasks. **Log out** is in the top-right of the workspace; it revokes the session
on the server and clears the saved token from the browser.

Production build:

```bash
npm run build
npm start
```

`npm start` runs the API server, which also serves the built frontend from
`dist/` at `http://127.0.0.1:3001`.

### Using Visual Studio Code

Do **not** use the Live Server extension or open `index.html` as a file — React
and JSX need Vite. In VS Code:

1. Run **Terminal → Run Task → Start dev server** (or run `npm run dev` in the
   terminal).
2. Wait until you see `VITE ... ready`.
3. Press **F5** to launch Chrome at `http://localhost:5173`.

`.vscode/launch.json` is configured for port `5173`. If you see a white blank
page, check the address bar: it must be `http://localhost:5173`, not `8080`,
`5500`, or a `file:///...` path.

## Features

1. **Lecture recorder** – microphone and/or shared tab audio, pause/resume, live
   transcription, live level ring, downloadable raw recording, and a full
   re-transcription of the recording.
2. **Audio to text** – drag and drop MP3/WAV/M4A/MP4/WebM and more. Language
   selection/auto-detect, translate-to-English task, accuracy presets, optional
   enhancement and normalisation, progress/cancel, and `.srt` / `.vtt` export.
3. **Transcript & notes** – word count, read time, autosaved draft, saved notes
   list (open/delete), copy, `.txt` export, and clear.
4. **Study tools** – key-point outline, formatting clean-up, keywords, reviewer,
   flashcards, and a scored practice exam with an answer key.
5. **Tasks** – add, rename, complete, filter, and delete tasks. The list is
   stored by the backend and mirrored in the browser while offline.
6. **Accounts** – register, sign in, and log out. Passwords are stored as salted
   scrypt hashes, and each login creates a random bearer token that logout
   revokes.

## Data storage

Users, sessions, and each account's draft/notes/tasks are stored by the backend
in `server/data/db.json` (created automatically on first write). The frontend
also keeps a per-account copy in `localStorage` so the app keeps working if the
API is down:

- `lr_token` – the current session token
- `lr_draft:<userId>` – current title, transcript, and a local timestamp
- `lr_notes:<userId>` – cached notes list
- `lr_tasks:<userId>` – cached task list

The `<userId>` suffix keeps one account's offline cache separate from another's.
The header badge shows whether the app is connected to the backend or running
from browser storage only. When the server comes back, the next autosave or
saved note syncs again.

## API

All endpoints are under `/api` and exchange JSON. Every endpoint except
`/health`, `/auth/register`, and `/auth/login` requires this header:

```text
Authorization: Bearer <token>
```

| Method   | Path               | Description                                    |
| -------- | ------------------ | ---------------------------------------------- |
| `GET`    | `/health`          | Health check and user count                    |
| `POST`   | `/auth/register`   | Create account; returns `{ token, user }`      |
| `POST`   | `/auth/login`      | Sign in; returns `{ token, user }`             |
| `GET`    | `/auth/me`         | Current user from the token                    |
| `POST`   | `/auth/logout`     | Revoke the current token                       |
| `GET`    | `/draft`           | This user's draft `{ t, x, updatedAt }`         |
| `PUT`    | `/draft`           | Save this user's draft `{ t, x }`              |
| `GET`    | `/notes`           | List this user's notes, newest first           |
| `POST`   | `/notes`           | Create a note `{ t, x }`                       |
| `PUT`    | `/notes/:id`       | Update a note `{ t, x }`                       |
| `DELETE` | `/notes/:id`       | Delete a note                                  |
| `GET`    | `/tasks`           | List this user's tasks, newest first           |
| `POST`   | `/tasks`           | Create a task `{ t, done? }`                   |
| `PUT`    | `/tasks/:id`       | Update a task `{ t?, done? }`                  |
| `DELETE` | `/tasks/:id`       | Delete a task                                  |

### Backend configuration

| Variable       | Default        | Purpose                              |
| -------------- | -------------- | ------------------------------------ |
| `PORT`         | `3001`         | API port                             |
| `HOST`         | `127.0.0.1`    | Bind address                         |
| `DATA_DIR`     | `server/data`  | Where `db.json` is written           |
| `VITE_API_URL` | `/api`         | Frontend API base URL at build time  |

## Project structure

```text
index.html               Vite entry document
server/
  index.js               Express app, REST routes, static hosting
  db.js                  JSON-file storage with serialized writes
  auth.js                Password hashing and session token helpers
src/
  main.jsx               React bootstrap
  App.jsx                Auth gate + shared state, API sync, panel layout
  styles.css             Original styling, preserved
  context/
    AuthContext.jsx      Session state, login/register/logout
  components/
    Header.jsx           Connection badge, account name, logout button
    LoginPage.jsx        Sign-in / registration screen
    AuthForm.jsx         Shared email/password form
    Panel.jsx
    LevelRing.jsx        Analyser canvas + record button
    RecorderPanel.jsx
    AudioToTextPanel.jsx
    TranscriptPanel.jsx
    StudyToolsPanel.jsx
    TasksPanel.jsx       Task form, filters, rename/complete/delete
    Flashcards.jsx
    Exam.jsx
  hooks/
    useRecorder.js       Mic/tab capture, MediaRecorder, SpeechRecognition
    useTranscriber.js    Whisper job state, progress, subtitles
  lib/
    api.js               Fetch client with bearer token + auth endpoints
    auth.js              Token storage and unauthorized-event helper
    asr.js               Worker lifecycle + job protocol
    whisper.worker.js    Transformers.js Whisper worker
    audio.js             Decode, enhance, normalise audio
    study.js             Outline/reviewer/cards/exam generators
    text.js              Transcript cleanup, formatting, subtitle output
    time.js, storage.js, languages.js
```

## Notes on the conversion

- The original vanilla DOM code is split into React components, with recording
  and transcription logic in custom hooks. UI text, styling, and behavior match
  the original.
- The Whisper worker is now a real module worker
  (`src/lib/whisper.worker.js`) instead of a blob built from a function string.
  Transformers.js is still loaded from jsDelivr on first use.
- Subtle original quirks were kept where they are user-facing; small fixes were
  made for React safety (for example, guarding an empty flashcard set).
- If the app is served from a folder rather than the domain root, set a Vite
  `base` in `vite.config.js`.
