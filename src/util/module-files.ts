type ModuleFileLike = {
  name?: string | null;
  type?: string | null;
};

const LEGACY_PDF_NAME_PREFIXES = ["file_", "DATEI-", "file-"];

export function isModulePdfFile(file: ModuleFileLike): boolean {
  if (file.type === "PDF") {
    return true;
  }

  const fileName = file.name ?? "";
  return LEGACY_PDF_NAME_PREFIXES.some((prefix) =>
    fileName.startsWith(prefix),
  );
}
