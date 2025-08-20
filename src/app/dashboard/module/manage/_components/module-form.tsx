"use client";
import type { FormEvent } from "react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FileType } from "@prisma/client";
import { CheckCircleIcon, ClipboardCopyIcon } from "lucide-react";

import FileUpload from "@/app/config/_components/file-upload";
import { api } from "@/trpc/react";


import { getPageRules } from "@/util/book/functions";
import { urlToFile, fileToBase64, extractTextFields  } from "@/util/pdf/functions";

type FileState = {
  data?: File;
  hasChanged: boolean;
  src?: string;
  modifiedPdf?: Uint8Array; 
}


// Fixed type definitions
export type TagItem = { 
    id: number;
    name: string; 
    output: string | null; 
  };
  
  type TagProps = TagItem & {
    onClick?: (tag: TagItem) => void; // Pass full tag object instead of just name
    variant?: 'selected' | 'available'; // Visual distinction
  };

type ModuleData = {
  id: string;
  type: { name: string };
  theme: string | null;
  name: string | null;
  files: {
    id: string;
    name: string | null;
    type: FileType;
    size: number;
    src: string;
  }[];
};

type PageData = {
    modules: Promise<ModuleData[]>;
    types: Promise<{ id: string; name: string; minPages: number; maxPages: number }[]>;
    tags: Promise<{ id: number; name: string; output: string | null }[]>
  };

// Improved Tag component
function Tag({ id, name, output, onClick, variant = 'available' }: TagProps) {
    const handleItemClick = () => {
      onClick?.({ id, name, output });
    };
  
    const baseClasses = "cursor-pointer flex flex-wrap gap-2 items-center overflow-clip p-2 rounded transition-colors";
    const variantClasses = variant === 'selected' 
      ? "bg-pirrot-blue-100 text-pirrot-blue-700 hover:bg-pirrot-red-100 hover:text-pirrot-red-600" 
      : "bg-pirrot-blue-50 text-pirrot-blue-500 hover:bg-pirrot-blue-100";
  
    return (
      <div
        className={`${baseClasses} ${variantClasses}`}
        onClick={handleItemClick}
      >
        {name}
        <span className="font-mono text-xs opacity-70">
          {output ? `//${output}` : '//no output'}
        </span>
      </div>
    );
  }
  async function processPdfFile(
    file: File,
    availableTags: TagItem[],
  ) {
    console.log("PROCESS AVAILABLE TAGS", availableTags)
    if (file.type !== "application/pdf") {
      return { file, fields: [], modifiedPdf: undefined };
    }
    try {
      const { fields, modifiedPdf } = await extractTextFields(
          file,
          availableTags
        );

      return { file, fields, modifiedPdf };
    } catch (error) {
      console.error("Error processing PDF file:", error);
      return { file, fields: [], modifiedPdf: undefined };
    }
  }
  
// --- CUSTOM HOOKS ---

/**
 * Hook to manage form state and initialization from existing module data.
 */
function useModuleFormState(moduleId?: string, pageData?: PageData) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [theme, setTheme] = useState("");
  const [file, setFile] = useState<FileState>({ hasChanged: false });
  const [thumbnail, setThumbnail] = useState<FileState>({ hasChanged: false });
  const [allowedTags, setAllowedTags] = useState<TagItem[]>([]);

  useEffect(() => {
    if (!moduleId || !pageData) return;
  
    const initialize = async () => {
      const [modules, tags] = await Promise.all([
        pageData.modules,
        pageData.tags,
      ]);
      const moduleItem = modules.find((m) => m.id === moduleId);
      if (!moduleItem) return;
  
      setName(moduleItem.name ?? "module");
      setType(moduleItem.type.name);
      setTheme(moduleItem.theme ?? "");
  
      // Initialize Thumbnail
      const thumbData = moduleItem
        .files
        .find((f) => f.name?.startsWith("thumb_"))
  
      if (thumbData) {
        const thumbFile = await urlToFile(thumbData.src, thumbData.name ?? "");
        setThumbnail({ data: thumbFile ?? undefined, src: thumbData.src, hasChanged: false });
      }
  
      // Initialize Main File and process if it's a PDF
      const fileData = moduleItem.files.find((f) => f.name?.startsWith("file_"));
      if (fileData) {
        const originalFile = await urlToFile(fileData.src, fileData.name ?? "");
        if (originalFile) {
          const { file: processedFile, fields, modifiedPdf } = await processPdfFile(
            originalFile,
            tags,
          );
  
          const extractedTags = fields
            .map(f => tags?.find(tg => tg.name === f.name))
            .filter((tag): tag is TagItem => tag !== undefined);
          setAllowedTags(extractedTags);
  
          setFile({
            data: processedFile,
            src: fileData.src,
            hasChanged: false,
            modifiedPdf: modifiedPdf // Store the modified PDF
          });
        }
      }
    };
  
    void initialize();
  }, [moduleId, pageData]);

  return {
    name,
    setName,
    type,
    setType,
    theme,
    setTheme,
    file,
    setFile,
    thumbnail,
    setThumbnail,
    allowedTags,
    setAllowedTags,
  };
}

export default function ModuleForm({ moduleId }: { moduleId?: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const [ pageData ] = api.module.initPage.useSuspenseQuery();

  const {
    name,
    setName,
    type,
    setType,
    file,
    setFile,
    allowedTags,
    setAllowedTags,
} = useModuleFormState(
    moduleId, 
    pageData
);

  const [typesPickable, setTypesPickable] = useState<{ 
    id: string; 
    name: string; 
    minPages: number; 
    maxPages: number 
}[]>([]);

  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);

  
useEffect(() => {
  
  async function setData(){
      const promisedTypes = await pageData.types
      setTypesPickable(promisedTypes)
  }
  
  void setData()
}, [pageData?.types]);

  const mutationOptions = {
    onSuccess: async () => {
      await utils.module.invalidate();
      router.push("/dashboard?view=module");
    },
  };

  const createModule = api.module.create.useMutation(mutationOptions);
  const updateModule = api.module.update.useMutation(mutationOptions);

// Helper function to safely extract and filter tags
function extractTagsFromFields(
    fieldNames: TagItem[], 
    availableTags: TagItem[]
): TagItem[] {
    console.log("fieldnames", fieldNames)
    console.log("available:", availableTags)
    const foundTags = fieldNames
      .map(fieldName => availableTags.find(tag => tag.name === fieldName.name))
      .filter((tag): tag is TagItem => tag !== undefined);
    
    const uniqueTags = foundTags.filter((tag, index, array) => 
      array.findIndex(t => t.id === tag.id) === index
    );
    
    return uniqueTags;
  }


  const handleTagToggle = useCallback(async (tag: TagItem, isRemoving: boolean) => {
    if (!file.data) return;
  
    let newAllowedTags: TagItem[];
    if (isRemoving) {
      newAllowedTags = allowedTags.filter(t => t.id !== tag.id);
    } else {
      newAllowedTags = [...allowedTags, tag];
    }
  
    // Re-process the PDF with the new tag selection
    const { modifiedPdf } = await processPdfFile(file.data, newAllowedTags);
    
    setAllowedTags(newAllowedTags);
    setFile(prev => ({ ...prev, modifiedPdf }));
  }, [file.data, allowedTags, setAllowedTags, setFile]);
  
  // Updated handlePickedFile function
  const handlePickedFile = useCallback(
    async (pickedFile: File) => {
      const tags = await pageData?.tags;
      if (!tags) return;
      
      const { file: processedFile, fields, modifiedPdf } = await processPdfFile(
        pickedFile,
        tags,
      );
      
      // Store both the original file and the modified PDF
      setFile({ 
        data: processedFile, 
        hasChanged: true,
        modifiedPdf: modifiedPdf 
      });
      
      const extractedTags = extractTagsFromFields(fields, tags);
      setAllowedTags(extractedTags);
    },
    [pageData, setFile, setAllowedTags],
  );
  

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const [base64file] = await Promise.all([
      file.data && file.hasChanged ? fileToBase64(file.data) : "",
    ]);

    if (moduleId) {
      await updateModule.mutateAsync({
        id: moduleId,
        name,
        type,
        file: base64file,
      });
    } else {
      await createModule.mutateAsync({
        name,
        type,
        moduleFile: base64file
      });
    }
  };

  const pdfFileUrl = useMemo(() => {
    if (file.modifiedPdf) {
      // Create a blob URL from the modified PDF
      const blob = new Blob([file.modifiedPdf], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    }
    return file.data instanceof File ? URL.createObjectURL(file.data) : file.src;
  }, [file.data, file.src, file.modifiedPdf]);
  
  useEffect(() => {
    return () => {
      if (pdfFileUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(pdfFileUrl);
      }
    };
  }, [pdfFileUrl]);
  

  const handleResetFile = () => {
    setAllowedTags([]);
    setFile({ data: undefined, hasChanged: false });
  };


  return (
    <div className="flex h-full w-full flex-col gap-4 xl:flex-row">
      <div className="flex-1 rounded bg-pirrot-blue-50 p-4">
        <h3 className="text-4xl uppercase text-pirrot-blue-800">manage</h3>
        <div className="w-full text-pirrot-blue-800">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Form Inputs */}
            <div className="w-full flex flex-col gap-1">
              <label>Name</label>
              <input
                className="rounded-sm bg-pirrot-blue-100 p-2 text-opacity-80"
                onChange={(e) => setName(e.target.value)}
                value={name}
              />
            </div>
            <div className="flex w-full flex-col gap-2 lg:flex-row">
              <div className="flex w-full flex-col gap-1">
                <label className="text-pirrot-blue-800">Typ</label>
                <input
                  id="types"
                  autoComplete="off"
                  className="rounded-sm bg-pirrot-blue-100 p-2 text-opacity-80 text-info-950"
                  onBlur={() => setTimeout(() => setIsTypePickerOpen(false), 200)}
                  onFocus={() => setIsTypePickerOpen(true)}
                  onChange={(e) => setType(e.target.value)}
                  value={type}
                />
                <div className="relative w-full">
                  {isTypePickerOpen && (
                    <div className="absolute top-0 z-40 flex w-full max-h-44 flex-col gap-1 overflow-y-auto bg-pirrot-blue-50">
                      {typesPickable
                        .filter((t) =>
                          t.name.toLowerCase().includes(type.toLowerCase()),
                        )
                        .map((t) => (
                          <button
                            id={t.name}
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setType(t.name);
                              setIsTypePickerOpen(false);
                            }}
                            className="flex w-full justify-between bg-pirrot-blue-950/30 p-2 text-info-950"
                          >
                            {t.name}
                            <span className="flex items-center justify-center gap-2">
                              <ClipboardCopyIcon className="size-4" />
                              {getPageRules({ min: t.minPages, max: t.maxPages })}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* File Uploads & Tag Displays */}
            <div className="grid h-full w-full grid-cols-1 gap-2 md:grid-cols-2">
              <div className="aspect-video rounded bg-pirrot-blue-500/10 p-0.5">
                {file.data ? (
                  <div
                    className="group relative flex size-full cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-solid border-pirrot-blue-800 bg-pirrot-blue-500/20 text-pirrot-blue-800 transition duration-500 hover:border-pirrot-blue-50/20"
                    onClick={handleResetFile}
                  >
                    <span className="absolute top-2 right-2 hidden text-pirrot-red-400 transition duration-500 group-hover:block">
                      undo
                    </span>
                    <CheckCircleIcon className="size-8" />
                    <span>{file.data.name}</span>
                  </div>
                ) : (
                  <FileUpload
                    fieldName="Moduldatei"
                    accept={["application/pdf", "image/png", "image/jpeg"]}
                    onPickedFile={handlePickedFile}
                    resetFile={handleResetFile}
                  />
                )}
              </div>
              <div className="flex aspect-video flex-col rounded bg-pirrot-blue-500/10 p-0.5">
                <div className="flex h-full flex-col justify-between p-1">
                  <h2 className="text-sm font-medium uppercase">Erkannte Tags</h2>
                  <div className="flex max-h-44 w-full flex-col gap-1 overflow-y-auto bg-pirrot-blue-400/20 p-1">
                  {allowedTags.map((tag) => (
  <Tag
    key={tag.id}
    {...tag}
    variant="selected"
    onClick={(removedTag) => handleTagToggle(removedTag, true)}
  />
))}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex w-full gap-2">
              <Link
                href="/dashboard?view=module"
                className="flex w-full items-center justify-center border-2 border-pirrot-blue-800 p-4 text-center text-pirrot-blue-800"
              >
                Abbruch
              </Link>
              <button type="submit" className="w-full bg-pirrot-blue-100 p-4">
                {moduleId ? "Updaten" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="flex h-screen flex-1 flex-col items-center justify-center text-pirrot-blue-50">
        {pdfFileUrl && <iframe src={pdfFileUrl + "#view=fit"} className="size-full" />}
      </div>
    </div>
  );
}