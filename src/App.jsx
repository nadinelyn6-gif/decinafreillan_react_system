import { useCallback, useEffect, useRef, useState } from 'react';
import AudioToTextPanel from './components/AudioToTextPanel.jsx';
import Header from './components/Header.jsx';
import LoginPage from './components/LoginPage.jsx';
import RecorderPanel from './components/RecorderPanel.jsx';
import StudyToolsPanel from './components/StudyToolsPanel.jsx';
import TasksPanel from './components/TasksPanel.jsx';
import TranscriptPanel from './components/TranscriptPanel.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useRecorder } from './hooks/useRecorder.js';
import { useTranscriber } from './hooks/useTranscriber.js';
import api from './lib/api.js';
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

function readLocalDraft(key) {
  const value = store.get(key, null);
  return {
    t: typeof value?.t === 'string' ? value.t : '',
    x: typeof value?.x === 'string' ? value.x : '',
    u: Number(value?.u) || 0,
  };
}

function readLocalNotes(key) {
  const saved = store.get(key, []);
  return Array.isArray(saved) ? saved : [];
}

function readLocalTasks(key) {
  const saved = store.get(key, []);
  return Array.isArray(saved) ? saved : [];
}

function makeLocalTask(t, done = false) {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    t,
    done,
    createdAt: now,
    updatedAt: now,
  };
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { status, logout } = useAuth();

  if (status === 'restoring') {
    return <div className="route-loading">Restoring your session…</div>;
  }
  if (status !== 'signed-in') return <LoginPage />;
  return <Workspace onLogout={logout} />;
}

function Workspace({ onLogout }) {
  const { user } = useAuth();

  // Browser-cache keys are scoped by account so one user's offline copy can
  // never be picked up by another user.
  const draftKey = `lr_draft:${user.id}`;
  const notesKey = `lr_notes:${user.id}`;
  const tasksKey = `lr_tasks:${user.id}`;

  const [initialDraft] = useState(() => readLocalDraft(draftKey));
  const [title, setTitle] = useState(initialDraft.t);
  const [text, setText] = useState(initialDraft.x);
  const [notes, setNotes] = useState(() => readLocalNotes(notesKey));
  const [tasks, setTasks] = useState(() => readLocalTasks(tasksKey));
  const [tasksBusy, setTasksBusy] = useState(false);
  const [recordingSettings, setRecordingSettings] = useState(DEFAULT_RECORDING_SETTINGS);
  const [fileSettings, setFileSettings] = useState(DEFAULT_FILE_SETTINGS);
  const [scrollSignal, setScrollSignal] = useState(0);
  const [serverState, setServerState] = useState('checking');

  const textRef = useRef(text);
  textRef.current = text;
  const titleRef = useRef(title);
  titleRef.current = title;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const sessionStartRef = useRef(0);
  const touchedRef = useRef(false);
  const adoptedRef = useRef(false);
  const adoptedTasksRef = useRef(false);
  const tasksLoadedRef = useRef(false);
  const tasksSyncedRef = useRef(false);

  const updateTitle = useCallback((value) => {
    touchedRef.current = true;
    setTitle(value);
  }, []);

  const updateText = useCallback((value) => {
    touchedRef.current = true;
    setText(value);
  }, []);

  const handleSessionStart = useCallback(() => {
    sessionStartRef.current = textRef.current.length;
  }, []);

  const handleAppend = useCallback((chunk) => {
    if (!chunk) return;
    touchedRef.current = true;
    setText((current) => current + (current && !/\s$/.test(current) ? ' ' : '') + chunk);
    setScrollSignal((current) => current + 1);
  }, []);

  const recorder = useRecorder({
    onAppend: handleAppend,
    onSessionStart: handleSessionStart,
  });

  const applyResult = useCallback((transcript, { name, replace, startIndex }) => {
    touchedRef.current = true;

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

  // Load this account's draft, notes and tasks from the backend. The browser
  // copy is used immediately so the app still works when the server is offline.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [draft, serverNotes, serverTasks] = await Promise.all([
          api.getDraft(),
          api.listNotes(),
          api.listTasks(),
        ]);
        if (cancelled) return;

        setServerState('online');

        // Adopt notes that were saved while the server was offline. The ref
        // keeps React StrictMode's double-run from uploading them twice.
        const localNotes = readLocalNotes(notesKey);
        const pending = adoptedRef.current
          ? []
          : localNotes.filter(
              (note) =>
                String(note.id).startsWith('local-') ||
                (serverNotes.length === 0 && !serverNotes.some((item) => item.id === note.id))
            );

        let syncedNotes = serverNotes;
        if (pending.length) {
          adoptedRef.current = true;
          const uploaded = [];
          let failed = false;
          for (const note of pending) {
            try {
              uploaded.push(await api.createNote({ t: note.t, x: note.x }));
            } catch {
              uploaded.push(note);
              failed = true;
            }
          }
          if (cancelled) return;
          syncedNotes = [...uploaded, ...serverNotes];
          if (failed) {
            adoptedRef.current = false;
            setServerState('offline');
          }
        }

        setNotes(syncedNotes);
        store.set(notesKey, syncedNotes);

        // Tasks created while offline are uploaded once the server is reachable.
        const localTasks = readLocalTasks(tasksKey);
        const pendingTasks = adoptedTasksRef.current
          ? []
          : localTasks.filter((task) => String(task.id).startsWith('local-'));

        let syncedTasks = serverTasks;
        if (pendingTasks.length) {
          adoptedTasksRef.current = true;
          const uploaded = [];
          let failed = false;
          for (const task of pendingTasks) {
            try {
              uploaded.push(
                await api.createTask({ t: task.t, done: Boolean(task.done) })
              );
            } catch {
              uploaded.push(task);
              failed = true;
            }
          }
          if (cancelled) return;
          syncedTasks = [...uploaded, ...serverTasks];
          if (failed) {
            adoptedTasksRef.current = false;
            setServerState('offline');
          }
        }

        setTasks(syncedTasks);
        store.set(tasksKey, syncedTasks);
        tasksLoadedRef.current = true;

        if (touchedRef.current) return;

        const serverTime = Date.parse(draft.updatedAt || '') || 0;
        const hasLocal = Boolean(initialDraft.t || initialDraft.x);
        const useServer = !hasLocal || serverTime >= initialDraft.u;

        if (useServer) {
          setTitle(draft.t);
          setText(draft.x);
        } else {
          // The local draft is newer (for example, it was written offline).
          api.saveDraft({ t: initialDraft.t, x: initialDraft.x }).catch(() =>
            setServerState('offline')
          );
        }
      } catch {
        if (!cancelled) setServerState('offline');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftKey, notesKey, tasksKey, initialDraft]);

  // Cache the draft in the browser on every change and push it to the server
  // after a short pause in typing.
  useEffect(() => {
    if (serverState === 'checking' && !touchedRef.current) return undefined;

    store.set(draftKey, { t: title, x: text, u: Date.now() });

    if (serverState !== 'online') return undefined;

    const timer = setTimeout(() => {
      api.saveDraft({ t: title, x: text }).catch(() => setServerState('offline'));
    }, 700);

    return () => clearTimeout(timer);
  }, [draftKey, title, text, serverState]);

  // Keep a browser copy of the tasks so they survive a reload or an outage.
  useEffect(() => {
    store.set(tasksKey, tasks);
  }, [tasksKey, tasks]);

  // While offline, check periodically whether the backend is back.
  useEffect(() => {
    if (serverState !== 'offline') return undefined;

    const timer = setInterval(() => {
      api.health().then(
        () => setServerState('online'),
        () => {}
      );
    }, 15000);

    return () => clearInterval(timer);
  }, [serverState]);

  // When the backend comes back online, upload tasks that were added offline.
  useEffect(() => {
    if (serverState !== 'online') {
      tasksSyncedRef.current = false;
      return;
    }
    if (!tasksLoadedRef.current || tasksSyncedRef.current) return;

    tasksSyncedRef.current = true;
    const pending = tasksRef.current.filter((task) => String(task.id).startsWith('local-'));
    if (!pending.length) return;

    (async () => {
      const uploaded = [];
      let failed = false;
      for (const task of pending) {
        try {
          uploaded.push(await api.createTask({ t: task.t, done: Boolean(task.done) }));
        } catch {
          uploaded.push(task);
          failed = true;
        }
      }
      setTasks((current) => [
        ...uploaded,
        ...current.filter((task) => !pending.some((item) => item.id === task.id)),
      ]);
      if (failed) setServerState('offline');
    })();
  }, [serverState]);

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

  async function saveNote() {
    if (!text.trim()) {
      recorder.setMessage('Write or record something before saving.');
      return;
    }

    const payload = { t: title.trim(), x: text };

    try {
      const note = await api.createNote(payload);
      setServerState('online');
      setNotes((current) => {
        const next = [note, ...current];
        store.set(notesKey, next);
        return next;
      });
      recorder.setMessage('Note saved to the server.');
    } catch {
      const now = new Date().toISOString();
      const note = { id: `local-${Date.now()}`, ...payload, createdAt: now, updatedAt: now };
      setNotes((current) => {
        const next = [note, ...current];
        store.set(notesKey, next);
        return next;
      });
      setServerState('offline');
      recorder.setMessage('Server unavailable — note saved in this browser.');
    }
  }

  async function deleteNote(id) {
    setNotes((current) => {
      const next = current.filter((note) => note.id !== id);
      store.set(notesKey, next);
      return next;
    });

    if (String(id).startsWith('local-')) return;

    try {
      await api.deleteNote(id);
    } catch (error) {
      if (error.status === 404) return;
      setServerState('offline');
      recorder.setMessage('Server unavailable — note removed from this browser only.');
    }
  }

  function openNote(note) {
    updateTitle(note.t);
    updateText(note.x);
  }

  async function addTask(taskTitle) {
    setTasksBusy(true);
    try {
      const task = await api.createTask({ t: taskTitle, done: false });
      setServerState('online');
      setTasks((current) => [task, ...current]);
      return true;
    } catch {
      setTasks((current) => [makeLocalTask(taskTitle), ...current]);
      setServerState('offline');
      recorder.setMessage('Server unavailable — task saved in this browser.');
      return true;
    } finally {
      setTasksBusy(false);
    }
  }

  async function toggleTask(id) {
    const existing = tasksRef.current.find((task) => task.id === id);
    if (!existing) return;

    const done = !existing.done;
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done } : task))
    );
    if (String(id).startsWith('local-')) return;

    try {
      await api.updateTask(id, { done });
      setServerState('online');
    } catch {
      setServerState('offline');
      recorder.setMessage('Server unavailable — task change kept in this browser.');
    }
  }

  async function renameTask(id, taskTitle) {
    const value = taskTitle.trim();
    if (!value) return false;

    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, t: value } : task))
    );
    if (String(id).startsWith('local-')) return true;

    try {
      await api.updateTask(id, { t: value });
      setServerState('online');
      return true;
    } catch {
      setServerState('offline');
      recorder.setMessage('Server unavailable — task change kept in this browser.');
      return true;
    }
  }

  async function deleteTask(id) {
    const existing = tasksRef.current.find((task) => task.id === id);
    const index = tasksRef.current.findIndex((task) => task.id === id);
    setTasks((current) => current.filter((task) => task.id !== id));
    if (!existing || String(id).startsWith('local-')) return;

    try {
      await api.deleteTask(id);
      setServerState('online');
    } catch (error) {
      if (error.status !== 404) {
        setTasks((current) => {
          const next = [...current];
          next.splice(Math.min(index, next.length), 0, existing);
          return next;
        });
        setServerState('offline');
        recorder.setMessage('Server unavailable — task restored in this browser.');
      }
    }
  }

  async function clearDone() {
    const done = tasksRef.current.filter((task) => task.done);
    if (!done.length) return;

    setTasks((current) => current.filter((task) => !task.done));
    const serverIds = done
      .filter((task) => !String(task.id).startsWith('local-'))
      .map((task) => task.id);
    if (!serverIds.length) return;

    const results = await Promise.allSettled(serverIds.map((id) => api.deleteTask(id)));
    const failedIds = new Set(
      serverIds.filter((_id, index) => results[index].status === 'rejected')
    );
    if (failedIds.size) {
      setTasks((current) => [
        ...done.filter((task) => failedIds.has(task.id)),
        ...current,
      ]);
      setServerState('offline');
      recorder.setMessage('Server unavailable — some completed tasks were restored.');
    } else {
      setServerState('online');
    }
  }

  return (
    <>
      <Header serverState={serverState} user={user} onLogout={onLogout} />

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
            setTitle={updateTitle}
            setText={updateText}
            notes={notes}
            onSave={saveNote}
            onOpenNote={openNote}
            onDeleteNote={deleteNote}
            notify={recorder.setMessage}
            scrollSignal={scrollSignal}
            serverState={serverState}
          />
          <StudyToolsPanel
            text={text}
            title={title}
            setText={updateText}
            notify={recorder.setMessage}
          />
          <TasksPanel
            tasks={tasks}
            busy={tasksBusy}
            onAdd={addTask}
            onToggle={toggleTask}
            onRename={renameTask}
            onDelete={deleteTask}
            onClearDone={clearDone}
            notify={recorder.setMessage}
          />
        </div>
      </main>

      <footer className="foot">FreillDe SpeechText</footer>
    </>
  );
}
