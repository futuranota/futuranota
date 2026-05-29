import { useCallback, useRef, useState } from "react";

export type ProductCardSpecs = {
  category: string;
  partNumber: string;
  dimensions: { x: string; y: string; z: string };
  material: string;
  mountingPointDistance: string;
};

export type ProductCardImage = {
  id: string;
  src: string;
  name: string;
};

export type ProductCardData = {
  title: string;
  specs: ProductCardSpecs;
  images: ProductCardImage[];
  activeImageIndex: number;
  specsSaved?: boolean;
};

type ProductCardProps = {
  data: ProductCardData;
  onChange?: (patch: Partial<ProductCardData>) => void;
  onUploadImages?: (files: FileList | null) => void;
  onAddToCanvas?: () => void;
  onSave?: () => void;
  onEdit?: () => void;
  onExportSpecs?: () => void;
};

function formatDimension(specs: ProductCardSpecs) {
  const { x, y, z } = specs.dimensions;
  if (!x && !y && !z) return "-";
  return `${x || "-"} / ${y || "-"} / ${z || "-"}`;
}

function formatValue(value: string) {
  const trimmed = value.trim();
  return trimmed || "-";
}

export function ProductCard({
  data,
  onChange,
  onUploadImages,
  onAddToCanvas,
  onSave,
  onEdit,
  onExportSpecs,
}: ProductCardProps) {
  const touchStartX = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const images = data.images || [];
  const activeIndex = Math.min(
    Math.max(0, data.activeImageIndex || 0),
    Math.max(0, images.length - 1)
  );
  const activeImage = images[activeIndex];
  const specsSaved = Boolean(data.specsSaved);

  const setActiveIndex = useCallback(
    (nextIndex: number) => {
      if (!images.length) return;
      const clamped = Math.max(0, Math.min(images.length - 1, nextIndex));
      onChange?.({ activeImageIndex: clamped });
    },
    [images.length, onChange]
  );

  const updateSpec = (key: keyof ProductCardSpecs, value: string) => {
    onChange?.({
      specs: {
        ...data.specs,
        [key]: value,
      },
    });
  };

  const updateDimension = (axis: "x" | "y" | "z", value: string) => {
    onChange?.({
      specs: {
        ...data.specs,
        dimensions: {
          ...data.specs.dimensions,
          [axis]: value,
        },
      },
    });
  };

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    setDragOffset(0);
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const currentX = event.touches[0]?.clientX ?? touchStartX.current;
    setDragOffset(currentX - touchStartX.current);
  };

  const onTouchEnd = () => {
    if (touchStartX.current == null) return;
    if (dragOffset <= -40) setActiveIndex(activeIndex + 1);
    if (dragOffset >= 40) setActiveIndex(activeIndex - 1);
    touchStartX.current = null;
    setDragOffset(0);
  };

  const tableRows: Array<{ label: string; value: string }> = [
    { label: "Category", value: formatValue(data.specs.category) },
    { label: "Part Number", value: formatValue(data.specs.partNumber) },
    { label: "Dimension X/Y/Z", value: formatDimension(data.specs) },
    { label: "Material", value: formatValue(data.specs.material) },
    {
      label: "Mounting Point Distance",
      value: formatValue(data.specs.mountingPointDistance),
    },
  ];

  return (
    <section className="product-card">
      <div className="product-card__layout">
        <div className="product-card__media">
          <div
            className="product-card__carousel"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {activeImage?.src ? (
              <img
                className="product-card__image"
                src={activeImage.src}
                alt={activeImage.name || "Product image"}
                draggable={false}
              />
            ) : (
              <div className="product-card__image-empty">No image</div>
            )}
          </div>
          <div className="product-card__carousel-controls">
            <button
              type="button"
              className="product-card__nav"
              onClick={() => setActiveIndex(activeIndex - 1)}
              disabled={!images.length}
              aria-label="Previous image"
            >
              ‹
            </button>
            <span className="product-card__counter">
              {images.length ? `${activeIndex + 1}/${images.length}` : "0/0"}
            </span>
            <button
              type="button"
              className="product-card__nav"
              onClick={() => setActiveIndex(activeIndex + 1)}
              disabled={!images.length}
              aria-label="Next image"
            >
              ›
            </button>
            <label className="product-card__upload">
              Upload
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => onUploadImages?.(event.target.files)}
              />
            </label>
          </div>
        </div>

        <div className="product-card__panel">
          {specsSaved ? (
            <table className="product-card__table">
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.label}>
                    <th>{row.label}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="product-card__specs-editor">
              <label className="product-card__field">
                <span>Category</span>
                <input
                  value={data.specs.category}
                  onChange={(event) => updateSpec("category", event.target.value)}
                  placeholder="Category"
                />
              </label>
              <label className="product-card__field">
                <span>Part Number</span>
                <input
                  value={data.specs.partNumber}
                  onChange={(event) => updateSpec("partNumber", event.target.value)}
                  placeholder="Part Number"
                />
              </label>
              <label className="product-card__field product-card__field--dims">
                <span>Dimension X/Y/Z</span>
                <div>
                  <input
                    value={data.specs.dimensions.x}
                    onChange={(event) => updateDimension("x", event.target.value)}
                    placeholder="X"
                  />
                  <input
                    value={data.specs.dimensions.y}
                    onChange={(event) => updateDimension("y", event.target.value)}
                    placeholder="Y"
                  />
                  <input
                    value={data.specs.dimensions.z}
                    onChange={(event) => updateDimension("z", event.target.value)}
                    placeholder="Z"
                  />
                </div>
              </label>
              <label className="product-card__field">
                <span>Material</span>
                <input
                  value={data.specs.material}
                  onChange={(event) => updateSpec("material", event.target.value)}
                  placeholder="Material"
                />
              </label>
              <label className="product-card__field">
                <span>Mounting Point Distance</span>
                <input
                  value={data.specs.mountingPointDistance}
                  onChange={(event) =>
                    updateSpec("mountingPointDistance", event.target.value)
                  }
                  placeholder="Mounting Point Distance"
                />
              </label>
            </div>
          )}

          <div className="product-card__actions">
            <button
              type="button"
              className="product-card__add-canvas"
              onClick={onAddToCanvas}
            >
              Add to Canvas
            </button>
            {!specsSaved ? (
              <button type="button" className="product-card__save" onClick={onSave}>
                Save
              </button>
            ) : (
              <button type="button" className="product-card__save" onClick={onEdit}>
                Edit
              </button>
            )}
            <button
              type="button"
              className="product-card__export"
              onClick={onExportSpecs}
            >
              Export Specs
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
