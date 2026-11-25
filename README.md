# FreillDe SpeechText (React)

A React conversion of the original single-file `freill.html` app. It records lectures,
transcribes audio/video files in the browser with Whisper, keeps notes in
`localStorage`, and builds study material from your own notes.

The original `freill.html` is left untouched next to the React source.

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

Vite prints a local URL (usually `http://localhost:5173`). Open it in your browser.

Production build:

```bash
npm run build
npm run preview
```

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

Notes and drafts stay in the browser:

- `lr_draft` – the current title and transcript
- `lr_notes` – saved notes

## Project structure

```text
index.html               Vite entry document
src/
  main.jsx               React bootstrap
  App.jsx                Shared state and panel layout
  styles.css             Original styling, preserved
  components/
    Header.jsx
    Panel.jsx
    LevelRing.jsx        Analyser canvas + record button
    RecorderPanel.jsx
    AudioToTextPanel.jsx
    TranscriptPanel.jsx
    StudyToolsPanel.jsx
    Flashcards.jsx
    Exam.jsx
  hooks/
    useRecorder.js       Mic/tab capture, MediaRecorder, SpeechRecognition
    useTranscriber.js    Whisper job state, progress, subtitles
  lib/
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
