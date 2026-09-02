import {
  getProductCardFrameAssetUrl,
  normalizeProductCardFrameAspect,
  normalizeProductCardFrameId,
} from "../../../lib/productCardFrames.js";
import { libraryFrameCssAspectRatio } from "../../../lib/libraryFrameAspect.js";

/**
 * Image card photo with optional decorative frame-01 overlay.
 */
export function ImageSplitFramedImage({
  src,
  alt = "",
  width,
  height,
  decorativeFrameId,
  decorativeFrameAspect,
  imgClassName = "doc-image-split__img",
}) {
  const frameId = normalizeProductCardFrameId(decorativeFrameId);
  const frameAspect = normalizeProductCardFrameAspect(decorativeFrameAspect);
  const frameUrl = getProductCardFrameAssetUrl(frameId, frameAspect);
  const aspectRatio = libraryFrameCssAspectRatio(frameAspect);

  if (!frameUrl || !aspectRatio) {
    return (
      <img
        className={imgClassName}
        src={src}
        alt={alt}
        width={width || undefined}
        height={height || undefined}
        draggable={false}
      />
    );
  }

  return (
    <div className="doc-image-split__frame-stage">
      <div
        className="doc-image-split__frame-canvas"
        style={{ aspectRatio }}
      >
        <img
          className="doc-image-split__frame-photo"
          src={src}
          alt={alt}
          width={width || undefined}
          height={height || undefined}
          draggable={false}
        />
        <img
          className="doc-image-split__frame-overlay"
          src={frameUrl}
          alt=""
          aria-hidden
          draggable={false}
        />
      </div>
    </div>
  );
}
