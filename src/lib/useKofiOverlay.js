import { useEffect } from 'react';
import '../styles/kofi-overlay.css';

const KOFI_PAGE = 'futuranota';
const KOFI_CLASS = 'fn-kofi';

function drawKofiWidget() {
  if (window.__futuraKofiDrawn || !window.kofiWidgetOverlay) return;
  window.__futuraKofiDrawn = true;
  window.kofiWidgetOverlay.draw(KOFI_PAGE, {
    type: 'floating-chat',
    'floating-chat.donateButton.text': 'Support me',
    'floating-chat.donateButton.background-color': '#323842',
    'floating-chat.donateButton.text-color': '#fff',
  });
}

export function useKofiOverlay(enabled = true) {
  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove(KOFI_CLASS);
      return undefined;
    }

    document.body.classList.add(KOFI_CLASS);
    let cancelled = false;

    const draw = () => {
      if (!cancelled) drawKofiWidget();
    };

    if (window.kofiWidgetOverlay) {
      draw();
    } else {
      let script = document.querySelector('script[data-kofi-overlay]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
        script.async = true;
        script.dataset.kofiOverlay = 'true';
        document.body.appendChild(script);
      }
      script.addEventListener('load', draw);
    }

    return () => {
      cancelled = true;
      document.body.classList.remove(KOFI_CLASS);
    };
  }, [enabled]);
}
