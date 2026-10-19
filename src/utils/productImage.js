// Product images are resized and compressed in the browser before upload, so
// Storage only holds small files (spec/09 S1-S2). The limits are repeated in
// storage.rules, which reject anything a bypassed client might send.

/**
 * Longest side in pixels of an uploaded product image: enough for the
 * product cards, small enough to load fast.
 * @type {number}
 * @example
 * Math.min(1, MAX_IMAGE_SIDE / bitmap.width);
 */
export const MAX_IMAGE_SIDE = 800;
/**
 * Maximum upload size (150 KB, exclusive), the same limit as storage.rules.
 * @type {number}
 * @example
 * if (file.size >= MAX_IMAGE_BYTES) throw new Error("Too big");
 */
export const MAX_IMAGE_BYTES = 150 * 1024;
/**
 * Content types accepted by storage.rules: WebP, with JPEG as the fallback
 * for browsers that cannot encode WebP.
 * @type {string[]}
 * @example
 * IMAGE_TYPES.includes(file.type);
 */
export const IMAGE_TYPES = ["image/webp", "image/jpeg"];
/**
 * Cache-Control metadata of uploaded images: browsers reuse an image for a
 * day; a replaced image gets a new download token, so no stale image is shown.
 * @type {string}
 * @example
 * uploadBytes(imageRef, file, { cacheControl: IMAGE_CACHE_CONTROL });
 */
export const IMAGE_CACHE_CONTROL = "public, max-age=86400";

const QUALITY_STEPS = [0.8, 0.7, 0.6, 0.5, 0.4];
const SIDE_STEP = 0.8;
const MIN_IMAGE_SIDE = 200;

// Encodes the canvas as WebP; browsers that cannot encode WebP silently
// return PNG, in which case JPEG is used instead.
/**
 * Encodes a canvas as a WebP Blob at the given quality, falling back to JPEG
 * when the browser does not produce WebP. Resolves to null when the canvas
 * cannot be encoded.
 * @private
 * @param {HTMLCanvasElement} canvas
 * @param {number} quality - Encoder quality between 0 and 1.
 * @returns {Promise<?Blob>}
 * @example
 * const blob = await encodeCanvas(canvas, 0.8);
 */
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
/**
 * Draws an image onto a new canvas of the given size, over a white
 * background, scaling it to fill the canvas.
 * @private
 * @param {ImageBitmap} bitmap
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 * @example
 * const canvas = drawImage(bitmap, 800, 600);
 */
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

/**
 * Resizes and compresses an image in the browser with a native canvas (no
 * library) before upload. Returns a WebP (or JPEG) Blob under
 * MAX_IMAGE_BYTES whose longest side is at most MAX_IMAGE_SIDE. Quality is
 * lowered first, then the dimensions, to keep as much detail as possible.
 * @param {File} file - Any image the browser can decode.
 * @returns {Promise<Blob>}
 * @throws {Error} When the file is not an image or cannot fit the limit.
 * @example
 * const blob = await compressProductImage(input.files[0]);
 */
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
