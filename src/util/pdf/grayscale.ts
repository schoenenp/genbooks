const GRAYSCALE_ENDPOINT = "https://api.ghost.miomideal.com/api/process/grayscale";
const LOCAL_PROXY_ENDPOINT = "/api/process/grayscale";

type GrayscaleOptions = {
  apiKey?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export async function convertPdfToGrayscale(
  pdfBytes: Uint8Array,
  options: GrayscaleOptions = {},
): Promise<Uint8Array> {
  const formData = new FormData();
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  formData.append("file", pdfBlob, "document.pdf");

  let response: Response;

  if (isBrowser()) {
    response = await fetch(LOCAL_PROXY_ENDPOINT, {
      method: "POST",
      body: formData,
    });
  } else {
    if (!options.apiKey) {
      throw new Error("Missing GHOST_GRAYSCALE_API_KEY for server-side grayscale conversion");
    }

    response = await fetch(GRAYSCALE_ENDPOINT, {
      method: "POST",
      headers: {
        "X-API-Key": options.apiKey,
      },
      body: formData,
    });
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }
    const message = detail.trim()
      ? `Grayscale conversion failed: ${detail}`
      : "Grayscale conversion failed";
    throw new Error(message);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
