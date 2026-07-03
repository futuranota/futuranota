import { useCallback, useEffect, useRef, useState } from 'react';
import { getHome } from '../lib/content.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';

const DEFAULT_SLIDES = [
  {
    src: '/uploads/carrusel-01.jpg',
    alt: 'Futura Nota showcase',
    title: 'Futura Nota',
    caption: 'Study campaigns. Move on the window.',
  },
  {
    src: '/uploads/carrusel-02.jpg',
    alt: 'Futura Nota workflow',
    title: 'Inside the terminal',
    caption: 'Spot launches, read the window, and ship on time.',
  },
  {
    src: '/uploads/carrusel-03.jpg',
    alt: 'Futura Nota platform',
    title: 'Move on the window',
    caption: 'Plan, connect, and ship before the opportunity closes.',
  },
];

function CarouselArrow({ direction }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      {direction === 'left' ? (
        <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function FeatureCarousel() {
  const pageTina = usePageTina();
  const { carousel: block } = pageTina?.document ?? getHome();
  const slides = block?.slides?.length ? block.slides : DEFAULT_SLIDES;
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);
  const dragOffsetRef = useRef(0);
  const count = slides.length;

  const goTo = useCallback((target) => {
    if (!count) return;
    setIndex(((target % count) + count) % count);
  }, [count]);

  const onPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const onNext = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onNext, onPrev]);

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % count);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setDragOffset(0);
  };

  const onTouchMove = (e) => {
    if (touchStartX.current == null) return;
    const offset = e.touches[0].clientX - touchStartX.current;
    dragOffsetRef.current = offset;
    setDragOffset(offset);
  };

  const onTouchEnd = () => {
    if (touchStartX.current == null) return;
    const offset = dragOffsetRef.current;
    if (offset <= -48) onNext();
    else if (offset >= 48) onPrev();
    touchStartX.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  if (!count) return null;

  const active = slides[index];

  return (
    <section className="section fn-carousel-section" id="showcase" data-screen-label="carousel">
      <div className="container">
        <div className="fn-carousel-section__head section-head">
          <span className="eyebrow" {...pageTinaProps('carousel.eyebrow')}>
            <span className="tick" />
            {block?.eyebrow ?? 'INSIDE THE TERMINAL'}
          </span>
          <h2 className="h2" {...pageTinaProps('carousel.title')}>
            {block?.title ?? 'See the workflow in motion'}
          </h2>
          {block?.lead ? (
            <p className="lead" {...pageTinaProps('carousel.lead')}>{block.lead}</p>
          ) : null}
        </div>

        <div
          className="fn-carousel"
          role="region"
          aria-roledescription="carousel"
          aria-label={block?.title ?? 'Product showcase'}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div
            className="fn-carousel__stage"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="fn-carousel__viewport">
              <div
                className="fn-carousel__track"
                style={{
                  transform: `translateX(calc(-${index * 100}% + ${dragOffset}px))`,
                  transition: dragOffset ? 'none' : undefined,
                }}
              >
                {slides.map((slide, i) => (
                  <article
                    key={slide.src || i}
                    className={'fn-carousel__slide' + (i === index ? ' is-active' : '')}
                    aria-hidden={i !== index}
                  >
                    <img
                      className="fn-carousel__image"
                      src={slide.src}
                      alt={slide.alt || slide.title || ''}
                      loading={i <= 1 ? 'eager' : 'lazy'}
                      draggable={false}
                    />
                    <div className="fn-carousel__shade" aria-hidden />
                    <div className="fn-carousel__overlay">
                      {slide.title ? (
                        <h3 className="fn-carousel__title">{slide.title}</h3>
                      ) : null}
                      {slide.caption ? (
                        <p className="fn-carousel__caption">{slide.caption}</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="fn-carousel__hud">
              <button
                type="button"
                className="fn-carousel__arrow"
                onClick={onPrev}
                aria-label="Previous slide"
              >
                <CarouselArrow direction="left" />
              </button>

              <div className="fn-carousel__dots" role="tablist" aria-label="Carousel slides">
                {slides.map((slide, i) => (
                  <button
                    key={slide.src || i}
                    type="button"
                    role="tab"
                    className={'fn-carousel__dot' + (i === index ? ' is-active' : '')}
                    aria-selected={i === index}
                    aria-label={`${slide.title || 'Slide'} ${i + 1}`}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>

              <button
                type="button"
                className="fn-carousel__arrow"
                onClick={onNext}
                aria-label="Next slide"
              >
                <CarouselArrow direction="right" />
              </button>
            </div>

            <div className="fn-carousel__counter mono-sm" aria-live="polite">
              {String(index + 1).padStart(2, '0')}
              <span className="fn-carousel__counter-sep">/</span>
              {String(count).padStart(2, '0')}
            </div>
          </div>

          <p className="fn-carousel__live-caption sr-only">
            {active?.title}
            {active?.caption ? ` — ${active.caption}` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
