export const pad = (n) => String(n).padStart(2, '0');

export const hms = (seconds) =>
  `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(Math.floor(seconds % 60))}`;

export const mmss = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

export const tc = (seconds, separator) => {
  const ms = Math.round(seconds * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(
    Math.floor(ms / 1000) % 60
  )}${separator}${String(ms % 1000).padStart(3, '0')}`;
};
