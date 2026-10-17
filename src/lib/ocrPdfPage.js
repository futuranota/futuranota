/**
 * Read page photos in the browser when the PDF has no text layer.
 * The Spanish and English packs download once, on the first read.
 * @param {string[]} images JPEG data URLs, in page order
 * @returns {Promise<string[]>}
 */
export async function ocrPdfPageImages(images) {
  const list = Array.isArray(images) ? images.filter((image) => typeof image === "string" && image) : [];
  if (!list.length) return [];
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa+eng", 1, {
    logger: () => {},
  });
  try {
    const texts = [];
    for (const image of list) {
      const result = await worker.recognize(image);
      texts.push(typeof result?.data?.text === "string" ? result.data.text : "");
    }
    return texts;
  } finally {
    await worker.terminate();
  }
}
