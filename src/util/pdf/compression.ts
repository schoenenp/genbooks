import { PDFName, type PDFDocument } from "pdf-lib";
import { logger } from "@/util/logger";

export type CompressionLevel = "low" | "medium" | "high";

interface CompressionSettings {
  imageQuality: number;
  compressStreams: boolean;
}

const COMPRESSION_SETTINGS: Record<CompressionLevel, CompressionSettings> = {
  low: { imageQuality: 0.9, compressStreams: false },
  medium: { imageQuality: 0.7, compressStreams: true },
  high: { imageQuality: 0.5, compressStreams: true },
};

/**
 * Configure compression settings for a PDF document
 */
export function configureCompression(
  pdf: PDFDocument,
  level: CompressionLevel = "low",
): void {
  const settings = COMPRESSION_SETTINGS[level];

  try {
    const catalog = pdf.catalog;
    if (settings.compressStreams) {
      catalog.set(PDFName.of("CompressStreams"), PDFName.of("true"));
    }
  } catch (error) {
    logger.warn("pdf_compression_settings_failed", { error });
  }
}
