import { useEffect, useRef, useState } from 'react';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const READY_MESSAGE =
  'Ready for live transcription. Choose your language below, then press Record.';

export function useRecorder({ onAppend, onSessionStart }) {
  const [status, setStatus] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [interim, setInterim] = useState('');
  const [label, setLabel] = useState('READY');
  const [take, setTake] = useState(null);
  const [devices, setDevices] = useState([]);
  const [message, setMessage] = useState(() =>
    SR
      ? READY_MESSAGE
      : 'Live transcription needs Chrome, Edge or Safari. Recording and file transcription still work here.'
  );

  const statusRef = useRef('idle');
  const accRef = useRef(0);
  const t0Ref = useRef(0);
  const recRef = useRef(null);
  const mrRef = useRef(null);
  const streamsRef = useRef([]);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const chunksRef = useRef([]);
  const fastFailsRef = useRef(0);
  const optionsRef = useRef(null);
  const takeUrlRef = useRef(null);

  const appendRef = useRef(onAppend);
  const sessionStartRef = useRef(onSessionStart);
  useEffect(() => {
    appendRef.current = onAppend;
  }, [onAppend]);
  useEffect(() => {
    sessionStartRef.current = onSessionStart;
  }, [onSessionStart]);

  const updateStatus = (next) => {
    statusRef.current = next;
    setStatus(next);
  };

  async function refreshDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === 'audioinput' && device.deviceId
      );
      setDevices(
        list.map((device, i) => ({
          id: device.deviceId,
          label: device.label || `Microphone ${i + 1}`,
        }))
      );
    } catch {
      /* permissions may not be granted yet */
    }
  }

  function cleanup() {
    streamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    streamsRef.current = [];
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    analyserRef.current = null;
  }

  function clearTake() {
    if (takeUrlRef.current) {
      URL.revokeObjectURL(takeUrlRef.current);
      takeUrlRef.current = null;
    }
    setTake(null);
  }

  function finish() {
    const recorder = mrRef.current;
    const type = (recorder && recorder.mimeType) || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type });
    const url = URL.createObjectURL(blob);
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';

    if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
    takeUrlRef.current = url;
    setTake({ blob, url, ext, duration: accRef.current });
  }

  function startRec(options) {
    if (!SR || !options.live) return;

    const recognition = new SR();
    const born = Date.now();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = options.lang || navigator.language || 'en-US';
    recognition.pending = '';
    recognition.next = 0;

    recognition.onresult = (event) => {
      let interimText = '';
      for (let k = event.resultIndex; k < event.results.length; k += 1) {
        const result = event.results[k];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          if (k >= recognition.next) {
            appendRef.current(transcript.trim());
            recognition.next = k + 1;
          }
        } else {
          interimText += transcript;
        }
      }
      recognition.pending = interimText.trim();
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        recognition.dead = true;
        setMessage('Speech recognition is blocked. Allow microphone access for this page.');
      } else if (event.error === 'language-not-supported') {
        recognition.dead = true;
        setMessage('That language is not supported by your browser’s speech recognition.');
      } else if (event.error === 'network') {
        setMessage(
          'Speech service unreachable. Check your internet connection; recording continues.'
        );
      }
    };

    recognition.onend = () => {
      if (recognition.pending) {
        appendRef.current(recognition.pending);
        recognition.pending = '';
      }
      setInterim('');
      if (statusRef.current === 'rec' && !recognition.dead) {
        fastFailsRef.current = Date.now() - born < 400 ? fastFailsRef.current + 1 : 0;
        if (fastFailsRef.current > 8) {
          setMessage('Live transcription keeps stopping. Use “Re-transcribe fully” after you stop.');
          return;
        }
        setTimeout(
          () => {
            if (statusRef.current === 'rec') startRec(optionsRef.current || options);
          },
          fastFailsRef.current ? 250 : 0
        );
      }
    };

    recRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* recognition may already be running */
    }
  }

  async function start(options) {
    if (statusRef.current !== 'idle') return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage('Audio capture is unavailable in this browser or context. Use HTTPS or localhost.');
      return;
    }

    optionsRef.current = options;

    try {
      const constraints = {
        echoCancellation: !options.raw,
        noiseSuppression: !options.raw,
        autoGainControl: !options.raw,
      };
      if (options.deviceId) constraints.deviceId = { exact: options.deviceId };

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      ctxRef.current = context;
      const destination = context.createMediaStreamDestination();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      let sources = 0;
      const hook = (stream) => {
        const source = context.createMediaStreamSource(stream);
        source.connect(destination);
        source.connect(analyser);
        sources += 1;
      };

      if (options.mic) {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
        streamsRef.current.push(micStream);
        hook(micStream);
        refreshDevices();
      }

      if (options.sys) {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streamsRef.current.push(displayStream);
        if (displayStream.getAudioTracks().length) {
          hook(new MediaStream(displayStream.getAudioTracks()));
        } else {
          setMessage('No audio was shared. Tick “Share tab audio” in the picker next time.');
        }
      }

      if (!sources) throw new Error('Choose Microphone or System / tab audio first.');

      chunksRef.current = [];
      const recorder = new MediaRecorder(destination.stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = finish;
      recorder.start(1000);
      mrRef.current = recorder;

      if (sessionStartRef.current) sessionStartRef.current();
      fastFailsRef.current = 0;
      accRef.current = 0;
      t0Ref.current = Date.now();
      updateStatus('rec');
      setSeconds(0);
      setLabel('RECORDING');
      setInterim('');
      clearTake();

      if (!SR) {
        setMessage(
          'Recording. Live transcription needs Chrome, Edge or Safari; use the file transcriber for other browsers.'
        );
      } else if (!options.live) {
        setMessage('Recording without live transcription.');
      } else if (options.sys && !options.mic) {
        setMessage(
          'Recording. Note: live transcription listens to your microphone, not the shared tab. Use file transcription for tab audio.'
        );
      } else {
        setMessage('Listening… speak clearly.');
      }

      startRec(options);
    } catch (error) {
      cleanup();
      updateStatus('idle');
      setMessage(
        error.name === 'NotAllowedError'
          ? 'Access was denied. Allow the microphone or screen-audio prompt and try again.'
          : error.message || 'Could not start recording.'
      );
    }
  }

  function pause() {
    if (statusRef.current === 'rec') {
      if (mrRef.current) mrRef.current.pause();
      accRef.current += (Date.now() - t0Ref.current) / 1000;
      updateStatus('pause');
      if (recRef.current) recRef.current.stop();
      setLabel('PAUSED');
      setMessage('Paused.');
    } else if (statusRef.current === 'pause') {
      if (mrRef.current) mrRef.current.resume();
      t0Ref.current = Date.now();
      updateStatus('rec');
      setLabel('RECORDING');
      setInterim('');
      startRec(optionsRef.current);
      setMessage('Listening…');
    }
  }

  function stop() {
    if (statusRef.current === 'idle') return;
    if (statusRef.current === 'rec') accRef.current += (Date.now() - t0Ref.current) / 1000;
    updateStatus('idle');
    if (recRef.current) recRef.current.stop();
    if (mrRef.current && mrRef.current.state !== 'inactive') mrRef.current.stop();
    cleanup();
    setSeconds(accRef.current);
    setLabel('DONE');
    setInterim('');
    setMessage('Stopped. Review the transcript, then save or export it.');
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (statusRef.current !== 'idle') {
        setSeconds(
          accRef.current +
            (statusRef.current === 'rec' ? (Date.now() - t0Ref.current) / 1000 : 0)
        );
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          /* not running */
        }
      }
      if (mrRef.current && mrRef.current.state !== 'inactive') {
        try {
          mrRef.current.stop();
        } catch {
          /* already stopped */
        }
      }
      cleanup();
      if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    status,
    seconds,
    interim,
    label,
    take,
    devices,
    message,
    setMessage,
    analyserRef,
    start,
    pause,
    stop,
    refreshDevices,
  };
}
