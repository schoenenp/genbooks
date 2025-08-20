import { cmyk, PDFDocument, PDFName } from 'pdf-lib';
import type { PDFForm, PDFPage } from 'pdf-lib';
import { getHolidays, type DateItem } from '../book/functions';
import type { ColorCode, ModuleId } from '@/app/_components/module-changer';
import { colorToGrayscale } from './grayscaler';

// --- Helper Functions & Interfaces (Unchanged) ---

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface PDFModule {
  id: string;
  type: string;
  idx: number;
  pdfUrl: string;
}

type DetailsItem = {
  pageCount?: number;
  fullPageCount?: number;
  isCMYK: boolean;
  bPages: number;
  cPages: number;
};

interface Result {
  pdfFile: Uint8Array;
  details: DetailsItem;
  pdfUrl: string;
  isPreview?: boolean;
}

interface PageNumberOptions {
  fontSize?: number;
  color?: { c: number; m: number; y: number; k: number };
  position?:
    | 'bottom-center'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'top-right'
    | 'top-left';
  margin?: number;
}

interface ProcessingOptions {
  addPageNumbers?: boolean;
  pageNumberOptions?: PageNumberOptions;
  previewMode?: boolean;
  compressionLevel?: 'low' | 'medium' | 'high';
  addWatermark?: boolean;
  colorMap?: Map<string, 1 | 4>;
}

type BookDetails = {
  title: string;
  code?: string;
  addHolidays: boolean;
  period: {
    start?: Date;
    end?: Date;
  };
};

// --- Main PDFProcessor Class (Revised) ---

class PDFProcessor {
  private readonly currentDate = new Date();
  private readonly nextYearsDate: Date;
  private cleanupTasks: (() => void)[] = [];
  private backCoverDoc?: PDFDocument;

  constructor() {
    this.nextYearsDate = new Date(this.currentDate);
    this.nextYearsDate.setFullYear(this.currentDate.getFullYear() + 1);
  }

  /**
   * NEW: Calculates the final page counts for a full production document
   * without generating the entire PDF. This is used for accurate price
   * estimation in preview mode.
   */
  public async calculateFullPageCounts(
    bookDetails: BookDetails,
    modules: PDFModule[],
    colorMap: Map<ModuleId, ColorCode> = new Map<ModuleId, ColorCode>()
  ): Promise<{ fullPageCount: number; bPages: number; cPages: number }> {
    console.log('Calculating full page counts for production estimate...');

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
      let modulePages = 0;
      if (moduleItem.type === 'wochenplaner') {
        const { start, end } = bookDetails.period;
        const startTime = start ? new Date(start) : new Date(this.currentDate);
        startTime.setDate(startTime.getDate() - 7);
        const endTime = end ? new Date(end) : new Date(this.nextYearsDate);
        const diffTime = Math.abs(endTime.getTime() - startTime.getTime());
        const totalWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
        // Each week is 2 pages. We ignore internal alignment pages for this estimate
        // as it's complex and has a minor impact on the total.
        modulePages = (totalWeeks + 1) * 2;
      } else {
        const moduleBytes = await this.fetchPdfBytes(moduleItem.pdfUrl);
        const doc = await PDFDocument.load(moduleBytes);
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
   * The main processing method. Generates a PDF based on the provided options.
   * In preview mode, it generates a partial document.
   */
  async processPdfModules(
    bookDetails: BookDetails,
    modules: PDFModule[],
    options: ProcessingOptions = {}
  ): Promise<Result> {
    const {
      addPageNumbers = true,
      pageNumberOptions = {},
      previewMode = false,
      compressionLevel = 'low',
      addWatermark = false,
      colorMap = new Map(),
    } = options;
    try {
      const pageNumOptions = {
        fontSize: 9,
        color: { c: 0, m: 0, y: 0, k: 0.95 },
        position: 'bottom-center' as const,
        margin: 20,
        ...pageNumberOptions,
      };

      const { coverModule, sortedModules } =
        this.validateAndSortModules(modules);

      const finalPdf = await PDFDocument.create();

      if (!previewMode) {
        this.configureCompression(finalPdf, compressionLevel);
      }

      console.log(
        `Processing ${sortedModules.length} content modules in ${
          previewMode ? 'PREVIEW' : 'PRODUCTION'
        } mode`
      );

      await this.processCover(finalPdf, coverModule, bookDetails);
      console.log(
        `Cover processed. Current page count: ${finalPdf.getPageCount()}`
      );

      let fullPageCount = 0;
      let bPages = 0;
      let cPages = 0;

      // Cover pages are 4 pages total.
      const isCoverGrayscale = colorMap.get(coverModule.id) === 1;
      if (isCoverGrayscale) {
        bPages += 4;
      } else {
        cPages += 4;
      }
      fullPageCount += 4; // Front and back cover pages

      for (const moduleItem of sortedModules) {
        console.log(
          `Processing module: ${moduleItem.type} (idx: ${moduleItem.idx})`
        );

        const pagesAdded = await this.processModule(
          finalPdf,
          moduleItem,
          bookDetails,
          previewMode,
          colorMap
        );

        fullPageCount += pagesAdded;
        const isGrayscale = colorMap.get(moduleItem.id) === 1;
        if (isGrayscale) {
          bPages += pagesAdded;
        } else {
          cPages += pagesAdded;
        }

        console.log(
          `Module ${
            moduleItem.type
          } added ${pagesAdded} pages. Total pages: ${finalPdf.getPageCount()}`
        );
      }

      // Add alignment pages and back cover
      const blankPagesAdded = await this.finalizeDocument(finalPdf, previewMode);
      console.log(
        `Document finalized. Final page count: ${finalPdf.getPageCount()}`
      );

      // Add the blank pages to the counts
      fullPageCount += blankPagesAdded;
      bPages += blankPagesAdded;

      if (addWatermark) {
        await this.addWatermark(finalPdf);
        console.log('Watermark added to all pages');
      }

      if (addPageNumbers) {
        this.addPageNumbers(finalPdf, pageNumOptions);
        console.log('Page numbers added');
      }

      const result = await this.generateResult(
        finalPdf,
        previewMode,
        bPages,
        cPages
      );
      result.isPreview = previewMode;
      result.details.fullPageCount = fullPageCount;

      return result;
    } finally {
      this.cleanup();
    }
  }

  private validateAndSortModules(modules: PDFModule[]) {
    const coverModule = modules.find((m) => m.type === 'umschlag');
    if (!coverModule) throw new Error('Cover module not found');

    const sortedModules = modules
      .filter((m) => m.type !== 'umschlag')
      .sort((a, b) => a.idx - b.idx);

    return { coverModule, sortedModules };
  }

  private configureCompression(
    pdf: PDFDocument,
    level: 'low' | 'medium' | 'high'
  ) {
    const compressionSettings = {
      low: { imageQuality: 0.9, compressStreams: false },
      medium: { imageQuality: 0.7, compressStreams: true },
      high: { imageQuality: 0.5, compressStreams: true },
    };
    const settings = compressionSettings[level];
    try {
      const catalog = pdf.catalog;
      if (settings.compressStreams) {
        catalog.set(PDFName.of('CompressStreams'), PDFName.of('true'));
      }
    } catch (error) {
      console.warn('Could not apply compression settings:', error);
    }
  }

  private async processCover(
    finalPdf: PDFDocument,
    coverModule: PDFModule,
    bookDetails: BookDetails
  ): Promise<void> {
    const coverBytes = await this.fetchPdfBytes(coverModule.pdfUrl);
    const coverDoc = await PDFDocument.load(coverBytes);

    if (coverDoc.getPageCount() !== 4) {
      throw new Error('cover must have 4 pages');
    }

    const coverForm = coverDoc.getForm();
    const startYear = bookDetails.period.start?.getFullYear();
    const endYear = bookDetails.period.end?.getFullYear();

    coverForm.getTextField('BOOK_TITLE').setText(bookDetails.title);
    coverForm
      .getTextField('FROM_TO')
      .setText(startYear === endYear ? `${startYear}` : `${startYear}/${endYear}`);

    coverForm.flatten();
    const frontCoverPages = await finalPdf.copyPages(coverDoc, [0, 1]);
    frontCoverPages.forEach((page) => finalPdf.addPage(page));

    this.backCoverDoc = await PDFDocument.create();
    const backPages = await this.backCoverDoc.copyPages(coverDoc, [2, 3]);
    backPages.forEach((page) => this.backCoverDoc!.addPage(page));
  }

  private async processModule(
    finalPdf: PDFDocument,
    moduleItem: PDFModule,
    bookDetails: BookDetails,
    previewMode: boolean,
    colorMap?: Map<ModuleId, ColorCode>
  ): Promise<number> {
    const mid = moduleItem.id;
    const moduleBytes = await this.fetchPdfBytes(moduleItem.pdfUrl);
    let pagesAdded = 0;

    if (moduleItem.type === 'wochenplaner') {
      pagesAdded = await this.processPlannerModule(
        finalPdf,
        moduleBytes,
        bookDetails,
        previewMode,
        colorMap?.get(mid) === 1
      );
    } else {
      pagesAdded = await this.processRegularModule(
        finalPdf,
        moduleBytes,
        previewMode,
        colorMap?.get(mid) === 1
      );
    }
    return pagesAdded;
  }

  private async processPlannerModule(
    finalPdf: PDFDocument,
    templateBytes: Uint8Array,
    bookDetails: BookDetails,
    previewMode: boolean,
    isGrayscale = false
  ): Promise<number> {
    const plannerTemplate = await PDFDocument.load(templateBytes);
    if (plannerTemplate.getPageCount() !== 2) {
      throw new Error('planner must have 2 pages');
    }

    if (isGrayscale) {
      this.convertToGrayscale(plannerTemplate);
    }

    const { start, end } = bookDetails.period;
    const startTime = start ? new Date(start) : new Date(this.currentDate);
    startTime.setDate(startTime.getDate() - 7);
    const endTime = end ? new Date(end) : new Date(this.nextYearsDate);

    let holidays: DateItem[] = [];
    if (bookDetails.addHolidays) {
      holidays = await getHolidays({
        code: bookDetails.code,
        start: startTime,
        end: endTime,
      });
    }

    const diffTime = Math.abs(endTime.getTime() - startTime.getTime());
    const totalWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    const weeksToProcess = previewMode
      ? Math.min(totalWeeks + 1, 4) // Limit to 4 weeks in preview
      : totalWeeks + 1;

    console.log(
      `Processing ${weeksToProcess} weeks for planner module (total weeks: ${
        totalWeeks + 1
      })`
    );

    let pagesAdded = 0;
    for (let i = 0; i < weeksToProcess; i++) {
      // This internal alignment logic is complex to pre-calculate, but fine during generation.
      if (finalPdf.getPageCount() % 2 === 0) {
        const blankPageWidth = (210 / 25.4) * 72;
        const blankPageHeight = (297 / 25.4) * 72;
        const bleeding = (6 / 25.4) * 72;
        finalPdf.addPage([
          blankPageWidth + bleeding,
          blankPageHeight + bleeding,
        ]);
        pagesAdded++;
      }

      const weekDoc = await PDFDocument.load(templateBytes);
      const form = weekDoc.getForm();
      const weekDates = this.generateWeekDates(startTime, i);
      this.fillPlannerForm(form, weekDates, holidays);
      form.flatten();

      const plannerPages = await finalPdf.copyPages(
        weekDoc,
        weekDoc.getPageIndices()
      );
      plannerPages.forEach((page) => finalPdf.addPage(page));
      pagesAdded += plannerPages.length;
    }
    return pagesAdded;
  }

  private async processRegularModule(
    finalPdf: PDFDocument,
    moduleBytes: Uint8Array,
    previewMode: boolean,
    isGrayscale = false
  ): Promise<number> {
    const doc = await PDFDocument.load(moduleBytes);
    if (isGrayscale) {
      this.convertToGrayscale(doc);
    }

    const totalPages = doc.getPageCount();
    const pagesToCopy = previewMode
      ? Math.min(totalPages, 5) // Limit to 5 pages per module in preview
      : totalPages;

    const pageIndices = Array.from({ length: pagesToCopy }, (_, i) => i);
    const pages = await finalPdf.copyPages(doc, pageIndices);
    pages.forEach((page) => finalPdf.addPage(page));

    console.log(
      `Regular module: copied ${pages.length} of ${totalPages} pages`
    );
    return pages.length;
  }

  private async finalizeDocument(
    finalPdf: PDFDocument,
    previewMode: boolean
  ): Promise<number> {
    let pagesAdded = 0;
    if (!previewMode) {
      const pagesSoFar = finalPdf.getPageCount();
      const pagesForBackCover = 2;
      const remainder = (pagesSoFar + pagesForBackCover) % 4;

      if (remainder !== 0) {
        const pagesToAdd = 4 - remainder;
        pagesAdded = pagesToAdd;
        console.log(`Adding ${pagesToAdd} blank pages for booklet printing.`);

        const blankPageWidth = (210 / 25.4) * 72;
        const blankPageHeight = (297 / 25.4) * 72;
        const bleeding = (6 / 25.4) * 72;

        for (let i = 0; i < pagesToAdd; i++) {
          finalPdf.addPage([
            blankPageWidth + bleeding,
            blankPageHeight + bleeding,
          ]);
        }
      }
    }

    if (this.backCoverDoc) {
      const backCoverPages = await finalPdf.copyPages(this.backCoverDoc, [
        0,
        1,
      ]);
      backCoverPages.forEach((page) => finalPdf.addPage(page));
    }
    return pagesAdded;
  }

  private addPageNumbers(
    finalPdf: PDFDocument,
    options: Required<PageNumberOptions>
  ): void {
    const allPages = finalPdf.getPages();
    const contentPages = allPages.slice(2, -2);
    console.log(`Adding page numbers to ${contentPages.length} content pages`);
    contentPages.forEach((page, idx) => {
      const pageNumber = idx + 1;
      const position = pageNumber % 2 === 0 ? 'bottom-left' : 'bottom-right';
      this.addPageNumberToPage(page, pageNumber, {
        ...options,
        position,
      });
    });
  }

  private async addWatermark(pdfDoc: PDFDocument): Promise<void> {
    const pages = pdfDoc.getPages();
    try {
      const pngUrl = '/assets/watermark.png';
      const pngImageBytes = await fetch(pngUrl).then((res) =>
        res.arrayBuffer()
      );
      const pngImage = await pdfDoc.embedPng(pngImageBytes);
      const pngDims = pngImage.scale(1.4);
      for (const page of pages) {
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: pngDims.width,
          height: pngDims.height,
          opacity: 0.75,
        });
      }
      console.log(`Watermark applied to ${pages.length} pages`);
    } catch (error) {
      console.error('Failed to add watermark:', error);
    }
  }

  private convertToGrayscale(pdfDoc: PDFDocument): void {
    const convertedModule = colorToGrayscale(pdfDoc);
    return convertedModule;
  }

  private async generateResult(
    finalPdf: PDFDocument,
    previewMode: boolean,
    bPages: number,
    cPages: number
  ): Promise<Result> {
    const saveOptions = previewMode
      ? { useObjectStreams: false, addDefaultPage: false, objectsPerTick: 50 }
      : { useObjectStreams: true, addDefaultPage: false };

    const pdfBytes = await finalPdf.save(saveOptions);
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
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

  private async fetchPdfBytes(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch PDF: ${url}`);
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  private generateWeekDates(startDate: Date, weekIndex: number): Date[] {
    const dates: Date[] = [];
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + weekIndex * 7);
    const dayOfWeek = weekStart.getDay();
    const adjustment = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + adjustment);
    for (let i = 0; i < 5; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  }

  private fillPlannerForm(
    form: PDFForm,
    weekDates: Date[],
    holidays: DateItem[]
  ): void {
    const placeholders = ['xA', 'xB', 'xC', 'xD', 'xE'];
    const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));
    placeholders.forEach((placeholder, index) => {
      const currentDate = weekDates[index];
      if (currentDate) {
        try {
          const dateStringForLookup = formatDate(currentDate);
          const holidayName = holidayMap.get(dateStringForLookup);
          const field = form.getTextField(placeholder);
          if (holidayName) {
            const hfield = form.getTextField(`${placeholder}_Date`);
            hfield.setText(holidayName);
          }
          const dateForDisplay = currentDate.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
          });
          field.setText(dateForDisplay);
        } catch (e) {
          console.warn(
            `Form field "${placeholder}" not found in planner module.`,
            e
          );
        }
      }
    });
  }

  private addPageNumberToPage(
    page: PDFPage,
    pageNumber: number,
    options: Required<PageNumberOptions>
  ): void {
    const { width } = page.getArtBox();
    const { fontSize, color, position, margin } = options;
    let x: number;
    const y = margin;
    const textWidth = pageNumber.toString().length * fontSize * 0.6;

    if (position === 'bottom-left') {
      x = margin;
    } else if (position === 'bottom-right') {
      x = width - margin - textWidth;
    } else {
      // bottom-center
      x = width / 2 - textWidth / 2;
    }

    page.drawText(pageNumber.toString(), {
      x,
      y,
      size: fontSize,
      color: cmyk(color.c, color.m, color.y, color.k),
    });
  }

  private cleanup(): void {
    this.cleanupTasks.forEach((task) => {
      try {
        task();
      } catch (error) {
        console.warn('Cleanup task failed:', error);
      }
    });
    this.cleanupTasks = [];
    this.backCoverDoc = undefined;
  }
}

// --- Factory Functions (Revised) ---

export async function processPdfModules(
  bookDetails: BookDetails,
  modules: PDFModule[],
  options: {
    compressionLevel?: 'low' | 'medium' | 'high';
    addPageNumbers?: boolean;
    addWatermark?: boolean;
    colorMap?: Map<ModuleId, ColorCode>;
  } = {}
): Promise<Result> {
  console.time('PDF Generation Time');
  try {
    const processor = new PDFProcessor();
    // This generates the full PDF, so the returned counts will be accurate by default.
    return processor.processPdfModules(bookDetails, modules, {
      previewMode: false,
      compressionLevel: options.compressionLevel ?? 'low',
      addPageNumbers: options.addPageNumbers ?? true,
      addWatermark: options.addWatermark ?? false,
      colorMap: options.colorMap,
    });
  } finally {
    console.timeEnd('PDF Generation Time');
  }
}

export async function processPdfModulesPreview(
  bookDetails: BookDetails,
  modules: PDFModule[],
  options: {
    compressionLevel?: 'low' | 'medium' | 'high';
    addPageNumbers?: boolean;
    addWatermark?: boolean;
    colorMap?: Map<ModuleId, ColorCode>;
  } = {}
): Promise<Result> {
  console.time('PDF Preview Generation Time');
  try {
    const processor = new PDFProcessor();

    // 1. Calculate the TRUE full page counts for an accurate price estimate.
    //    This is now a clean, public method call.
    const fullCounts = await processor.calculateFullPageCounts(
      bookDetails,
      modules,
      options.colorMap
    );

    // 2. Generate the SMALL, partial PDF for the visual preview.
    const previewResult = await processor.processPdfModules(bookDetails, modules, {
      previewMode: true,
      compressionLevel: options.compressionLevel ?? 'high',
      addPageNumbers: options.addPageNumbers ?? true,
      addWatermark: options.addWatermark ?? true,
      colorMap: options.colorMap,
    });

    // 3. OVERRIDE the details of the preview result with the accurate counts.
    //    This gives the user the correct price estimate while showing a fast preview.
    previewResult.details.fullPageCount = fullCounts.fullPageCount;
    previewResult.details.bPages = fullCounts.bPages;
    previewResult.details.cPages = fullCounts.cPages;

    return previewResult;
  } finally {
    console.timeEnd('PDF Preview Generation Time');
  }
}