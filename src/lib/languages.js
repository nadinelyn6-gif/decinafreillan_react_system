export const LANGUAGES = [
  { value: '', label: 'Browser default' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-PH', label: 'English (Philippines)' },
  { value: 'fil-PH', label: 'Filipino' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese' },
  { value: 'nl-NL', label: 'Dutch' },
  { value: 'ru-RU', label: 'Russian' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'ko-KR', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese' },
  { value: 'ar-SA', label: 'Arabic' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'id-ID', label: 'Indonesian' },
  { value: 'vi-VN', label: 'Vietnamese' },
  { value: 'th-TH', label: 'Thai' },
  { value: 'tr-TR', label: 'Turkish' },
];

/* Whisper expects full language names instead of locale codes. */
export const WHISPER_LANGUAGES = {
  en: 'english',
  es: 'spanish',
  fr: 'french',
  de: 'german',
  it: 'italian',
  pt: 'portuguese',
  nl: 'dutch',
  ru: 'russian',
  ja: 'japanese',
  ko: 'korean',
  zh: 'chinese',
  ar: 'arabic',
  hi: 'hindi',
  tr: 'turkish',
  id: 'indonesian',
  fil: 'tagalog',
  tl: 'tagalog',
  vi: 'vietnamese',
  th: 'thai',
};

export const MODELS = [
  { value: 'Xenova/whisper-small', label: 'Best accuracy (small, ~250 MB)' },
  { value: 'Xenova/whisper-base', label: 'Balanced (base, ~75 MB)' },
  { value: 'Xenova/whisper-tiny', label: 'Fast (tiny, ~40 MB)' },
];

export const QUESTION_COUNTS = [5, 10, 15, 20];
