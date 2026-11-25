import { useEffect, useRef } from 'react';

export default function LevelRing({ status, onRecord, analyserRef, levelRef }) {
  const canvasRef = useRef(null);
  const liveRef = useRef(status === 'rec');
  liveRef.current = status === 'rec';

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const data = new Uint8Array(64);
    let frame = 0;

    const draw = (time) => {
      frame = requestAnimationFrame(draw);

      const width = 360;
      const center = width / 2;
      const bars = 120;
      context.clearRect(0, 0, width, width);

      const analyser = analyserRef.current;
      const live = analyser && liveRef.current;
      if (live) analyser.getByteFrequencyData(data);

      let sum = 0;
      context.lineCap = 'round';
      context.lineWidth = 3.2;

      for (let i = 0; i < bars; i += 1) {
        const angle = (i / bars) * Math.PI * 2;
        const k = Math.abs(i - bars / 2) / (bars / 2);
        const value = live ? data[Math.floor(k * 40)] / 255 : 0;
        sum += value;

        const wobble = calm ? 0 : Math.sin(time / 600 + i * 0.35) * 1.6;
        const length = 7 + value * 40 + wobble;
        const r0 = 96;
        context.strokeStyle = `hsl(${42 - value * 10},90%,${48 + value * 14}%)`;
        context.beginPath();
        context.moveTo(center + Math.cos(angle) * r0, center + Math.sin(angle) * r0);
        context.lineTo(
          center + Math.cos(angle) * (r0 + length),
          center + Math.sin(angle) * (r0 + length)
        );
        context.stroke();
      }

      if (levelRef.current) {
        levelRef.current.style.width = `${Math.min(100, (sum / bars) * 260)}%`;
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyserRef, levelRef]);

  const active = status !== 'idle';

  return (
    <div className="ring">
      <canvas ref={canvasRef} id="cv" width="360" height="360" />
      <button
        type="button"
        id="recBtn"
        className={active ? 'on' : undefined}
        aria-label="Record"
        disabled={active}
        onClick={onRecord}
      >
        <i />
      </button>
    </div>
  );
}
