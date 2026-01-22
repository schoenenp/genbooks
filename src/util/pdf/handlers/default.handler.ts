import { PDFDocument } from "pdf-lib";
import { BaseHandler } from "./base.handler";
import type { TagDefinition, TagContext, HandlerResult } from "../types";

/**
 * Default handler for modules without specific form field requirements.
 *
 * This handler is used for:
 * - Static content modules (notes, rules, etc.)
 * - Any module type that doesn't have a specific handler
 *
 * The default handler simply copies pages from the template
 * without any form field processing.
 *
 * In preview mode, it limits to 5 pages per module.
 */
class DefaultHandler extends BaseHandler {
  readonly moduleType = "default";

  // No tags - default handler doesn't process form fields
  readonly tags: TagDefinition[] = [];

  async process(
    context: TagContext,
    templateBytes: Uint8Array,
  ): Promise<HandlerResult> {
    const { finalPdf, previewMode, isGrayscale } = context;

    const doc = await PDFDocument.load(templateBytes);

    if (isGrayscale) {
      // TODO: Implement grayscale conversion
      // this.convertToGrayscale(doc);
      console.log("GRAYSCALING....");
    }

    const totalPages = doc.getPageCount();
    const pagesToCopy = previewMode
      ? Math.min(totalPages, 5) // Limit to 5 pages per module in preview
      : totalPages;

    const pageIndices = Array.from({ length: pagesToCopy }, (_, i) => i);
    const pages = await finalPdf.copyPages(doc, pageIndices);
    pages.forEach((page) => finalPdf.addPage(page));

    return { pagesAdded: pages.length };
  }
}

export default new DefaultHandler();
