import { env } from "@/env";

export const runtime = "nodejs";

const GRAYSCALE_ENDPOINT =
  "https://api.ghost.miomideal.com/api/process/grayscale";

export async function POST(request: Request): Promise<Response> {
  if (!env.GHOST_GRAYSCALE_API_KEY) {
    return new Response("Missing GHOST_GRAYSCALE_API_KEY", { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return new Response("Missing PDF file", { status: 400 });
  }

  const upstreamForm = new FormData();
  const filename = file instanceof File && file.name ? file.name : "document.pdf";
  upstreamForm.append("file", file, filename);

  const response = await fetch(GRAYSCALE_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-Key": env.GHOST_GRAYSCALE_API_KEY,
    },
    body: upstreamForm,
  });

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
    return new Response(message, { status: 502 });
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
    },
  });
}
