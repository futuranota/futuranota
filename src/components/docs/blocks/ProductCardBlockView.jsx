import { ProductCard } from "../../products/ProductCard.tsx";
import { convertAndUploadDocImage } from "../../../lib/docImageStorage.js";

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
    try {
      const converted = await Promise.all(
        list.map((file) =>
          convertAndUploadDocImage(file, {
            idPrefix: "PRDIMG",
            scopeId: block?.id,
          }),
        ),
      );
      const nextImages = [...data.images, ...converted.filter(Boolean)];
      onChange?.({
        images: nextImages,
        activeImageIndex: Math.min(data.activeImageIndex, Math.max(0, nextImages.length - 1)),
      });
    } catch (err) {
      console.error("[ProductCard] image upload failed:", err?.message || err);
    }
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
