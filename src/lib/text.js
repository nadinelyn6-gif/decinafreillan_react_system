import { hms, tc } from './time.js';

const JUNK =
  /^[\s\[\(♪♫]*(blank[_ ]audio|silence|music|applause|laughter|inaudible|no speech)[\s\]\)♪♫.]*$|^(thanks for watching|thank you for watching|please subscribe.*|subtitles? by.*|subtitled by.*|amara\.org.*|transcribed by.*)[\s.!]*$/i;
const LOOP = /((?:[^\s,.!?]+)(?:\s+[^\s,.!?]+){0,7})(?:[\s,.!?]+\1(?=[\s,.!?]|$)){3,}/gi;

export function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function tidy(raw, duration) {
  const result = [];
  (raw || []).forEach((chunk) => {
    const text = (chunk.text || '')
      .replace(LOOP, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || JUNK.test(text)) return;
    if (result.length && result[result.length - 1].t.toLowerCase() === text.toLowerCase()) return;
    result.push({
      s: (chunk.timestamp && chunk.timestamp[0]) || 0,
      e: chunk.timestamp && chunk.timestamp[1],
      t: text,
    });
  });
  result.forEach((segment, i) => {
    if (segment.e == null || segment.e < segment.s) {
      segment.e = i + 1 < result.length ? result[i + 1].s : duration;
    }
  });
  return result;
}

export function fmtText(segments, timestamps, duration) {
  const timeline = (seconds) => (duration >= 3600 ? hms(seconds) : hms(seconds).slice(3));
  if (timestamps) return segments.map((segment) => `[${timeline(segment.s)}] ${segment.t}`).join('\n');

  let out = '';
  let length = 0;
  segments.forEach((segment) => {
    if (out && length > 450 && /[.!?。！？]$/.test(out.trim())) {
      out += '\n\n';
      length = 0;
    } else if (out) {
      out += ' ';
    }
    out += segment.t;
    length += segment.t.length;
  });
  return out;
}

export function subtitleText(segments, kind) {
  const vtt = kind === 'vtt';
  return segments
    .map(
      (segment, i) =>
        `${vtt ? '' : `${i + 1}\n`}${tc(segment.s, vtt ? '.' : ',')} --> ${tc(
          Math.max(segment.e, segment.s + 0.5),
          vtt ? '.' : ','
        )}\n${segment.t}`
    )
    .join('\n\n');
}
