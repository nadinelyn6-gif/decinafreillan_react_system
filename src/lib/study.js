const STOP = new Set(
  'the a an and or but if of to in on at by for with from as is are was were be been being it its this that these those i you he she we they them his her our your their my me not no so do does did have has had will would can could should may might just than then there here what which who whom when where why how about into over also very more most some any all each than too such like um uh yeah okay'.split(
    ' '
  )
);

export const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export const sents = (text) =>
  (text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]*/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);

export const words = (text) =>
  (text.toLowerCase().match(/[a-zà-ÿ'’]{3,}/g) || []).filter((word) => !STOP.has(word));

export function freq(text) {
  const result = {};
  words(text).forEach((word) => {
    result[word] = (result[word] || 0) + 1;
  });
  return result;
}

export const shuffle = (items) => {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const wd = (word) => word.replace(/[^\wà-ÿ'’]/g, '');
const cut = (text) => (text.length > 130 ? `${text.slice(0, 127)}…` : text);

const terms = (text) =>
  Object.entries(freq(text))
    .filter(([word]) => word.length >= 4)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map((entry) => entry[0]);

const facts = (text) =>
  sents(text).filter((sentence) => {
    const n = sentence.split(/\s+/).length;
    return n >= 6 && n <= 40;
  });

function defs(text) {
  const out = [];
  facts(text).forEach((sentence) => {
    const match = sentence.match(
      /^(?:the |a |an )?([A-Za-z][\w' -]{2,40}?)\s+(?:is|are|means|refers to|is called|is defined as|consists of)\s+(.{12,})$/i
    );
    if (match && !/^(it|this|that|there|these|those|he|she|they|we|i|you)\b/i.test(match[1])) {
      out.push({
        term: match[1].trim(),
        def: match[2].replace(/[.!?]+$/g, '').trim(),
        src: sentence,
      });
    }
  });
  return out;
}

function pts(text, count) {
  const list = facts(text);
  const frequencies = freq(text);
  return list
    .map((sentence, i) => ({
      i,
      x: sentence,
      v:
        words(sentence).reduce((total, word) => total + frequencies[word], 0) /
        Math.sqrt(words(sentence).length + 1),
    }))
    .sort((a, b) => b.v - a.v)
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((entry) => entry.x);
}

const ctxS = (word, list) => list.find((sentence) => new RegExp(`\\b${word}\\b`, 'i').test(sentence)) || '';

function distract(answer, termList, sentence) {
  const lower = answer.toLowerCase();
  const sentenceLower = (sentence || '').toLowerCase();
  const pool = termList.filter(
    (word) =>
      word !== lower &&
      !lower.includes(word) &&
      !word.includes(lower) &&
      !new RegExp(`\\b${word}\\b`).test(sentenceLower)
  );
  let candidates = shuffle(pool.filter((word) => Math.abs(word.length - lower.length) <= 3));
  if (candidates.length < 3) candidates = shuffle(pool);
  return candidates.slice(0, 3);
}

function pickWord(sentence, termList) {
  const sentenceWords = sentence.split(/\s+/);
  const candidates = [];
  sentenceWords.forEach((word, i) => {
    const index = termList.indexOf(wd(word).toLowerCase());
    if (i > 0 && wd(word).length >= 4 && index >= 0 && index < 40) candidates.push(i);
  });
  return candidates.length
    ? { words: sentenceWords, i: candidates[Math.floor(Math.random() * candidates.length)] }
    : null;
}

function mcBlank(sentence, termList) {
  const picked = pickWord(sentence, termList);
  if (!picked) return null;
  const answer = wd(picked.words[picked.i]);
  const options = distract(answer, termList, sentence);
  if (options.length < 3) return null;
  picked.words[picked.i] = picked.words[picked.i].replace(answer, '_____');
  return {
    t: 'mc',
    q: `Complete the statement: ${picked.words.join(' ')}`,
    o: shuffle([answer.toLowerCase(), ...options]),
    a: answer.toLowerCase(),
    src: sentence,
  };
}

function trueFalse(sentence, termList) {
  const picked = pickWord(sentence, termList);
  if (!picked || Math.random() < 0.5) {
    return { t: 'tf', q: `True or False: ${sentence}`, a: 'True', src: sentence };
  }
  const answer = wd(picked.words[picked.i]);
  const alternative = shuffle(
    termList.filter((word) => word !== answer.toLowerCase() && Math.abs(word.length - answer.length) <= 4)
  )[0];
  if (!alternative) {
    return { t: 'tf', q: `True or False: ${sentence}`, a: 'True', src: sentence };
  }
  picked.words[picked.i] = picked.words[picked.i].replace(answer, alternative);
  return { t: 'tf', q: `True or False: ${picked.words.join(' ')}`, a: 'False', src: sentence };
}

function definitionQuestion(definition, allDefinitions) {
  const options = shuffle(allDefinitions.filter((item) => item.term !== definition.term))
    .slice(0, 3)
    .map((item) => cut(item.def));
  if (options.length < 3) return null;
  const answer = cut(definition.def);
  return {
    t: 'mc',
    q: `According to your notes, what is ${definition.term}?`,
    o: shuffle([answer, ...options]),
    a: answer,
    src: definition.src,
  };
}

export function buildQuestions(text, count) {
  const termList = terms(text).slice(0, 60);
  const factList = shuffle(facts(text));
  const definitionList = defs(text);
  const questions = [];

  definitionList.forEach((definition) => {
    const question = definitionQuestion(definition, definitionList);
    if (question) questions.push(question);
  });

  factList.forEach((sentence, i) => {
    const question = i % 2 ? trueFalse(sentence, termList) : mcBlank(sentence, termList);
    if (question) questions.push(question);
  });

  return shuffle(questions).slice(0, count);
}

export function outline(text) {
  const sentences = sents(text);
  const frequencies = freq(text);
  const scored = sentences.map((sentence, i) => ({
    i,
    x: sentence,
    v:
      words(sentence).reduce((total, word) => total + frequencies[word], 0) /
      Math.sqrt(words(sentence).length + 1),
  }));
  const count = Math.max(3, Math.min(10, Math.ceil(sentences.length / 4)));
  return scored
    .sort((a, b) => b.v - a.v)
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((entry) => `• ${entry.x}`)
    .join('\n');
}

export function keywords(text) {
  return Object.entries(freq(text))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14);
}

export function cleanFormatting(text) {
  let cleaned = text
    .replace(/\b(um+|uh+|erm)\b[,.]?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])(?=[^\s\d"')\]])/g, '$1 ')
    .replace(/\bi\b/g, 'I')
    .trim();

  const sentences = sents(cleaned).map((sentence) => {
    let fixed = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (!/[.!?]$/.test(fixed)) fixed += '.';
    return fixed;
  });

  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 4) {
    paragraphs.push(sentences.slice(i, i + 4).join(' '));
  }
  return paragraphs.join('\n\n');
}

export function buildReviewer(text, title) {
  const factList = facts(text);
  const termList = terms(text).slice(0, 10);
  const definitionList = defs(text);
  const out = [`REVIEWER${title.trim() ? ` — ${title.trim()}` : ''}`, '', 'KEY TERMS'];
  const used = new Set();

  termList.forEach((word) => {
    const sentence = ctxS(word, factList);
    out.push(`• ${word}${sentence && !used.has(sentence) ? ` — ${sentence}` : ''}`);
    if (sentence) used.add(sentence);
  });

  if (definitionList.length) {
    out.push('', 'DEFINITIONS');
    definitionList.forEach((definition) => out.push(`• ${definition.term}: ${definition.def}.`));
  }

  out.push('', 'KEY POINTS');
  pts(text, Math.max(3, Math.min(8, Math.ceil(factList.length / 3)))).forEach((sentence) =>
    out.push(`• ${sentence}`)
  );

  out.push('', 'REVIEW QUESTIONS');
  termList.slice(0, 5).forEach((word, i) => out.push(`${i + 1}. Explain "${word}" based on the lecture.`));

  return out.join('\n');
}

export function buildCards(text) {
  const factList = facts(text);
  const cards = defs(text).map((definition) => ({
    f: `What is ${definition.term}?`,
    b: `${definition.def}.`,
  }));

  terms(text)
    .slice(0, 12)
    .forEach((word) => {
      const sentence = ctxS(word, factList);
      if (sentence && !cards.some((card) => card.b === sentence)) {
        cards.push({ f: `Explain: ${word}`, b: sentence });
      }
    });

  return cards.slice(0, 15);
}

export function examToText(questions) {
  const lines = ['PRACTICE EXAM', 'Choose the correct answer.', ''];
  questions.forEach((question, i) => {
    lines.push(`${i + 1}. ${question.q}`);
    (question.t === 'tf' ? ['True', 'False'] : question.o).forEach((option, j) =>
      lines.push(`   ${'ABCD'[j]}. ${option}`)
    );
  });
  lines.push('', 'ANSWER KEY');
  questions.forEach((question, i) => {
    const options = question.t === 'tf' ? ['True', 'False'] : question.o;
    const j = options.indexOf(question.a);
    lines.push(`${i + 1}. ${'ABCD'[j]} (${question.a})`);
  });
  return lines.join('\n');
}

export function cardsToText(cards) {
  return cards.map((card) => `Q: ${card.f}\nA: ${card.b}`).join('\n\n');
}
