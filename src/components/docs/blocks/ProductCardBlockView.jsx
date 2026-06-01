import { ProductCard } from "../../products/ProductCard.tsx";

function safeProductData(block) {
  const specs = block?.specs && typeof block.specs === "object" ? block.specs : {};
  const dimensions = specs.dimensions && typeof specs.dimensions === "object" ? specs.dimensions : {};
  return {
    title: block?.title || "ProductCard",
    specs: {
      category: specs.category || "",
      partNumber: specs.partNumber || "",
      dimensions: {
        x: dimensions.x || "",
        y: dimensions.y || "",
        z: dimensions.z || "",
        unit:
          dimensions.unit
          || dimensions.xUnit
          || dimensions.yUnit
          || dimensions.zUnit
          || "",
      },
      material: specs.material || "",
      mountingPointDistance: specs.mountingPointDistance || "",
    },
    images: Array.isArray(block?.images) ? block.images : [],
    activeImageIndex: Number.isInteger(block?.activeImageIndex) ? block.activeImageIndex : 0,
    specsSaved: Boolean(block?.specsSaved),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fileToWebpData(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const blob = await new Promise((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/webp", 0.86);
    });
    if (!blob) return null;
    const src = await blobToDataUrl(blob);
    return {
      id: `PRDIMG_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      src,
      name: `${(file.name || "image").replace(/\.[^/.]+$/, "")}.webp`,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProductCardBlockView({ block, onChange, onInsertToCanvas, onDelete }) {
  const data = safeProductData(block);

  const handleChange = (patch) => {
    if (patch.specsSaved !== true && block?.specsSaved) {
      onChange?.({ ...patch, specsSaved: false });
      return;
    }
    onChange?.(patch);
  };

  const handleSave = () => {
    onChange?.({ specsSaved: true });
  };

  const handleEdit = () => {
    onChange?.({ specsSaved: false });
  };

  const handleUploadImages = async (files) => {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    const converted = await Promise.all(list.map((file) => fileToWebpData(file)));
    const nextImages = [...data.images, ...converted.filter(Boolean)];
    onChange?.({
      images: nextImages,
      activeImageIndex: Math.min(data.activeImageIndex, Math.max(0, nextImages.length - 1)),
    });
  };

  const handleExportSpecs = () => {
    const payload = {
      category: data.specs.category,
      partNumber: data.specs.partNumber,
      dimensions: data.specs.dimensions,
      material: data.specs.material,
      mountingPointDistance: data.specs.mountingPointDistance,
      images: data.images.map((img) => ({ name: img.name, src: img.src })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${data.specs.partNumber || data.specs.category || "product-specs"}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="doc-product-card-block">
      <ProductCard
        data={data}
        onChange={handleChange}
        onUploadImages={handleUploadImages}
        onSave={handleSave}
        onEdit={handleEdit}
        onExportSpecs={handleExportSpecs}
        onDelete={onDelete}
      />
    </div>
  );
}
