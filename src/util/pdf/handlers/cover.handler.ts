import { PDFDocument } from "pdf-lib";
import { BaseHandler } from "./base.handler";
import type { TagDefinition, TagContext, HandlerResult } from "../types";
import { convertPdfToGrayscale } from "../grayscale";

/**
 * Handler for "umschlag" (cover) modules.
 *
 * Covers are special modules that:
 * - Must have exactly 4 pages
 * - Pages 0-1 are front cover (added immediately)
 * - Pages 2-3 are back cover (stored for later, added at document end)
 *
 * Available tags:
 * - BOOK_TITLE: The title of the book
 * - FROM_TO: The date range (e.g., "2024" or "2024/2025")
 *
 * To add more tags, simply add them to the tags array below.
 */
class CoverHandler extends BaseHandler {
  readonly moduleType = "umschlag";

  readonly tags: TagDefinition[] = [
    {
      fieldName: "BOOK_TITLE",
      getValue: (ctx) => ctx.bookDetails.title,
      required: true,
    },
    {
      fieldName: "FROM_TO",
      getValue: (ctx) => {
        const start = ctx.bookDetails.period.start?.getFullYear();
        const end = ctx.bookDetails.period.end?.getFullYear();
        if (!start) return "";
        return start === end ? `${start}` : `${start}/${end}`;
      },
      required: true,
    },
    // Add more cover tags here as needed:
    // {
    //   fieldName: "SCHOOL_NAME",
    //   getValue: (ctx) => ctx.bookDetails.schoolName ?? "",
    // },
    // {
    //   fieldName: "CLASS_NAME",
    //   getValue: (ctx) => ctx.bookDetails.className ?? "",
    // },
  ];

  async process(
    context: TagContext,
    templateBytes: Uint8Array,
  ): Promise<HandlerResult> {
    const coverDoc = await PDFDocument.load(templateBytes);

    if (coverDoc.getPageCount() !== 4) {
      throw new Error("Cover module must have exactly 4 pages");
    }

    // Fill form fields
    const form = coverDoc.getForm();
    this.fillTags(form, context);
    form.flatten();

    let processedDoc = coverDoc;
    if (context.isGrayscale) {
      const grayscaleBytes = await convertPdfToGrayscale(
        await coverDoc.save(),
        { apiKey: context.grayscaleApiKey },
      );
      processedDoc = await PDFDocument.load(grayscaleBytes);
    }

    // Add front cover pages (0, 1)
    const frontPages = await context.finalPdf.copyPages(processedDoc, [0, 1]);
    frontPages.forEach((page) => context.finalPdf.addPage(page));

    // Create back cover document (pages 2, 3) to return for later use
    const backCoverDoc = await PDFDocument.create();
    const backPages = await backCoverDoc.copyPages(processedDoc, [2, 3]);
    backPages.forEach((page) => backCoverDoc.addPage(page));

    // Return front cover pages added (2) and back cover doc for finalization
    return {
      pagesAdded: 2,
      backCoverDoc,
    };
  }

  async calculatePageCount(): Promise<number> {
    // Cover always contributes 4 pages (2 front + 2 back)
    return 4;
  }
}

const coverHandler = new CoverHandler();
export default coverHandler;
