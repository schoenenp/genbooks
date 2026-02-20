import type { PDFDocument } from "pdf-lib";
import { logger } from "@/util/logger";

type AppendPagesSafelyInput = {
  targetDoc: PDFDocument;
  sourceDoc: PDFDocument;
  pageIndices: number[];
  context: string;
};

export async function appendPagesSafely(
  input: AppendPagesSafelyInput,
): Promise<{ appended: number; blankFallbacks: number }> {
  const { targetDoc, sourceDoc, pageIndices, context } = input;
  let appended = 0;
  let blankFallbacks = 0;

  for (const pageIndex of pageIndices) {
    try {
      const copied = await targetDoc.copyPages(sourceDoc, [pageIndex]);
      const page = copied[0];
      if (page) {
        targetDoc.addPage(page);
        appended += 1;
      }
      continue;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("missing contents")) {
        logger.error("pdf_copy_page_failed", { context, pageIndex, error });
        throw error;
      }
    }

    // Fallback: keep pagination stable by inserting a blank page with source size.
    const sourcePage = sourceDoc.getPage(pageIndex);
    const width = sourcePage.getWidth();
    const height = sourcePage.getHeight();
    targetDoc.addPage([width, height]);
    appended += 1;
    blankFallbacks += 1;
    logger.warn("pdf_copy_page_missing_contents_fallback", {
      context,
      pageIndex,
      width,
      height,
    });
  }

  return { appended, blankFallbacks };
}

