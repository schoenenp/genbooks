import { PDFDocument } from "pdf-lib";
import { getPageSizeWithBleed } from "./helpers";
import type { BookFormat } from "./types";
import { logger } from "@/util/logger";

/**
 * Rebuilds the document so every page uses the selected print format
 * including bleed. Source pages are fitted proportionally and centered.
 */
export async function normalizeDocumentToFormat(
  sourceDoc: PDFDocument,
  format: BookFormat,
): Promise<PDFDocument> {
  const { width: targetWidth, height: targetHeight } = getPageSizeWithBleed(format);

  // Create a fresh output document. We avoid mutating source pages because
  // modules can have mixed dimensions and rotations.
  const outputDoc = await PDFDocument.create();

  for (const sourcePage of sourceDoc.getPages()) {
    let embeddedPage;
    try {
      embeddedPage = await outputDoc.embedPage(sourcePage);
    } catch (error) {
      // Some upstream/generated blank pages have no Contents stream.
      // Keep them as blank pages instead of failing the whole preview.
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("missing contents")) {
        outputDoc.addPage([targetWidth, targetHeight]);
        continue;
      }
      logger.error("pdf_normalize_embed_page_failed", { error });
      throw error;
    }

    const sourceWidth = sourcePage.getWidth();
    const sourceHeight = sourcePage.getHeight();

    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = (targetWidth - drawWidth) / 2;
    const offsetY = (targetHeight - drawHeight) / 2;

    const page = outputDoc.addPage([targetWidth, targetHeight]);
    try {
      page.drawPage(embeddedPage, {
        x: offsetX,
        y: offsetY,
        width: drawWidth,
        height: drawHeight,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("missing contents")) {
        // Keep this page blank to preserve page count/stitching.
        continue;
      }
      logger.error("pdf_normalize_draw_page_failed", { error });
      throw error;
    }
  }

  return outputDoc;
}
