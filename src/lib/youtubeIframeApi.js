// Loads the official YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference)
// exactly once and resolves with `window.YT` when `YT.Player` is available.

const API_SCRIPT_SRC = "https://www.youtube.com/iframe_api";

let apiPromise = null;

export function loadYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API requires a browser environment"));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT);
    };

    if (!document.querySelector(`script[src="${API_SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = API_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}
