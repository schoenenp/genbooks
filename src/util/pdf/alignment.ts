import type { PDFDocument } from "pdf-lib";
import { getA4WithBleeding } from "./helpers";

/**
 * Add blank alignment pages if needed for booklet printing (divisible by 4)
 * and append the back cover pages.
 *
 * @param finalPdf - The PDF document being built
 * @param backCoverDoc - The back cover document (2 pages) to append at the end
 * @param previewMode - Whether we're in preview mode (skips alignment)
 * @returns Number of blank pages added (not including back cover)
 */
export async function finalizeDocument(
  finalPdf: PDFDocument,
  backCoverDoc: PDFDocument | undefined,
  previewMode: boolean,
): Promise<number> {
  let blankPagesAdded = 0;

  if (!previewMode) {
    const pagesSoFar = finalPdf.getPageCount();
    const pagesForBackCover = 2;
    const remainder = (pagesSoFar + pagesForBackCover) % 4;

    if (remainder !== 0) {
      const pagesToAdd = 4 - remainder;
      blankPagesAdded = pagesToAdd;

      const { width, height } = getA4WithBleeding();

      for (let i = 0; i < pagesToAdd; i++) {
        finalPdf.addPage([width, height]);
      }
    }
  }

  // Add back cover pages if available
  if (backCoverDoc) {
    const backCoverPages = await finalPdf.copyPages(backCoverDoc, [0, 1]);
    backCoverPages.forEach((page) => finalPdf.addPage(page));
  }

  return blankPagesAdded;
}

/**
 * Add an alignment blank page if the current page count is even.
 * Used within planner module to ensure proper spread layout.
 *
 * @returns true if a blank page was added
 */
export function addAlignmentPageIfNeeded(finalPdf: PDFDocument): boolean {
  if (finalPdf.getPageCount() % 2 === 0) {
    const { width, height } = getA4WithBleeding();
    finalPdf.addPage([width, height]);
    return true;
  }
  return false;
}
