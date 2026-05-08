import { PDFDocument } from "pdf-lib";
import { BaseHandler } from "./base.handler";
import type { TagDefinition, TagContext, HandlerResult } from "../types";
import { formatDate, generateWeekDates, getA4WithBleeding } from "../helpers";
import { getHolidays, type DateItem } from "../../book/functions";
import { normalizeDate } from "../helpers";
import { convertPdfToGrayscale } from "../grayscale";
import { convertPdfToPreviewGrayscale } from "../preview-grayscale";
import { estimatePlannerPageCount } from "./planner-page-count";

function formatGermanLongDate(date: Date, includeYear: boolean): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleDateString("de-DE", { month: "long" });
  const yearSuffix = includeYear ? ` ${date.getFullYear()}` : "";
  return `${day}. ${month}${yearSuffix}`;
}

export function formatPlannerWeekRange(weekDates?: Date[]): string {
  const start = weekDates?.[0];
  const end = weekDates?.[4];

  if (!start || !end) return "";

  if (start.getFullYear() === end.getFullYear()) {
    return `${formatGermanLongDate(start, false)} bis ${formatGermanLongDate(
      end,
      true,
    )}`;
  }

  return `${formatGermanLongDate(start, true)} bis ${formatGermanLongDate(
    end,
    true,
  )}`;
}

export function getIsoWeekNumber(date: Date): number {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(
    (((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7,
  );
}

/**
 * Handler for "wochenplaner" (weekly planner) modules.
 *
 * Planners are special modules that:
 * - Must have exactly 2 pages (one spread per week)
 * - Are duplicated for each week in the date range
 * - Include alignment pages for proper spread layout
 *
 * Available tags (repeated per week):
 * - xA, xB, xC, xD, xE: Day dates (Mon-Fri) formatted as DD.MM
 * - xA_Date, xB_Date, xC_Date, xD_Date, xE_Date: Holiday names for each day
 * - WEEK_FROMTO: Week range formatted as "01. Januar bis 05. Januar 2026"
 * - WEEK_NUM: ISO calendar week number for the current planner week
 *
 * To add more tags, add them to the tags array and implement
 * the value getter using the weekDates from context.
 */
class PlannerHandler extends BaseHandler {
  readonly moduleType = "wochenplaner";

  readonly tags: TagDefinition[] = [
    // Day date fields (Mon-Fri)
    { fieldName: "xA", getValue: (ctx) => this.formatDay(ctx, 0) },
    { fieldName: "xB", getValue: (ctx) => this.formatDay(ctx, 1) },
    { fieldName: "xC", getValue: (ctx) => this.formatDay(ctx, 2) },
    { fieldName: "xD", getValue: (ctx) => this.formatDay(ctx, 3) },
    { fieldName: "xE", getValue: (ctx) => this.formatDay(ctx, 4) },

    // Holiday name fields (Mon-Fri)
    { fieldName: "xA_Date", getValue: (ctx) => this.getHoliday(ctx, 0) },
    { fieldName: "xB_Date", getValue: (ctx) => this.getHoliday(ctx, 1) },
    { fieldName: "xC_Date", getValue: (ctx) => this.getHoliday(ctx, 2) },
    { fieldName: "xD_Date", getValue: (ctx) => this.getHoliday(ctx, 3) },
    { fieldName: "xE_Date", getValue: (ctx) => this.getHoliday(ctx, 4) },
    { fieldName: "WEEK_FROMTO", getValue: (ctx) => this.getWeekRange(ctx) },
    { fieldName: "WEEK_NUM", getValue: (ctx) => this.getWeekNumber(ctx) },

    // Add more planner tags here as needed:
    // { fieldName: "MONTH_NAME", getValue: (ctx) => this.getMonthName(ctx) },
  ];

  /**
   * Format a weekday date as DD.MM
   */
  private formatDay(ctx: TagContext, dayIndex: number): string {
    const date = ctx.weekDates?.[dayIndex];
    if (!date) return "";
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}.${month}`;
  }

  /**
   * Get the holiday name for a specific day, if any
   */
  private getHoliday(ctx: TagContext, dayIndex: number): string {
    const date = ctx.weekDates?.[dayIndex];
    if (!date || !ctx.holidayMap) return "";
    return ctx.holidayMap.get(formatDate(date)) ?? "";
  }

  private getWeekRange(ctx: TagContext): string {
    return formatPlannerWeekRange(ctx.weekDates);
  }

  private getWeekNumber(ctx: TagContext): string {
    const weekStart = ctx.weekDates?.[0];
    if (!weekStart) return "";
    return `KW ${getIsoWeekNumber(weekStart).toString().padStart(2, "0")}`;
  }

  async process(
    context: TagContext,
    templateBytes: Uint8Array,
  ): Promise<HandlerResult> {
    const { bookDetails, finalPdf, previewMode, isGrayscale, grayscaleApiKey } =
      context;

    // Validate template
    const templateDoc = await PDFDocument.load(templateBytes);
    if (templateDoc.getPageCount() !== 2) {
      throw new Error("Planner module must have exactly 2 pages");
    }

    // Calculate date range
    const currentDate = new Date();
    const nextYearsDate = new Date(currentDate);
    nextYearsDate.setFullYear(currentDate.getFullYear() + 1);

    const startTime = bookDetails.period.start
      ? new Date(bookDetails.period.start)
      : new Date(currentDate);
    startTime.setDate(startTime.getDate() - 7);

    const endTime = bookDetails.period.end
      ? new Date(bookDetails.period.end)
      : new Date(nextYearsDate);

    // Build holiday map
    const holidayMap = await this.buildHolidayMap(
      bookDetails,
      startTime,
      endTime,
    );

    // Calculate weeks to process
    const diffTime = Math.abs(endTime.getTime() - startTime.getTime());
    const totalWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    const weeksToProcess = previewMode
      ? Math.min(totalWeeks + 1, 4) // Limit to 4 weeks in preview
      : totalWeeks + 1;

    const moduleDoc = await PDFDocument.create();
    let workingPageCount = finalPdf.getPageCount();

    for (let weekIndex = 0; weekIndex < weeksToProcess; weekIndex++) {
      // Add alignment page if needed (planner spreads should start on odd pages)
      if (workingPageCount % 2 === 0) {
        const { width, height } = getA4WithBleeding();
        moduleDoc.addPage([width, height]);
        workingPageCount++;
      }

      // Load fresh template for this week
      const weekDoc = await PDFDocument.load(templateBytes);
      const form = weekDoc.getForm();

      // Generate week dates and create week-specific context
      const weekDates = generateWeekDates(startTime, weekIndex);
      const weekContext: TagContext = {
        ...context,
        weekIndex,
        weekDates,
        holidayMap,
      };

      // Fill tags and flatten
      this.fillTags(form, weekContext);
      form.flatten();

      // Copy pages to final PDF
      const pages = await moduleDoc.copyPages(weekDoc, weekDoc.getPageIndices());
      pages.forEach((page) => moduleDoc.addPage(page));
      workingPageCount += pages.length;
    }

    let outputDoc = moduleDoc;
    if (isGrayscale) {
      const moduleBytes = await moduleDoc.save();
      const grayscaleBytes = previewMode
        ? await convertPdfToPreviewGrayscale(moduleBytes)
        : await convertPdfToGrayscale(moduleBytes, {
          apiKey: grayscaleApiKey,
        });
      outputDoc = await PDFDocument.load(grayscaleBytes);
    }

    const pages = await finalPdf.copyPages(
      outputDoc,
      outputDoc.getPageIndices(),
    );
    pages.forEach((page) => finalPdf.addPage(page));

    return { pagesAdded: pages.length };
  }

  /**
   * Build a map of dates to holiday names
   */
  private async buildHolidayMap(
    bookDetails: TagContext["bookDetails"],
    startTime: Date,
    endTime: Date,
  ): Promise<Map<string, string>> {
    let holidays: DateItem[] = [];

    if (bookDetails.addHolidays) {
      holidays = await getHolidays({
        code: bookDetails.code,
        country: bookDetails.country,
        start: startTime,
        end: endTime,
      });
    }

    // Merge custom dates
    if (bookDetails.customDates && bookDetails.customDates.length > 0) {
      const customEvents = bookDetails.customDates.map((d) => ({
        id: normalizeDate(d.date),
        name: d.name,
        date: normalizeDate(d.date),
      }));

      // Combine and sort by date
      holidays = [...holidays, ...customEvents].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    }

    return new Map(holidays.map((h) => [h.date, h.name]));
  }

  async calculatePageCount(context: TagContext): Promise<number> {
    return estimatePlannerPageCount({
      periodStart: context.bookDetails.period.start,
      periodEnd: context.bookDetails.period.end,
      previewMode: context.previewMode,
      currentPageCount:
        context.currentPageCount ?? context.finalPdf.getPageCount(),
    });
  }
}

const plannerHandler = new PlannerHandler();
export default plannerHandler;
