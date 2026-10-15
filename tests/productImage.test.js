import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_SIDE,
  compressProductImage,
} from "../src/utils/productImage";

// jsdom has no image decoding or canvas encoding: both are simulated.
// `encode` decides the size and type of each encoded blob.
let encode;
let encodings;
let context;

const mockBitmap = (width, height) => {
  const bitmap = { width, height, close: vi.fn() };
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  return bitmap;
};

const photo = new File(["x"], "pizza.png", { type: "image/png" });

beforeEach(() => {
  encodings = [];
  context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" };
  encode = () => ({ size: 1000, type: "image/webp" });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    function toBlob(callback, type, quality) {
      const call = { width: this.width, height: this.height, type, quality };
      encodings.push(call);
      const { size, type: blobType } = encode(call);
      callback(new Blob([new Uint8Array(size)], { type: blobType }));
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("compressProductImage", () => {
  it("scales the longest side down to 800 px and encodes WebP", async () => {
    const bitmap = mockBitmap(4000, 2000);

    const blob = await compressProductImage(photo);

    expect(blob.type).toBe("image/webp");
    expect(encodings[0]).toMatchObject({
      width: MAX_IMAGE_SIDE,
      height: 400,
      type: "image/webp",
      quality: 0.8,
    });
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 800, 400);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 800, 400);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("never upscales a small image", async () => {
    mockBitmap(300, 500);

    await compressProductImage(photo);

    expect(encodings[0]).toMatchObject({ width: 300, height: 500 });
  });

  it("falls back to JPEG when the browser cannot encode WebP", async () => {
    mockBitmap(1000, 1000);
    encode = ({ type }) => ({
      size: 1000,
      type: type === "image/webp" ? "image/png" : type,
    });

    const blob = await compressProductImage(photo);

    expect(blob.type).toBe("image/jpeg");
    expect(encodings[1]).toMatchObject({ type: "image/jpeg", quality: 0.8 });
  });

  it("lowers the quality before the dimensions", async () => {
    mockBitmap(800, 800);
    encode = ({ quality }) => ({
      size: quality > 0.5 ? MAX_IMAGE_BYTES : 1000,
      type: "image/webp",
    });

    await compressProductImage(photo);

    expect(encodings.map((call) => call.quality)).toEqual([0.8, 0.7, 0.6, 0.5]);
    expect(encodings.every((call) => call.width === 800)).toBe(true);
  });

  it("reduces the dimensions when the lowest quality is still too large", async () => {
    mockBitmap(800, 800);
    encode = ({ width }) => ({
      size: width > 700 ? MAX_IMAGE_BYTES : 1000,
      type: "image/webp",
    });

    await compressProductImage(photo);

    expect(encodings.at(-1)).toMatchObject({ width: 640, quality: 0.8 });
  });

  it("fails when the image cannot fit under 150 KB", async () => {
    const bitmap = mockBitmap(800, 800);
    encode = () => ({ size: MAX_IMAGE_BYTES, type: "image/webp" });

    await expect(compressProductImage(photo)).rejects.toThrow(
      "Product image could not be compressed under 150 KB",
    );
    expect(Math.min(...encodings.map((call) => call.width))).toBeGreaterThanOrEqual(200);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("rejects non-image and unreadable files", async () => {
    await expect(compressProductImage(null)).rejects.toThrow(
      "Product image must be an image file",
    );
    await expect(
      compressProductImage(new File(["x"], "note.txt", { type: "text/plain" })),
    ).rejects.toThrow("Product image must be an image file");

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockRejectedValue(new Error("decode")),
    );
    await expect(compressProductImage(photo)).rejects.toThrow(
      "Product image could not be read",
    );
  });
});
