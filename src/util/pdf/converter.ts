import { PDFDocument } from "pdf-lib";
import type { ColorCode, ModuleId } from "@/app/_components/module-changer";

// Import from modular utilities
import { registry } from "./handlers";
import { addPageNumbers, DEFAULT_PAGE_NUMBER_OPTIONS } from "./pagination";
import { addWatermark } from "./watermark";
import { configureCompression } from "./compression";
import { finalizeDocument } from "./alignment";
import { fetchPdfBytes } from "./helpers";
import type {
  BookDetails,
  BookFormat,
  PDFModule,
  ProcessingOptions,
  Result,
  TagContext,
  DetailsItem,
} from "./types";

// --- Main PDFProcessor Class (Refactored) ---

class PDFProcessor {
  private readonly currentDate = new Date();
  private readonly nextYearsDate: Date;
  private cleanupTasks: (() => void)[] = [];

  constructor() {
    this.nextYearsDate = new Date(this.currentDate);
    this.nextYearsDate.setFullYear(this.currentDate.getFullYear() + 1);
  }

  /**
   * Calculates the final page counts for a full production document
   * without generating the entire PDF. Used for accurate price estimation.
   */
  public async calculateFullPageCounts(
    bookDetails: BookDetails,
    modules: PDFModule[],
    colorMap: Map<ModuleId, ColorCode> = new Map<ModuleId, ColorCode>(),
  ): Promise<{ fullPageCount: number; bPages: number; cPages: number }> {
    const { coverModule, sortedModules } = this.validateAndSortModules(modules);

    let calculatedPageCount = 0;
    let bPages = 0;
    let cPages = 0;

    // 1. Account for Cover (always 4 pages)
    calculatedPageCount += 4;
    const isCoverGrayscale = colorMap.get(coverModule.id) === 1;
    if (isCoverGrayscale) {
      bPages += 4;
    } else {
      cPages += 4;
    }

    // 2. Account for all pages in content modules
    for (const moduleItem of sortedModules) {
      const handler = registry.getOrDefault(moduleItem.type);
      const templateBytes = await fetchPdfBytes(moduleItem.pdfUrl);

      // Create minimal context for page count calculation
      const context: TagContext = {
        bookDetails,
        moduleItem,
        finalPdf: await PDFDocument.create(), // Dummy, not used
        format: "DIN A5",
        previewMode: false,
        isGrayscale: colorMap.get(moduleItem.id) === 1,
        currentPageCount: calculatedPageCount,
      };

      let modulePages: number;
      if (handler.calculatePageCount) {
        modulePages = await handler.calculatePageCount(context, templateBytes);
      } else {
        const doc = await PDFDocument.load(templateBytes);
        modulePages = doc.getPageCount();
      }

      calculatedPageCount += modulePages;
      const isGrayscale = colorMap.get(moduleItem.id) === 1;
      if (isGrayscale) {
        bPages += modulePages;
      } else {
        cPages += modulePages;
      }
    }

    // 3. Account for final blank alignment pages
    const remainder = calculatedPageCount % 4;
    if (remainder !== 0) {
      const pagesToAdd = 4 - remainder;
      calculatedPageCount += pagesToAdd;
      bPages += pagesToAdd; // Alignment pages are always blank (b/w)
    }

    return { fullPageCount: calculatedPageCount, bPages, cPages };
  }

  /**
   * Main processing method. Generates a PDF based on the provided options.
   */
  async processPdfModules(
    bookDetails: BookDetails,
    modules: PDFModule[],
    options: ProcessingOptions = {},
  ): Promise<Result> {
    const {
      addPageNumbers: shouldAddPageNumbers = true,
      pageNumberOptions = {},
      previewMode = false,
      compressionLevel = "low",
      addWatermark: shouldAddWatermark = false,
      format = "DIN A5",
      colorMap = new Map(),
      grayscaleApiKey,
    } = options;

    try {
      const pageNumOptions = {
        ...DEFAULT_PAGE_NUMBER_OPTIONS,
        ...pageNumberOptions,
      };

      const { coverModule, sortedModules } =
        this.validateAndSortModules(modules);

      const finalPdf = await PDFDocument.create();

      if (!previewMode) {
        configureCompression(finalPdf, compressionLevel);
      }

      const isCoverGrayscale = colorMap.get(coverModule.id) === 1;

      // Create shared context object
      const context: TagContext = {
        bookDetails,
        moduleItem: coverModule,
        finalPdf,
        format,
        previewMode,
        isGrayscale: isCoverGrayscale,
        grayscaleApiKey,
      };

      // Process cover first and capture back cover doc
      const coverBytes = await fetchPdfBytes(coverModule.pdfUrl);
      const coverHandler = registry.get("umschlag");
      if (!coverHandler) {
        throw new Error("Cover handler not found");
      }
      const coverResult = await coverHandler.process(
        { ...context, moduleItem: coverModule },
        coverBytes,
      );

      // Store backCoverDoc from cover handler result
      const backCoverDoc = coverResult.backCoverDoc;

      let fullPageCount = 0;
      let bPages = 0;
      let cPages = 0;

      // Cover pages are 4 pages total
      if (isCoverGrayscale) {
        bPages += 4;
      } else {
        cPages += 4;
      }
      fullPageCount += 4;

      // Process content modules
      for (const moduleItem of sortedModules) {
        const handler = registry.getOrDefault(moduleItem.type);
        const templateBytes = await fetchPdfBytes(moduleItem.pdfUrl);
        const isGrayscale = colorMap.get(moduleItem.id) === 1;

        const result = await handler.process(
          { ...context, moduleItem, isGrayscale },
          templateBytes,
        );

        fullPageCount += result.pagesAdded;
        if (isGrayscale) {
          bPages += result.pagesAdded;
        } else {
          cPages += result.pagesAdded;
        }
      }

      // Add alignment pages and back cover
      const blankPagesAdded = await finalizeDocument(
        finalPdf,
        backCoverDoc,
        previewMode,
      );
      fullPageCount += blankPagesAdded;
      bPages += blankPagesAdded;

      if (shouldAddWatermark) {
        await addWatermark(finalPdf);
      }

      if (shouldAddPageNumbers) {
        addPageNumbers(finalPdf, pageNumOptions);
      }

      const result = await this.generateResult(
        finalPdf,
        previewMode,
        bPages,
        cPages,
      );
      result.isPreview = previewMode;
      result.details.fullPageCount = fullPageCount;

      return result;
    } finally {
      this.cleanup();
    }
  }

  private validateAndSortModules(modules: PDFModule[]) {
    const coverModule = modules.find((m) => m.type === "umschlag");
    if (!coverModule) throw new Error("Cover module not found");

    const sortedModules = modules
      .filter((m) => m.type !== "umschlag")
      .sort((a, b) => a.idx - b.idx);

    return { coverModule, sortedModules };
  }

  private async generateResult(
    finalPdf: PDFDocument,
    previewMode: boolean,
    bPages: number,
    cPages: number,
  ): Promise<Result> {
    const saveOptions = previewMode
      ? { useObjectStreams: false, addDefaultPage: false, objectsPerTick: 50 }
      : { useObjectStreams: true, addDefaultPage: false };

    const pdfBytes = await finalPdf.save(saveOptions);
    const pdfBlob = new Blob([pdfBytes as BlobPart], {
      type: "application/pdf",
    });
    const pdfUrl = URL.createObjectURL(pdfBlob);
    this.cleanupTasks.push(() => URL.revokeObjectURL(pdfUrl));

    return {
      pdfFile: pdfBytes,
      details: {
        pageCount: finalPdf.getPageCount(),
        isCMYK: false,
        bPages,
        cPages,
      },
      pdfUrl: pdfUrl,
    };
  }

  private cleanup(): void {
    this.cleanupTasks.forEach((task) => {
      try {
        task();
      } catch (error) {
        console.warn("Cleanup task failed:", error);
      }
    });
    this.cleanupTasks = [];
  }
}

// --- Factory Functions (Preserved API) ---

/**
 * Process PDF modules for production output.
 * This is the main entry point for generating final PDFs.
 */
export async function processPdfModules(
  bookDetails: BookDetails,
  modules: PDFModule[],
  options: {
    compressionLevel?: "low" | "medium" | "high";
    addPageNumbers?: boolean;
    addWatermark?: boolean;
    format?: BookFormat;
    colorMap?: Map<ModuleId, ColorCode>;
    grayscaleApiKey?: string;
  } = {},
): Promise<Result> {
  console.time("PDF Generation Time");
  try {
    const processor = new PDFProcessor();
    return processor.processPdfModules(bookDetails, modules, {
      previewMode: false,
      compressionLevel: options.compressionLevel ?? "low",
      addPageNumbers: options.addPageNumbers ?? true,
      addWatermark: options.addWatermark ?? false,
      format: options.format ?? "DIN A5",
      colorMap: options.colorMap,
      grayscaleApiKey: options.grayscaleApiKey,
    });
  } finally {
    console.timeEnd("PDF Generation Time");
  }
}

/**
 * Process PDF modules for preview output.
 * Generates a smaller preview PDF with accurate page count estimation.
 */
export async function processPdfModulesPreview(
  bookDetails: BookDetails,
  modules: PDFModule[],
  options: {
    compressionLevel?: "low" | "medium" | "high";
    addPageNumbers?: boolean;
    addWatermark?: boolean;
    format?: BookFormat;
    colorMap?: Map<ModuleId, ColorCode>;
    grayscaleApiKey?: string;
  } = {},
): Promise<Result> {
  console.time("PDF Preview Generation Time");
  try {
    const processor = new PDFProcessor();

    // 1. Calculate the TRUE full page counts for an accurate price estimate.
    const fullCounts = await processor.calculateFullPageCounts(
      bookDetails,
      modules,
      options.colorMap,
    );

    // 2. Generate the SMALL, partial PDF for the visual preview.
    const previewResult = await processor.processPdfModules(
      bookDetails,
      modules,
      {
        previewMode: true,
        compressionLevel: options.compressionLevel ?? "high",
        addPageNumbers: options.addPageNumbers ?? true,
        addWatermark: options.addWatermark ?? true,
        format: options.format ?? "DIN A5",
        colorMap: options.colorMap,
        grayscaleApiKey: options.grayscaleApiKey,
      },
    );

    // Override with accurate counts from full calculation
    previewResult.details.fullPageCount = fullCounts.fullPageCount;
    previewResult.details.bPages = fullCounts.bPages;
    previewResult.details.cPages = fullCounts.cPages;

    return previewResult;
  } finally {
    console.timeEnd("PDF Preview Generation Time");
  }
}

/**
 * Calculate full page counts for pricing without generating PDF output.
 */
export async function calculatePdfPageCounts(
  bookDetails: BookDetails,
  modules: PDFModule[],
  options: {
    colorMap?: Map<ModuleId, ColorCode>;
  } = {},
): Promise<{ fullPageCount: number; bPages: number; cPages: number }> {
  const processor = new PDFProcessor();
  return processor.calculateFullPageCounts(bookDetails, modules, options.colorMap);
}

// Re-export types for backwards compatibility
export type { BookDetails, PDFModule, ProcessingOptions, Result, DetailsItem };
