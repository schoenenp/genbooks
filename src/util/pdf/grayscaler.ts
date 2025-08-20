import { 
    PDFDict, PDFName, PDFArray, PDFStream, PDFRawStream,
    type PDFDocument, type PDFPageLeaf,
} from 'pdf-lib';

/**
 * Converts a PDF document's CMYK color profile to grayscale (K channel only)
 * This function modifies color spaces and color values without altering the document structure
 * 
 * @param doc - The PDFDocument to convert to grayscale
 * @throws Error if the conversion process fails
 */
export function colorToGrayscale(doc: PDFDocument): void {
  try {
    // Get the document catalog
    const catalog = doc.catalog;
    
    // Process all pages in the document
    const pages = doc.getPages();
    
    pages.forEach((page, pageIndex) => {
      try {
        // Get the page's resource dictionary
        const resources = page.node.Resources();
        
        if (resources) {
          // Convert color spaces
          convertColorSpaces(resources);
          
          // Convert colors in the page content
          convertPageColors(page.node);
        }
      } catch (error) {
        console.warn(`Warning: Could not process page ${pageIndex + 1}:`, error);
      }
    });
    
    // Process document-level color spaces
    if (catalog.has(PDFName.of('ColorSpace'))) {
      const colorSpaces = catalog.get(PDFName.of('ColorSpace'));
      if (colorSpaces instanceof PDFDict) {
        convertColorSpaces(colorSpaces);
      }
    }
    
  } catch (error) {
    throw new Error(`Failed to convert PDF to grayscale: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Converts CMYK color spaces to DeviceGray in a resource dictionary
 */
function convertColorSpaces(resources: PDFDict): void {
  const colorSpace = resources.get(PDFName.of('ColorSpace'));
  
  if (colorSpace instanceof PDFDict) {
    // Iterate through color space entries
    const entries = colorSpace.entries();
    
    entries.forEach(([key, value]) => {
      if (value instanceof PDFArray) {
        const colorSpaceType = value.get(0);
        
        // Convert CMYK color spaces to DeviceGray
        if (colorSpaceType === PDFName.of('DeviceCMYK')) {
          // Replace with DeviceGray
          const graySpace = PDFArray.withContext(colorSpace.context);
          graySpace.push(PDFName.of('DeviceGray'));
          colorSpace.set(key, graySpace);
        }
      }
    });
  }
}

/**
 * Converts colors in page content streams by parsing and modifying PDF operators
 */
function convertPageColors(pageNode: PDFPageLeaf): void {
  try {
    const contents = pageNode.Contents();
    
    if (contents) {
      if (contents instanceof PDFStream) {
        // Get the content stream data
        const streamData = contents.getBytes();
        const decodedData = contents.decode();
        
        // Parse and convert the content stream
        const convertedData = convertContentStream(decodedData);
        
        // Update the stream with converted data
        if (convertedData !== decodedData) {
          contents.setBytes(new TextEncoder().encode(convertedData));
        }
      } else if (Array.isArray(contents)) {
        // Handle multiple content streams
        contents.forEach(stream => {
          if (stream instanceof PDFStream) {
            const streamData = stream.getBytes();
            const decodedData = stream.decode();
            const convertedData = convertContentStream(decodedData);
            
            if (convertedData !== decodedData) {
              stream.setBytes(new TextEncoder().encode(convertedData));
            }
          }
        });
      }
    }
  } catch (error) {
    console.warn('Could not process page content:', error);
  }
}

/**
 * Parses and converts PDF content stream operators from CMYK to grayscale
 * 
 * @param contentStream - The decoded PDF content stream as string
 * @returns The converted content stream
 */
function convertContentStream(contentStream: string): string {
  // Split content stream into tokens
  const tokens = parseContentStream(contentStream);
  const convertedTokens: string[] = [];
  
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    
    // Handle CMYK color operators
    if (token === 'k' || token === 'K') {
      // Get the CMYK values (4 numbers before the operator)
      if (i >= 4) {
        const c = parseFloat(tokens[i - 4]);
        const m = parseFloat(tokens[i - 3]);
        const y = parseFloat(tokens[i - 2]);
        const k = parseFloat(tokens[i - 1]);
        
        // Convert to grayscale
        const gray = cmykToGrayscale(c, m, y, k);
        
        // Replace CMYK values with grayscale
        convertedTokens.splice(-4, 4); // Remove the 4 CMYK values
        convertedTokens.push(gray.toString());
        convertedTokens.push(token === 'k' ? 'g' : 'G'); // Convert operator
        
        i++;
        continue;
      }
    }
    
    // Handle RGB color operators (convert to grayscale if present)
    if (token === 'rg' || token === 'RG') {
      if (i >= 3) {
        const r = parseFloat(tokens[i - 3]);
        const g = parseFloat(tokens[i - 2]);
        const b = parseFloat(tokens[i - 1]);
        
        // Convert RGB to grayscale
        const gray = rgbToGrayscale(r, g, b);
        
        // Replace RGB values with grayscale
        convertedTokens.splice(-3, 3); // Remove the 3 RGB values
        convertedTokens.push(gray.toString());
        convertedTokens.push(token === 'rg' ? 'g' : 'G'); // Convert operator
        
        i++;
        continue;
      }
    }
    
    // Handle single grayscale operators (keep as is)
    if (token === 'g' || token === 'G') {
      convertedTokens.push(token);
      i++;
      continue;
    }
    
    // Handle other operators and values
    convertedTokens.push(token);
    i++;
  }
  
  return convertedTokens.join(' ');
}

/**
 * Parses PDF content stream into tokens
 * 
 * @param contentStream - The PDF content stream as string
 * @returns Array of tokens
 */
function parseContentStream(contentStream: string): string[] {
  // Remove comments and normalize whitespace
  const cleanedStream = contentStream
    .replace(/%.*$/gm, '') // Remove comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Split into tokens (numbers, operators, names, etc.)
  const tokens: string[] = [];
  const regex = /([0-9.-]+)|([a-zA-Z]+)|([^\s]+)/g;
  let match;
  
  while ((match = regex.exec(cleanedStream)) !== null) {
    if (match[1]) { // Number
      tokens.push(match[1]);
    } else if (match[2]) { // Word (operator or name)
      tokens.push(match[2]);
    } else if (match[3]) { // Other (brackets, etc.)
      tokens.push(match[3]);
    }
  }
  
  return tokens;
}

/**
 * Converts RGB values to grayscale using luminance formula
 * 
 * @param r - Red component (0-1)
 * @param g - Green component (0-1)
 * @param b - Blue component (0-1)
 * @returns Grayscale value (0-1)
 */
function rgbToGrayscale(r: number, g: number, b: number): number {
  // Standard luminance formula
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return Math.max(0, Math.min(1, gray));
}

/**
 * Converts a CMYK color value to grayscale using the K (black) channel
 * 
 * @param c - Cyan component (0-1)
 * @param m - Magenta component (0-1)
 * @param y - Yellow component (0-1)
 * @param k - Black component (0-1)
 * @returns Grayscale value (0-1)
 */
export function cmykToGrayscale(c: number, m: number, y: number, k: number): number {
  // Primary method: Use K channel directly
  // This preserves the black information which is most important for print
  const gray = k;
  
  // Optional: Add contribution from CMY channels for better tonal representation
  // Uncomment the line below if you want to include CMY information
  // gray = Math.min(1, k + (c + m + y) * 0.1);
  
  // Ensure the value is within valid range
  return Math.max(0, Math.min(1, gray));
}

/**
 * Alternative CMYK to grayscale conversion using luminance-based approach
 * This method considers all CMYK channels with weighted importance
 * 
 * @param c - Cyan component (0-1)
 * @param m - Magenta component (0-1)
 * @param y - Yellow component (0-1)
 * @param k - Black component (0-1)
 * @returns Grayscale value (0-1)
 */
export function cmykToGrayscaleLuminance(c: number, m: number, y: number, k: number): number {
  // Convert CMYK to approximate RGB first
  const r = (1 - c) * (1 - k);
  const g = (1 - m) * (1 - k);
  const b = (1 - y) * (1 - k);
  
  // Apply luminance formula to get grayscale
  const gray = 1 - (0.299 * r + 0.587 * g + 0.114 * b);
  
  return Math.max(0, Math.min(1, gray));
}

/**
 * Enhanced grayscale conversion that handles more PDF color operators
 * 
 * @param doc - The PDFDocument to convert
 * @param useLuminance - Whether to use luminance-based conversion (default: false)
 */
export function enhancedColorToGrayscale(doc: PDFDocument, useLuminance: boolean = false): void {
  // Store the conversion method to use
  const originalCmykToGrayscale = cmykToGrayscale;
  
  if (useLuminance) {
    // Temporarily replace the conversion function
    (globalThis as any).cmykToGrayscale = cmykToGrayscaleLuminance;
  }
  
  try {
    colorToGrayscale(doc);
  } finally {
    // Restore original function
    (globalThis as any).cmykToGrayscale = originalCmykToGrayscale;
  }
}