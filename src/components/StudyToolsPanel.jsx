import { useState } from 'react';
import { QUESTION_COUNTS } from '../lib/languages.js';
import {
  buildCards,
  buildQuestions,
  buildReviewer,
  cardsToText,
  cleanFormatting,
  countWords,
  examToText,
  keywords,
  outline,
} from '../lib/study.js';
import Exam from './Exam.jsx';
import Flashcards from './Flashcards.jsx';
import Panel from './Panel.jsx';

export default function StudyToolsPanel({ text, title, setText, notify }) {
  const [output, setOutput] = useState({
    kind: 'text',
    text: 'Results from the study tools appear here.',
  });
  const [outputText, setOutputText] = useState('');
  const [view, setView] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);

  function showText(value) {
    setView(null);
    setOutput({ kind: 'text', text: value });
    setOutputText(value);
  }

  function needMoreText() {
    if (countWords(text) < 15) {
      showText('Add a little more text first (at least a couple of sentences).');
      return true;
    }
    return false;
  }

  function studyReady() {
    const words = countWords(text);
    if (words < 40) {
      showText(
        `Add at least about 40 words (a few full sentences) so good review questions can be made. You have ${words} now.`
      );
      return false;
    }
    return true;
  }

  function handleOutline() {
    if (needMoreText()) return;
    showText(outline(text));
  }

  function handleClean() {
    if (needMoreText()) return;
    setText(cleanFormatting(text));
    showText('Formatting cleaned: filler words removed, sentences capitalized, paragraphs added.');
  }

  function handleKeywords() {
    if (needMoreText()) return;
    const entries = keywords(text);
    setView(null);
    setOutput({ kind: 'keywords', items: entries });
    setOutputText(entries.map((entry) => entry[0]).join(', '));
  }

  function handleReviewer() {
    if (!studyReady()) return;
    showText(buildReviewer(text, title));
  }

  function handleCards() {
    if (!studyReady()) return;
    const cards = buildCards(text);
    if (!cards.length) {
      showText('Not enough definitions or key terms in your notes to build flashcards.');
      return;
    }
    setOutputText(cardsToText(cards));
    setView({ type: 'cards', cards, id: Date.now() });
  }

  function handleExam() {
    if (!studyReady()) return;
    const questions = buildQuestions(text, questionCount);
    if (questions.length < 2) {
      showText(
        'Not enough full sentences to build questions. Write or record a few more complete sentences.'
      );
      return;
    }
    setOutputText(examToText(questions));
    setView({ type: 'exam', questions, id: Date.now() });
  }

  function addToNotes() {
    if (!outputText) return;
    setText((current) => current + (current ? '\n\n' : '') + outputText);
  }

  async function copyResult() {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      notify('Result copied.');
    } catch {
      /* clipboard may be blocked */
    }
  }

  return (
    <Panel title="04 / Study tools">
      <div className="row" style={{ marginTop: 0 }}>
        <button type="button" className="btn" id="tOutline" onClick={handleOutline}>
          Key-point outline
        </button>
        <button type="button" className="btn" id="tClean" onClick={handleClean}>
          Clean formatting
        </button>
        <button type="button" className="btn" id="tKeys" onClick={handleKeywords}>
          Keywords
        </button>
      </div>

      <div className="row">
        <button type="button" className="btn gold" id="tRev" onClick={handleReviewer}>
          Reviewer
        </button>
        <button type="button" className="btn gold" id="tCards" onClick={handleCards}>
          Flashcards
        </button>
        <button type="button" className="btn gold" id="tExam" onClick={handleExam}>
          Practice exam
        </button>
        <select
          id="qn"
          aria-label="Number of questions"
          value={questionCount}
          onChange={(event) => setQuestionCount(Number(event.target.value))}
        >
          {QUESTION_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count} questions
            </option>
          ))}
        </select>
      </div>

      {!view && (
        <div id="out">
          {output.kind === 'keywords'
            ? output.items.map(([word, count]) => (
                <span className="kw" key={word}>
                  {word} <small>×{count}</small>
                </span>
              ))
            : output.text}
        </div>
      )}

      {view?.type === 'cards' && <Flashcards key={view.id} cards={view.cards} />}
      {view?.type === 'exam' && (
        <Exam key={view.id} questions={view.questions} onRebuild={handleExam} />
      )}

      <div className="row">
        <button type="button" className="btn" id="outAdd" onClick={addToNotes}>
          Add to notes
        </button>
        <button type="button" className="btn" id="outCopy" onClick={copyResult}>
          Copy result
        </button>
      </div>
    </Panel>
  );
}
