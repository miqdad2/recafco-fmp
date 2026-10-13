import sharp from 'sharp';

// ---------------------------------------------------------------------------
// FMP-TECH-20 — browsers cannot show TIFF, so the drawing viewer asks for a PNG
// preview. The original TIFF is never changed; this only produces a separate
// image for viewing. Multi-page TIFFs: the first page is previewed.
// ---------------------------------------------------------------------------

/** Longest side of the preview, in pixels. Big enough to read a scanned A1 sheet when zoomed, small enough to stay fast. */
export const TIFF_PREVIEW_MAX_SIDE = 8000;
/** Refuse absurd inputs (decompression-bomb guard). */
const MAX_INPUT_PIXELS = 400_000_000;

export async function convertTiffToPng(tiff: Buffer): Promise<Buffer> {
  return sharp(tiff, { pages: 1, limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // honour the TIFF orientation tag
    .resize({ width: TIFF_PREVIEW_MAX_SIDE, height: TIFF_PREVIEW_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/** On-disk key of the cached preview for an original file: same folder, original name + ".preview.png". Never user input. */
export function previewStoragePath(storagePath: string): string {
  return `${storagePath}.preview.png`;
}

export function isTiffAttachment(file: { originalFileName: string; mimeType: string }): boolean {
  return /\.tiff?$/i.test(file.originalFileName) || /^(image|application)\/(x-)?tiff?$/i.test(file.mimeType);
}
