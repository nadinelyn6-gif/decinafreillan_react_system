import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareAudio } from '../lib/audio.js';
import { createAsrRunner } from '../lib/asr.js';
import { download, fmtText, subtitleText, tidy } from '../lib/text.js';
import { hms, mmss } from '../lib/time.js';
import { WHISPER_LANGUAGES } from '../lib/languages.js';

const DEFAULT_MESSAGE =
  'Pick the language spoken in the audio; accuracy is best when it matches. Works with MP3, WAV, M4A, MP4, WebM and more. The first run downloads the speech model, so you need internet once.';

export function useTranscriber({ applyResult, getBaseName }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [segments, setSegments] = useState([]);
  const [baseName, setBaseName] = useState('transcript');

  const busyRef = useRef(false);
  const cancelledRef = useRef(false);
  const runnerRef = useRef(null);

  const applyRef = useRef(applyResult);
  const baseNameRef = useRef(getBaseName);
  useEffect(() => {
    applyRef.current = applyResult;
  }, [applyResult]);
  useEffect(() => {
    baseNameRef.current = getBaseName;
  }, [getBaseName]);

  const getRunner = () => {
    if (!runnerRef.current) runnerRef.current = createAsrRunner();
    return runnerRef.current;
  };

  const transcribe = useCallback(async (src, name, options = {}) => {
    if (busyRef.current) return;

    const { settings, recorderLang = '', replace = false, startIndex = 0 } = options;
    busyRef.current = true;
    cancelledRef.current = false;
    setBusy(true);
    setProgress(2);
    setSegments([]);

    try {
      setMessage('Reading and decoding audio…');
      const { pcm, duration } = await prepareAudio(src, settings.enhance);
      if (cancelledRef.current) throw new Error('cancelled');

      const task = settings.task;
      const selection = settings.language;
      const auto = selection === 'auto';
      const code = (selection || recorderLang || navigator.language || 'en').split('-')[0].toLowerCase();
      const language = auto ? null : WHISPER_LANGUAGES[code] || 'english';

      let model = settings.model;
      const englishOnly =
        !auto &&
        task === 'transcribe' &&
        language === 'english' &&
        /whisper-(tiny|base|small)$/.test(model);
      if (englishOnly) model += '.en';

      const asrOptions = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true };
      if (!englishOnly) {
        if (language) asrOptions.language = language;
        asrOptions.task = task;
      }
      if (/small/.test(model)) asrOptions.num_beams = 4;
      else if (/base/.test(model)) asrOptions.num_beams = 3;

      const total = Math.max(1, Math.ceil(Math.max(0, duration - 30) / 20) + 1);
      const label = language || 'auto-detected language';
      let done = 0;
      let runStarted = Date.now();

      setProgress(8);

      const output = await getRunner().run(model, pcm, asrOptions, (event) => {
        if (cancelledRef.current) return;

        if (event.type === 'status') {
          setMessage(
            event.s === 'engine'
              ? 'Loading speech engine…'
              : event.s === 'model'
                ? 'Loading speech model…'
                : `Transcribing ${hms(duration)} of audio (${label})… keep this tab open.`
          );
          if (event.s === 'run') {
            runStarted = Date.now();
            setProgress(40);
          }
        } else if (event.type === 'dl') {
          setProgress(8 + event.pct * 0.32);
          setMessage(`Downloading model… ${Math.round(event.pct)}% (first run only)`);
        } else if (event.type === 'chunk') {
          done += 1;
          const left = ((Date.now() - runStarted) / 1000 / done) * Math.max(0, total - done);
          setProgress(40 + Math.min(done / total, 1) * 58);
          setMessage(
            `Transcribing… part ${Math.min(done, total)} of ~${total}${
              done < total ? ` · about ${mmss(left)} left` : ' · finishing up'
            }`
          );
        }
      });

      const segmentList = tidy(output.chunks, duration);
      const text = segmentList.length
        ? fmtText(segmentList, settings.timestamps, duration)
        : (output.text || '').trim();
      if (!text) throw new Error('No speech was detected in this audio.');

      applyRef.current(text, { name, replace, startIndex });
      setSegments(segmentList);

      const fallbackName =
        name !== 'Recording' ? name.replace(/\.[^.]+$/, '') : 'transcript';
      const base = (baseNameRef.current() || fallbackName).replace(/[^\w\- ]+/g, '');
      setBaseName(base || 'transcript');

      setProgress(100);
      setMessage(
        `Done. ${text.split(/\s+/).length} words were added to your notes.${
          segmentList.length ? ' Subtitle files (.srt / .vtt) are available below.' : ''
        }`
      );
    } catch (error) {
      setProgress(0);
      setSegments([]);
      setMessage(
        error.message === 'cancelled'
          ? 'Cancelled.'
          : `Could not transcribe this audio: ${
              error.message || error
            }. Check your internet connection (needed for the first run), or try a shorter file or another format such as MP3 or MP4.`
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (!busyRef.current) return;
    cancelledRef.current = true;
    if (runnerRef.current) runnerRef.current.cancel();
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setSegments([]);
    setMessage('Pick an audio or video file to transcribe.');
  }, []);

  const downloadSubtitles = useCallback(
    (kind) => {
      if (!segments.length) {
        setMessage('Transcribe something first.');
        return;
      }
      const vtt = kind === 'vtt';
      download(
        `${baseName || 'transcript'}.${kind}`,
        `${vtt ? 'WEBVTT\n\n' : ''}${subtitleText(segments, kind)}\n`
      );
    },
    [segments, baseName]
  );

  useEffect(() => {
    const handler = (event) => {
      if (busyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(
    () => () => {
      if (runnerRef.current) runnerRef.current.dispose();
    },
    []
  );

  return {
    busy,
    progress,
    message,
    setMessage,
    segments,
    transcribe,
    cancel,
    reset,
    downloadSubtitles,
  };
}
