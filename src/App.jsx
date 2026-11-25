import { useCallback, useEffect, useRef, useState } from 'react';
import AudioToTextPanel from './components/AudioToTextPanel.jsx';
import Header from './components/Header.jsx';
import RecorderPanel from './components/RecorderPanel.jsx';
import StudyToolsPanel from './components/StudyToolsPanel.jsx';
import TranscriptPanel from './components/TranscriptPanel.jsx';
import { useRecorder } from './hooks/useRecorder.js';
import { useTranscriber } from './hooks/useTranscriber.js';
import store from './lib/storage.js';

const DEFAULT_RECORDING_SETTINGS = {
  mic: true,
  sys: false,
  raw: true,
  live: true,
  deviceId: '',
  lang: '',
};

const DEFAULT_FILE_SETTINGS = {
  model: 'Xenova/whisper-small',
  task: 'transcribe',
  language: '',
  timestamps: false,
  enhance: true,
};

export default function App() {
  const [title, setTitle] = useState(() => store.get('lr_draft', null)?.t ?? '');
  const [text, setText] = useState(() => store.get('lr_draft', null)?.x ?? '');
  const [notes, setNotes] = useState(() => {
    const saved = store.get('lr_notes', []);
    return Array.isArray(saved) ? saved : [];
  });
  const [recordingSettings, setRecordingSettings] = useState(DEFAULT_RECORDING_SETTINGS);
  const [fileSettings, setFileSettings] = useState(DEFAULT_FILE_SETTINGS);
  const [scrollSignal, setScrollSignal] = useState(0);

  const textRef = useRef(text);
  textRef.current = text;
  const titleRef = useRef(title);
  titleRef.current = title;
  const sessionStartRef = useRef(0);

  const handleSessionStart = useCallback(() => {
    sessionStartRef.current = textRef.current.length;
  }, []);

  const handleAppend = useCallback((chunk) => {
    if (!chunk) return;
    setText((current) => current + (current && !/\s$/.test(current) ? ' ' : '') + chunk);
    setScrollSignal((current) => current + 1);
  }, []);

  const recorder = useRecorder({
    onAppend: handleAppend,
    onSessionStart: handleSessionStart,
  });

  const applyResult = useCallback((transcript, { name, replace, startIndex }) => {
    setTitle((current) => {
      if (current.trim()) return current;
      if (name === 'Recording') return current;
      return name.replace(/\.[^.]+$/, '');
    });

    setText((current) => {
      if (replace && startIndex <= current.length) {
        const head = current.slice(0, startIndex).replace(/\s+$/, '');
        return head + (startIndex ? '\n\n' : '') + transcript;
      }
      return current + (current ? '\n\n' : '') + transcript;
    });
  }, []);

  const getBaseName = useCallback(() => titleRef.current, []);

  const transcriber = useTranscriber({ applyResult, getBaseName });

  useEffect(() => {
    store.set('lr_draft', { t: title, x: text });
  }, [title, text]);

  const updateRecordingSettings = (patch) =>
    setRecordingSettings((current) => ({ ...current, ...patch }));

  const updateFileSettings = (patch) => setFileSettings((current) => ({ ...current, ...patch }));

  function transcribeFile(file) {
    transcriber.transcribe(file, file.name, {
      settings: fileSettings,
      recorderLang: recordingSettings.lang,
    });
  }

  function retranscribeRecording(blob) {
    transcriber.transcribe(blob, 'Recording', {
      settings: fileSettings,
      recorderLang: recordingSettings.lang,
      replace: true,
      startIndex: sessionStartRef.current,
    });
  }

  function saveNote() {
    if (!text.trim()) {
      recorder.setMessage('Write or record something before saving.');
      return;
    }
    const next = [
      { id: Date.now(), t: title.trim(), x: text, d: new Date().toLocaleString() },
      ...notes,
    ];
    setNotes(next);
    store.set('lr_notes', next);
    recorder.setMessage('Note saved in this browser.');
  }

  function deleteNote(id) {
    const next = notes.filter((note) => note.id !== id);
    setNotes(next);
    store.set('lr_notes', next);
  }

  function openNote(note) {
    setTitle(note.t);
    setText(note.x);
  }

  return (
    <>
      <Header />

      <main className="wrap">
        <div className="col">
          <RecorderPanel
            recorder={recorder}
            settings={recordingSettings}
            onSettingsChange={updateRecordingSettings}
            onRetranscribe={retranscribeRecording}
            transcriberBusy={transcriber.busy}
          />
          <AudioToTextPanel
            settings={fileSettings}
            onSettingsChange={updateFileSettings}
            transcriber={transcriber}
            onTranscribe={transcribeFile}
          />
        </div>

        <div className="col">
          <TranscriptPanel
            title={title}
            text={text}
            setTitle={setTitle}
            setText={setText}
            notes={notes}
            onSave={saveNote}
            onOpenNote={openNote}
            onDeleteNote={deleteNote}
            notify={recorder.setMessage}
            scrollSignal={scrollSignal}
          />
          <StudyToolsPanel
            text={text}
            title={title}
            setText={setText}
            notify={recorder.setMessage}
          />
        </div>
      </main>

      <footer className="foot">FreillDe SpeechText</footer>
    </>
  );
}
