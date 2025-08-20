import { env } from "@/env";

// Define types for clarity
export interface FileItem {
    name: string;
    src: string;
    type: FileType;
    size: number;
  }
  
  type FileType = "PDF" | "IMAGE_PNG" | "IMAGE_JPEG";
  
  interface UploadResponse {
    files: FileData | FileData[];
  }
  
  interface FileData {
    fileName: string;
    originalName?: string;
    url: string;
    mimetype: string;
    size:number;
  }
  

  
  export async function uploadData(
  files:{
    data: Buffer,
    name: string,
  }[]
  ): Promise<FileItem[]> {

  const UPLOAD_URL = env.UPLOAD_URL_LINK
  const API_KEY = env.UPLOAD_API_KEY

  // Validate environment variables
  if (!UPLOAD_URL || !API_KEY) {
    throw new Error("Missing required environment variables: UPLOAD_URL_LINK or UPLOAD_API_KEY");
  }
    // Validate input
    if (!files || (Array.isArray(files) && files.length === 0)) {
      return []
    }
    // Prepare FormData
    const formData = new FormData();
    if (files.length === 1) {
      const singleFile = files[0]!
      const { data, name } = singleFile
      const fileType = getFileTypeFromBuffer(data)

      console.log("fileType made: ", fileType)
      const preppedFile  = new File([data as BlobPart], name, {type: "application/pdf"})
      console.log("PREPPED TYPE: ", preppedFile)
      console.log("PREPPED FILE: ", preppedFile.type)
      formData.append("file", preppedFile, name) ;
    } else {
      if (files.length < 1) {
        throw new Error("Expected an array of Buffers for 'bulk' method");
      }
      files.forEach((file, index) => {
        formData.append("files", new File(
          [file.data as BlobPart],
          file.name,
          {type: getFileTypeFromBuffer(file.data) ?? ""}
      ), `file-${index}`);
      });
    }
  const fetchLink = `${UPLOAD_URL}${files.length > 1 ? "bulk" : "single"}`
  
    try {
      // console.log("WHERE UPLOAD?!: ", fetchLink)
      // console.log("WHAT UPLOAD?!: ", formData)

      const response = await fetch(fetchLink, {
        method: "post",
        headers: {
          "X-API-Key": API_KEY,
        },
        body: formData,
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        // console.log("Upload error body:", errorText);
        throw new Error(`Upload failed: ${response.status} |/| ${response.statusText} ?>> ${errorText}`);
      }
  
      const { files } = (await response.json()) as UploadResponse;
      
      // Normalize response to FileItem[]
      const uploadedFiles: FileItem[] = (Array.isArray(files) ? files : [files]).map((file) => ({
        size: file.size,
        name: file.originalName ?? file.fileName,
        src: file.url,
        type: getFileType(file.mimetype),
      }));
  
      return uploadedFiles;
    } catch (error) {
      throw new Error(`Upload error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  function getFileType(mimeType: string): FileType {
    const mimeToFileType: Record<string, FileType> = {
      "application/pdf": "PDF",
      "image/png": "IMAGE_PNG",
      "image/jpeg": "IMAGE_JPEG",
      "image/jpg": "IMAGE_JPEG",
    };
  
    return mimeToFileType[mimeType] ?? "IMAGE_JPEG"; // Default to IMAGE_JPEG
  }
  
  
  function getFileTypeFromBuffer(buffer: Buffer): string | null {
    // Check the first 8 bytes for common file signatures
    const magicNumbers = buffer.subarray(0, 8).toString('hex').toLowerCase();
  
    // Common file signatures (hex) and their MIME types
    const signatures: Record<string, string> = {
      '89504e47': 'image/png', // PNG: ‰PNG
      '25504446': 'application/pdf', // PDF: %PDF
      'ffd8ff': 'image/jpeg', // JPEG: ÿØÿ
      '47494638': 'image/gif', // GIF: GIF8
      '52494646': 'image/webp', // WebP: RIFF (then check for WEBP later in the file)
      '504b0304': 'application/zip', // ZIP (also used for .docx, .xlsx, etc.)
      '1f8b': 'application/gzip', // GZIP
    };
  
    // Check for a match in the signatures
    for (const [signature, mimeType] of Object.entries(signatures)) {
      if (magicNumbers.startsWith(signature)) {
        // Special case for WebP: Confirm 'WEBP' in the RIFF container
        if (signature === '52494646' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
          continue;
        }
        return mimeType;
      }
    }
  
    return null; // Unknown file type
  }
  
  
  export function getBase64(file:string){
    
    const base64Content = file.includes(";base64,")
    ? file.split(";base64,")[1]
    : file;
    
    if (!base64Content) {
    throw new Error("Invalid Base64 string: no content found");
    } 
    
    return base64Content
  }