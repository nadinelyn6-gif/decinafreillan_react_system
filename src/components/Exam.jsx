import { useState } from 'react';

export default function Exam({ questions, onRebuild }) {
  const [selections, setSelections] = useState({});
  const [result, setResult] = useState(null);

  function submit() {
    let correctCount = 0;
    questions.forEach((question, i) => {
      if (selections[i] === question.a) correctCount += 1;
    });
    const percentage = Math.round((correctCount / questions.length) * 100);
    setResult({
      answers: { ...selections },
      score: `Score: ${correctCount} / ${questions.length} (${percentage}%) — ${
        percentage >= 75 ? 'Passed' : 'Review again'
      }`,
    });
  }

  return (
    <div id="exam">
      {questions.map((question, i) => {
        const correct = result ? result.answers[i] === question.a : false;
        const options = question.t === 'tf' ? ['True', 'False'] : question.o;
        const className = `qb${result ? (correct ? ' ok' : ' no') : ''}`;

        return (
          <div className={className} key={`${question.q}-${i}`}>
            <b>
              {i + 1}. {question.q}
            </b>
            {options.map((option) => (
              <label className="opt" key={option}>
                <input
                  type="radio"
                  name={`q${i}`}
                  value={option}
                  checked={selections[i] === option}
                  onChange={() => setSelections((current) => ({ ...current, [i]: option }))}
                />
                <span>{option}</span>
              </label>
            ))}
            {result && (
              <div className="ans">
                {result.answers[i] == null ? 'No answer. ' : correct ? 'Correct. ' : 'Wrong. '}
                Answer: {question.a} — From your notes: {question.src}
              </div>
            )}
          </div>
        );
      })}

      <div className="row">
        <button type="button" className="btn gold" onClick={submit}>
          {result ? 'Check again' : 'Submit answers'}
        </button>
        <button type="button" className="btn" onClick={onRebuild}>
          New exam
        </button>
      </div>

      {result && <div className="score">{result.score}</div>}
    </div>
  );
}
