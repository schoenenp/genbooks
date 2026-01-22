import { PDFDocument } from "pdf-lib";

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalize a date string by extracting just the date part (before 'T')
 */
export function normalizeDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split("T");
  return parts[0] ?? "";
}

/**
 * Generate an array of weekday dates (Mon-Fri) for a given week index
 */
export function generateWeekDates(startDate: Date, weekIndex: number): Date[] {
  const dates: Date[] = [];
  const weekStart = new Date(startDate);
  weekStart.setDate(startDate.getDate() + weekIndex * 7);

  // Adjust to Monday
  const dayOfWeek = weekStart.getDay();
  const adjustment = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + adjustment);

  // Generate Mon-Fri
  for (let i = 0; i < 5; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(date);
  }

  return dates;
}

/**
 * Fetch PDF bytes from a URL, with fallback to blank page on error
 */
export async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  if (!url || url === "notizen.pdf" || url.trim() === "") {
    console.warn(`Invalid PDF URL: ${url}, returning blank page`);
    return getBlankPagePdfBytes();
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch PDF: ${url}, returning blank page`);
      return getBlankPagePdfBytes();
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.warn(`Error fetching PDF: ${url}, returning blank page`, error);
    return getBlankPagePdfBytes();
  }
}

/**
 * Generate a blank A4 PDF page
 */
export async function getBlankPagePdfBytes(): Promise<Uint8Array> {
  const blankPdf = await PDFDocument.create();
  const a4Width = (210 / 25.4) * 72;
  const a4Height = (297 / 25.4) * 72;
  blankPdf.addPage([a4Width, a4Height]);
  return blankPdf.save();
}

/**
 * Standard A4 dimensions with bleeding for print
 */
export const PAGE_DIMENSIONS = {
  /** A4 width in points */
  A4_WIDTH: (210 / 25.4) * 72,
  /** A4 height in points */
  A4_HEIGHT: (297 / 25.4) * 72,
  /** Standard bleeding in points (6mm) */
  BLEEDING: (6 / 25.4) * 72,
} as const;

/**
 * Get A4 dimensions with bleeding
 */
export function getA4WithBleeding(): { width: number; height: number } {
  return {
    width: PAGE_DIMENSIONS.A4_WIDTH + PAGE_DIMENSIONS.BLEEDING,
    height: PAGE_DIMENSIONS.A4_HEIGHT + PAGE_DIMENSIONS.BLEEDING,
  };
}
