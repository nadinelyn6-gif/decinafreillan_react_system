import { useState } from 'react';
import { shuffle } from '../lib/study.js';

export default function Flashcards({ cards }) {
  const [list, setList] = useState(cards);
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState(0);

  const flip = () => setSide((current) => current ^ 1);

  const previous = () => {
    setIndex((current) => (current + list.length - 1) % list.length);
    setSide(0);
  };

  const next = () => {
    setIndex((current) => (current + 1) % list.length);
    setSide(0);
  };

  const shuffleCards = () => {
    setList(shuffle(list));
    setIndex(0);
    setSide(0);
  };

  if (!list.length) return null;

  return (
    <div id="exam">
      <div className="card" data-s={side} onClick={flip}>
        {side ? list[index].b : list[index].f}
      </div>
      <div className="tip">
        Card {index + 1} of {list.length}
        {side ? ' · answer' : ' · question (click the card to flip)'}
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={previous}>
          Previous
        </button>
        <button type="button" className="btn gold" onClick={next}>
          Next
        </button>
        <button type="button" className="btn" onClick={shuffleCards}>
          Shuffle
        </button>
      </div>
    </div>
  );
}
