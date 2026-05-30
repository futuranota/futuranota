import { useCallback, useRef, useState } from "react";
import { DIMENSION_UNIT_OPTIONS } from "../../lib/metricUnits.js";

export type ProductCardDimensions = {
  x: string;
  y: string;
  z: string;
  xUnit?: string;
  yUnit?: string;
  zUnit?: string;
};

export type ProductCardSpecs = {
  category: string;
  partNumber: string;
  dimensions: ProductCardDimensions;
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
  onDelete?: () => void;
};

function formatDimValue(value: string, unit: string) {
  const trimmed = value.trim();
  if (!trimmed) return "-";
  const unitTrim = unit.trim();
  return unitTrim ? `${trimmed} ${unitTrim}` : trimmed;
}

function formatDimension(specs: ProductCardSpecs) {
  const { x, y, z, xUnit = "", yUnit = "", zUnit = "" } = specs.dimensions;
  if (!x && !y && !z) return "-";
  return `${formatDimValue(x, xUnit)} / ${formatDimValue(y, yUnit)} / ${formatDimValue(z, zUnit)}`;
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
  onDelete,
}: ProductCardProps) {
  const touchStartX = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const images = data.images || [];
  const activeIndex = Math.min(
    Math.max(0, data.activeImageIndex || 0),
    Math.max(0, images.length - 1),
  );
  const activeImage = images[activeIndex];
  const specsSaved = Boolean(data.specsSaved);

  const setActiveIndex = useCallback(
    (nextIndex: number) => {
      if (!images.length) return;
      const clamped = Math.max(0, Math.min(images.length - 1, nextIndex));
      onChange?.({ activeImageIndex: clamped });
    },
    [images.length, onChange],
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

  const updateDimensionUnit = (unitKey: "xUnit" | "yUnit" | "zUnit", value: string) => {
    onChange?.({
      specs: {
        ...data.specs,
        dimensions: {
          ...data.specs.dimensions,
          [unitKey]: value,
        },
      },
    });
  };

  const dimAxes = [
    { axis: "x" as const, unitKey: "xUnit" as const, placeholder: "length", label: "Length" },
    { axis: "y" as const, unitKey: "yUnit" as const, placeholder: "width", label: "Width" },
    { axis: "z" as const, unitKey: "zUnit" as const, placeholder: "high", label: "High" },
  ];

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
    { label: "Dimensions L/W/H", value: formatDimension(data.specs) },
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
        </div>

        <div className="product-card__panel">
          <div className="product-card__panel-scroll">
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
                  <span>Dimensions</span>
                  <div className="product-card__dim-row">
                    {dimAxes.map(({ axis, unitKey, placeholder, label }) => (
                      <div key={axis} className="product-card__dim-cell">
                        <input
                          value={data.specs.dimensions[axis]}
                          onChange={(event) => updateDimension(axis, event.target.value)}
                          placeholder={placeholder}
                          aria-label={label}
                        />
                        <select
                          className="product-card__dim-picker"
                          value={data.specs.dimensions[unitKey] || ""}
                          onChange={(event) =>
                            updateDimensionUnit(unitKey, event.target.value)
                          }
                          aria-label={`${label} unit`}
                        >
                          {DIMENSION_UNIT_OPTIONS.map((opt) => (
                            <option key={opt.id || "none"} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
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
          </div>
        </div>
      </div>

      <div className="product-card__toolbar">
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

        <div className="product-card__actions">
          {onDelete ? (
            <button
              type="button"
              className="product-card__delete"
              onClick={onDelete}
            >
              Delete
            </button>
          ) : null}
          {onAddToCanvas ? (
            <button
              type="button"
              className="product-card__add-canvas"
              onClick={onAddToCanvas}
            >
              Add to Canvas
            </button>
          ) : null}
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
    </section>
  );
}
