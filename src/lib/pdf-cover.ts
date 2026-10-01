/**
 * Genera una imagen de portada a partir de la primera página de un PDF, en el navegador.
 * pdf.js se carga solo cuando se usa (panel de administración), nunca en el servidor.
 */

const ANCHO_PORTADA = 600;
/** Evita portadas desproporcionadas en PDF muy alargados. */
const ALTO_MAXIMO = Math.round(ANCHO_PORTADA * 1.6);

export async function renderPdfCover(source: Blob): Promise<Blob> {
  if (typeof window === "undefined") throw new Error("Solo disponible en el navegador");

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerUrl } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await source.arrayBuffer());
  const tarea = pdfjs.getDocument({ data });
  try {
    const doc = await tarea.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: ANCHO_PORTADA / base.width });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.min(Math.round(viewport.height), ALTO_MAXIMO);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no permite dibujar la portada");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("No se pudo crear la imagen de portada");
    return blob;
  } finally {
    await tarea.destroy();
  }
}
