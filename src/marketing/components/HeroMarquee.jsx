function MarqueeRow({ items, reverse = false }) {
  const track = [...items, ...items];
  return (
    <div className="hero__marquee" aria-hidden="true">
      <div className={`hero__marquee-track${reverse ? ' hero__marquee-track--reverse' : ''}`}>
        {track.map((text, i) => (
          <span className="hero__marquee-item" key={`${text}-${i}`}>
            {text}
            <span className="hero__marquee-sep" aria-hidden="true">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function HeroMarquee({ rows }) {
  const safe = rows?.length ? rows : [
    ['Ceramics', 'Wood', 'Prints', 'Design', 'Companion products'],
    ['Spot the launch', 'Ship the window', 'Move before it closes'],
  ];
  return (
    <div className="hero__marquees">
      {safe.map((items, i) => (
        <MarqueeRow key={i} items={items} reverse={i % 2 === 1} />
      ))}
    </div>
  );
}
