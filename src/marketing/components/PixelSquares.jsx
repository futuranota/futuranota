import { useState } from 'react';

const SHAPES = [
  [[1]],
  [[1, 1], [1, 0]],
  [[1, 0], [1, 0], [1, 1]],
  [[1, 1], [1, 1]],
  [[1, 1, 1], [0, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
  [[1, 1, 1], [1, 2, 1], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 2, 0]],
  [[1, 1, 1, 1], [1, 0, 0, 1], [1, 1, 1, 1]],
  [[1, 0, 1], [1, 1, 1], [0, 1, 0]],
];

function spot() {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { left: `${3 + Math.random() * 14}%`, top: `${8 + Math.random() * 74}%` };
  if (edge === 1) return { left: `${80 + Math.random() * 14}%`, top: `${8 + Math.random() * 74}%` };
  if (edge === 2) return { left: `${18 + Math.random() * 64}%`, top: `${4 + Math.random() * 12}%` };
  return { left: `${18 + Math.random() * 64}%`, top: `${76 + Math.random() * 16}%` };
}

function piece(id, delay = 0) {
  return {
    id,
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    size: [7, 8, 10, 12][Math.floor(Math.random() * 4)],
    duration: 3.4 + Math.random() * 2.8,
    delay,
    ...spot(),
  };
}

function seed() {
  return Array.from({ length: 8 }, (_, id) => piece(id, Math.random() * 2.4));
}

export function PixelSquares() {
  const [pieces, setPieces] = useState(seed);

  const recycle = (id) => {
    setPieces((current) => current.map((item) => (item.id === id ? piece(id) : item)));
  };

  return (
    <div className="pixel-field" aria-hidden="true">
      {pieces.map((item) => (
        <span
          key={`${item.id}-${item.left}-${item.top}-${item.duration}`}
          className="pixel-piece"
          style={{
            left: item.left,
            top: item.top,
            gridTemplateColumns: `repeat(${item.shape[0].length}, ${item.size}px)`,
            animationDuration: `${item.duration}s`,
            animationDelay: `${item.delay}s`,
          }}
          onAnimationEnd={() => recycle(item.id)}
        >
          {item.shape.flat().map((cell, index) => (
            <i
              key={index}
              className={cell === 2 ? 'pixel-cell is-dot' : 'pixel-cell'}
              style={{ visibility: cell ? 'visible' : 'hidden', width: item.size, height: item.size }}
            />
          ))}
        </span>
      ))}
    </div>
  );
}
