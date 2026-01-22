import type { PDFDocument } from "pdf-lib";

// Re-export types for compatibility
export type { ColorCode, ModuleId } from "@/app/_components/module-changer";
export type { DateItem } from "../book/functions";

// --- Core Types ---

export interface PDFModule {
  id: string;
  type: string;
  idx: number;
  pdfUrl: string;
}

export type DetailsItem = {
  pageCount?: number;
  fullPageCount?: number;
  isCMYK: boolean;
  bPages: number;
  cPages: number;
};

export interface Result {
  pdfFile: Uint8Array;
  details: DetailsItem;
  pdfUrl: string;
  isPreview?: boolean;
}

export interface PageNumberOptions {
  fontSize?: number;
  color?: { c: number; m: number; y: number; k: number };
  position?:
    | "bottom-center"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "top-right"
    | "top-left";
  margin?: number;
}

export interface ProcessingOptions {
  addPageNumbers?: boolean;
  pageNumberOptions?: PageNumberOptions;
  previewMode?: boolean;
  compressionLevel?: "low" | "medium" | "high";
  addWatermark?: boolean;
  colorMap?: Map<string, 1 | 4>;
}

export type BookDetails = {
  title: string;
  code?: string;
  addHolidays: boolean;
  period: {
    start?: Date;
    end?: Date;
  };
  customDates?: Array<{ date: string; name: string }>;
};

// --- Handler Types ---

/**
 * Tag definition - represents a single form field mapping in a PDF module.
 * Each tag knows its field name and how to compute its value from context.
 */
export interface TagDefinition {
  /** The PDF form field name (e.g., "BOOK_TITLE", "xA", "xA_Date") */
  fieldName: string;
  /** Function to compute the value from the current context */
  getValue: (context: TagContext) => string;
  /** Whether this field must exist in the PDF form */
  required?: boolean;
}

/**
 * Context passed to handlers containing all necessary data for processing.
 */
export interface TagContext {
  /** Book configuration details */
  bookDetails: BookDetails;
  /** Current module being processed */
  moduleItem: PDFModule;
  /** The final PDF document being built */
  finalPdf: PDFDocument;
  /** Whether we're generating a preview (limited pages) */
  previewMode: boolean;
  /** Whether this module should be grayscale */
  isGrayscale: boolean;

  // Planner-specific context (populated per week iteration)
  /** Current week index (0-based) */
  weekIndex?: number;
  /** Dates for the current week (Mon-Fri) */
  weekDates?: Date[];
  /** Map of date strings to holiday names */
  holidayMap?: Map<string, string>;
}

/**
 * Result returned by a handler's process method.
 */
export interface HandlerResult {
  /** Number of pages added to the final PDF */
  pagesAdded: number;
  /** Back cover document (only returned by cover handler) */
  backCoverDoc?: PDFDocument;
}

/**
 * Module handler interface - one implementation per module type.
 * Handlers are responsible for processing a specific type of PDF module,
 * filling its form fields according to their tag definitions.
 */
export interface ModuleHandler {
  /** Module type identifier (e.g., "umschlag", "wochenplaner") */
  readonly moduleType: string;

  /** Form field definitions this handler manages */
  readonly tags: TagDefinition[];

  /**
   * Validate the PDF document before processing.
   * @param doc - The loaded PDF document
   * @returns true if valid, false otherwise
   */
  validate?(doc: PDFDocument): Promise<boolean>;

  /**
   * Process the module and add pages to the final PDF.
   * @param context - Processing context with all necessary data
   * @param templateBytes - Raw PDF bytes of the module template
   * @returns HandlerResult with pages added and optional artifacts (like backCoverDoc)
   */
  process(
    context: TagContext,
    templateBytes: Uint8Array,
  ): Promise<HandlerResult>;

  /**
   * Calculate page count without generating the PDF.
   * Used for accurate price estimation in preview mode.
   * @param context - Processing context
   * @param templateBytes - Raw PDF bytes (may be needed for page count)
   * @returns Expected number of pages this module will add
   */
  calculatePageCount?(
    context: TagContext,
    templateBytes: Uint8Array,
  ): Promise<number>;
}

// --- Utility Types ---

export type RequiredPageNumberOptions = Required<PageNumberOptions>;
