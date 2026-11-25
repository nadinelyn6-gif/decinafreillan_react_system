import { useRef } from 'react';
import { LANGUAGES } from '../lib/languages.js';
import { hms } from '../lib/time.js';
import LevelRing from './LevelRing.jsx';
import Panel from './Panel.jsx';

export default function RecorderPanel({
  recorder,
  settings,
  onSettingsChange,
  onRetranscribe,
  transcriberBusy,
}) {
  const levelRef = useRef(null);
  const update = (patch) => onSettingsChange(patch);

  return (
    <Panel title="01 / Lecture recorder">
      <LevelRing
        status={recorder.status}
        onRecord={() => recorder.start(settings)}
        analyserRef={recorder.analyserRef}
        levelRef={levelRef}
      />

      <div className="time" id="time">
        {hms(recorder.seconds)}
      </div>
      <div className="lbl" id="lbl">
        {recorder.label}
      </div>
      <div className="bar">
        <b id="lvl" ref={levelRef} />
      </div>
      <div className="msg" id="msg">
        {recorder.message}
      </div>
      <div className="int" id="interim">
        {recorder.interim}
      </div>

      <div className="ctl">
        <button
          type="button"
          className="round"
          id="pauseBtn"
          disabled={recorder.status === 'idle'}
          aria-label="Pause"
          onClick={recorder.pause}
        >
          {recorder.status === 'pause' ? '▶' : '❚❚'}
        </button>
        <button
          type="button"
          className="round"
          id="stopBtn"
          disabled={recorder.status === 'idle'}
          aria-label="Stop"
          onClick={recorder.stop}
        >
          ■
        </button>
      </div>

      <div className="chips">
        <label className="chip">
          <input
            type="checkbox"
            id="mic"
            checked={settings.mic}
            onChange={(event) => update({ mic: event.target.checked })}
          />
          Microphone
        </label>
        <label className="chip">
          <input
            type="checkbox"
            id="sys"
            checked={settings.sys}
            onChange={(event) => update({ sys: event.target.checked })}
          />
          System / tab audio
        </label>
        <label className="chip">
          <input
            type="checkbox"
            id="raw"
            checked={settings.raw}
            onChange={(event) => update({ raw: event.target.checked })}
          />
          Raw audio
        </label>

        <select
          id="dev"
          aria-label="Input device"
          value={settings.deviceId}
          onChange={(event) => update({ deviceId: event.target.value })}
        >
          <option value="">Default input</option>
          {recorder.devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label}
            </option>
          ))}
        </select>

        <label className="chip">
          <input
            type="checkbox"
            id="live"
            checked={settings.live}
            onChange={(event) => update({ live: event.target.checked })}
          />
          Live transcription
        </label>

        <select
          id="lang"
          aria-label="Language"
          value={settings.lang}
          onChange={(event) => update({ lang: event.target.value })}
        >
          {LANGUAGES.map((language) => (
            <option key={language.value} value={language.value}>
              {language.label}
            </option>
          ))}
        </select>
      </div>

      {recorder.take && (
        <div id="take" className="tip">
          Recording ready ({hms(recorder.take.duration)}):{' '}
          <a
            className="dl"
            download={`lecture-recording.${recorder.take.ext}`}
            href={recorder.take.url}
          >
            download audio
          </a>
          <audio controls src={recorder.take.url} />
          <div className="row">
            <button
              type="button"
              className="btn gold"
              id="trRec"
              disabled={transcriberBusy}
              onClick={() => onRetranscribe(recorder.take.blob)}
            >
              Re-transcribe fully (catches every word)
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
