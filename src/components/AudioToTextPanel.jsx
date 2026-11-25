import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, MODELS } from '../lib/languages.js';
import { hms } from '../lib/time.js';
import Panel from './Panel.jsx';

const isAudioOrVideo = (file) =>
  /^(audio|video)\//.test(file.type) ||
  /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba|webm|mp4|m4v|mov|mkv|3gp|amr|wma)$/i.test(file.name);

export default function AudioToTextPanel({
  settings,
  onSettingsChange,
  transcriber,
  onTranscribe,
}) {
  const [pick, setPick] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [sizeMb, setSizeMb] = useState(null);
  const [duration, setDuration] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const urlRef = useRef(null);
  const pickRef = useRef(null);

  const busy = transcriber.busy;
  const update = (patch) => onSettingsChange(patch);

  function setFile(file) {
    if (!file) return;

    if (busy) {
      transcriber.setMessage('Wait for the current transcription to finish, or press Cancel first.');
      return;
    }
    if (!isAudioOrVideo(file)) {
      transcriber.setMessage(
        'That file is not audio or video. Choose MP3, WAV, M4A, MP4, WebM, OGG, FLAC and similar files.'
      );
      return;
    }

    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    pickRef.current = file;

    setPick(file);
    setFileUrl(url);
    setSizeMb((file.size / 1048576).toFixed(1));
    setDuration(null);

    transcriber.setMessage(
      file.size > 314572800
        ? 'Large file selected. Decoding may use a lot of memory; if it fails, extract the audio to MP3 first.'
        : 'File selected. You can transcribe it or delete it.'
    );
  }

  function deleteFile() {
    if (busy) return;

    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    pickRef.current = null;
    setPick(null);
    setFileUrl(null);
    setSizeMb(null);
    setDuration(null);
    if (inputRef.current) inputRef.current.value = '';
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    transcriber.reset();
  }

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!busy) setDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    setFile(event.dataTransfer.files[0]);
  };

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const fileLabel = pick
    ? `${pick.name} (${sizeMb} MB${duration != null ? ` · ${hms(duration)}` : ''})`
    : 'Drop an audio or video file here, or click to choose';

  return (
    <Panel title="02 / Audio to text">
      <label
        className={`drop${dragOver ? ' over' : ''}`}
        id="drop"
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          id="file"
          accept="audio/*,video/*"
          disabled={busy}
          onChange={(event) => setFile(event.target.files[0])}
        />
        <span id="fname">{fileLabel}</span>
      </label>

      <div className="file-actions">
        {pick && (
          <button
            type="button"
            className="btn delete-file"
            id="deleteFile"
            aria-label="Delete uploaded file"
            disabled={busy}
            onClick={deleteFile}
          >
            ✕ Delete uploaded file
          </button>
        )}
      </div>

      {fileUrl && (
        <video
          ref={videoRef}
          id="prev"
          controls
          src={fileUrl}
          onLoadedMetadata={(event) => {
            if (
              pickRef.current &&
              urlRef.current === event.currentTarget.currentSrc &&
              Number.isFinite(event.currentTarget.duration)
            ) {
              setDuration(event.currentTarget.duration);
            }
          }}
          style={{ width: '100%', maxHeight: 220, marginTop: 12, borderRadius: 14 }}
        />
      )}

      <div className="row" style={{ alignItems: 'center' }}>
        <select
          id="flang"
          aria-label="Audio language"
          value={settings.language}
          onChange={(event) => update({ language: event.target.value })}
        >
          <option value="">Same as recorder</option>
          <option value="auto">Auto-detect language</option>
          {LANGUAGES.filter((language) => language.value !== '').map((language) => (
            <option key={language.value} value={language.value}>
              {language.label}
            </option>
          ))}
        </select>

        <select
          id="model"
          aria-label="Accuracy"
          value={settings.model}
          onChange={(event) => update({ model: event.target.value })}
        >
          {MODELS.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </select>

        <select
          id="task"
          aria-label="Task"
          value={settings.task}
          onChange={(event) => update({ task: event.target.value })}
        >
          <option value="transcribe">Transcribe (same language)</option>
          <option value="translate">Translate to English</option>
        </select>

        <label className="chip">
          <input
            type="checkbox"
            id="ts"
            checked={settings.timestamps}
            onChange={(event) => update({ timestamps: event.target.checked })}
          />
          Timestamps
        </label>

        <label
          className="chip"
          title="High-pass filter, gentle compression and volume normalising for clearer speech"
        >
          <input
            type="checkbox"
            id="enh"
            checked={settings.enhance}
            onChange={(event) => update({ enhance: event.target.checked })}
          />
          Enhance audio
        </label>

        <button
          type="button"
          className="btn gold"
          id="goFile"
          disabled={busy}
          onClick={() => {
            if (!pick) {
              transcriber.setMessage('Choose an audio or video file first.');
              return;
            }
            onTranscribe(pick);
          }}
        >
          Transcribe file
        </button>

        {busy && (
          <button
            type="button"
            className="btn delete-file"
            id="cancelFile"
            onClick={transcriber.cancel}
          >
            ✕ Cancel
          </button>
        )}
      </div>

      {transcriber.segments.length > 0 && (
        <div className="row" id="fexp">
          <button type="button" className="btn" id="dlSrt" onClick={() => transcriber.downloadSubtitles('srt')}>
            Download .srt subtitles
          </button>
          <button type="button" className="btn" id="dlVtt" onClick={() => transcriber.downloadSubtitles('vtt')}>
            Download .vtt subtitles
          </button>
        </div>
      )}

      <div className="bar">
        <b id="fprog" style={{ width: `${transcriber.progress}%` }} />
      </div>
      <div className="msg" id="fmsg">
        {transcriber.message}
      </div>
    </Panel>
  );
}
