/**
 * PDF Processing Module
 *
 * This module provides a plugin-based architecture for processing PDF modules.
 *
 * Main exports:
 * - processPdfModules: Generate production PDFs
 * - processPdfModulesPreview: Generate preview PDFs with accurate page counts
 *
 * Handler system:
 * - registry: Access to the handler registry
 * - BaseHandler: Base class for creating new handlers
 *
 * To add a new handler:
 * 1. Create handlers/your-type.handler.ts extending BaseHandler
 * 2. Import and add to handlers/index.ts allHandlers array
 */

// Main processing functions (backwards compatible)
export { processPdfModules, processPdfModulesPreview } from "./converter";

// Types
export type {
  BookDetails,
  PDFModule,
  ProcessingOptions,
  Result,
  DetailsItem,
  TagContext,
  TagDefinition,
  ModuleHandler,
  HandlerResult,
  PageNumberOptions,
} from "./types";

// Handler system for advanced usage
export { registry, BaseHandler } from "./handlers";

// Utilities (for use in custom handlers)
export {
  formatDate,
  normalizeDate,
  generateWeekDates,
  fetchPdfBytes,
  getBlankPagePdfBytes,
  getA4WithBleeding,
  PAGE_DIMENSIONS,
} from "./helpers";

// Individual utilities (for advanced customization)
export { addPageNumbers, addPageNumberToPage } from "./pagination";
export { addWatermark } from "./watermark";
export { configureCompression } from "./compression";
export { finalizeDocument, addAlignmentPageIfNeeded } from "./alignment";
