import { useEffect, useRef } from 'react';
import { countWords } from '../lib/study.js';
import { download } from '../lib/text.js';
import Panel from './Panel.jsx';

function formatNoteDate(note) {
  const raw = note.createdAt || note.updatedAt;
  if (raw) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return note.d || '';
}

export default function TranscriptPanel({
  title,
  text,
  setTitle,
  setText,
  notes,
  onSave,
  onOpenNote,
  onDeleteNote,
  notify,
  scrollSignal,
  serverState = 'checking',
}) {
  const textareaRef = useRef(null);
  const wordCount = countWords(text);

  useEffect(() => {
    if (scrollSignal > 0 && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [scrollSignal]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
      }
    }
    notify('Copied to clipboard.');
  }

  function exportText() {
    if (!text.trim()) {
      notify('Nothing to export yet.');
      return;
    }
    const name = `${(title.trim() || 'lecture-notes').replace(/[^\w\- ]+/g, '')}.txt`;
    download(name, `${title ? `${title}\n\n` : ''}${text}`);
  }

  function clearAll() {
    if (text && !window.confirm('Clear the title and transcript?')) return;
    setTitle('');
    setText('');
  }

  return (
    <Panel
      title="03 / Transcript & notes"
      right={`${wordCount} ${wordCount === 1 ? 'word' : 'words'}`}
      rightId="wc"
    >
      <input
        type="text"
        id="title"
        placeholder="Note title (for example, Lecture, Week 3)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        ref={textareaRef}
        id="ta"
        placeholder="Your recognized lecture speech will appear here while recording. You can also type or edit notes…"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="row">
        <button type="button" className="btn gold" id="save" onClick={onSave}>
          Save note
        </button>
        <button type="button" className="btn" id="copy" onClick={copyText}>
          Copy
        </button>
        <button type="button" className="btn" id="exp" onClick={exportText}>
          Export .txt
        </button>
        <button type="button" className="btn" id="clear" onClick={clearAll}>
          Clear
        </button>
      </div>

      <div className="meta">
        <span id="rt">{Math.ceil(wordCount / 200)} min read</span>
        <span>
          {serverState === 'online'
            ? 'Draft autosaves to the server'
            : serverState === 'offline'
              ? 'Server offline — draft autosaves in this browser'
              : 'Draft autosaves automatically'}
        </span>
      </div>

      <div className="tip">
        Tip: allow microphone access, choose the language, then press Record. Final speech is added
        to this editor; you can correct the text before saving or exporting.
      </div>

      <div id="notes" style={{ marginTop: 14 }}>
        {notes.map((note) => (
          <div className="note" key={note.id}>
            <div>
              <b>{note.t || 'Untitled'}</b>
              <small>
                {[formatNoteDate(note), `${countWords(note.x)} words`].filter(Boolean).join(' · ')}
              </small>
            </div>
            <div className="row" style={{ margin: 0 }}>
              <button type="button" className="btn" onClick={() => onOpenNote(note)}>
                Open
              </button>
              <button type="button" className="btn" onClick={() => onDeleteNote(note.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
