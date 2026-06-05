import { getHow } from '../lib/content.js';

export function HowItWorks() {
  const { header, video, steps } = getHow();

  return (
    <section className="section how" id="how" data-screen-label="how">
      <div className="container">
        <div className="section-head" style={{ marginBottom: 'clamp(28px,4vw,44px)' }}>
          <span className="eyebrow"><span className="tick" />{header.eyebrow}</span>
          <h2 className="h2">{header.title}</h2>
          <p className="lead">{header.lead}</p>
        </div>
        <div className="video card" role="img" aria-label="Product walkthrough video placeholder">
          <div className="frame__bar">
            <span className="frame__dot" /><span className="frame__dot" /><span className="frame__dot" />
            <span className="frame__title">{video.title}</span>
            <span className="mono-sm faint" style={{ marginLeft: 'auto' }}>{video.duration}</span>
          </div>
          <div className="video__stage ph">
            <span className="ph__tag" style={{ position: 'absolute', top: 14, left: 14 }}>{video.placeholder}</span>
            <button type="button" className="video__play" aria-label="Play walkthrough">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <div className="video__scrub"><span style={{ width: '34%' }} /></div>
          </div>
        </div>
        <ol className="steps">
          {steps.map((s) => (
            <li className="step" key={s.num}>
              <span className="step__num mono-sm">{s.num}</span>
              <div>
                <div className="step__title">{s.title}</div>
                <div className="muted step__desc">{s.desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
