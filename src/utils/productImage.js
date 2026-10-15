// Product images are resized and compressed in the browser before upload, so
// Storage only holds small files (spec/09 S1-S2). The limits are repeated in
// storage.rules, which reject anything a bypassed client might send.

export const MAX_IMAGE_SIDE = 800;
export const MAX_IMAGE_BYTES = 150 * 1024;
export const IMAGE_TYPES = ["image/webp", "image/jpeg"];
export const IMAGE_CACHE_CONTROL = "public, max-age=86400";

const QUALITY_STEPS = [0.8, 0.7, 0.6, 0.5, 0.4];
const SIDE_STEP = 0.8;
const MIN_IMAGE_SIDE = 200;

// Encodes the canvas as WebP; browsers that cannot encode WebP silently
// return PNG, in which case JPEG is used instead.
const encodeCanvas = (canvas, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality)).then(
    (blob) =>
      blob?.type === "image/webp"
        ? blob
        : new Promise((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", quality),
          ),
  );

// White background: JPEG has no transparency, and both formats then look the
// same on the white product cards.
const drawImage = (bitmap, width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
};

// Returns a WebP (or JPEG) Blob under MAX_IMAGE_BYTES whose longest side is
// at most MAX_IMAGE_SIDE. Quality is lowered first, then the dimensions.
export const compressProductImage = async (file) => {
  if (!file || typeof file.type !== "string" || !file.type.startsWith("image/"))
    throw new Error("Product image must be an image file");

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Product image could not be read");
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    let scale = Math.min(1, MAX_IMAGE_SIDE / longest);

    // At least one attempt, even for images already smaller than the minimum.
    do {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = drawImage(bitmap, width, height);

      for (const quality of QUALITY_STEPS) {
        const blob = await encodeCanvas(canvas, quality);
        if (blob && IMAGE_TYPES.includes(blob.type) && blob.size < MAX_IMAGE_BYTES)
          return blob;
      }

      scale *= SIDE_STEP;
    } while (longest * scale >= MIN_IMAGE_SIDE);
  } finally {
    bitmap.close?.();
  }

  throw new Error("Product image could not be compressed under 150 KB");
};
