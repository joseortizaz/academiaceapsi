import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

/**
 * Captura el nodo del certificado (CertificateTemplate) y genera un PDF A4 horizontal
 * de alta resolución. El nodo debe estar montado en el DOM (puede estar fuera de pantalla).
 */
export async function exportCertificateNodeToPDF(node: HTMLElement, fileName: string) {
  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, "JPEG", 0, 0, w, h, undefined, "FAST");
  pdf.save(fileName);
}

export function buildVerifyUrl(code: string) {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/verify/${code}`;
  }
  return `/verify/${code}`;
}
