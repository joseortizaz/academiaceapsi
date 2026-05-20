import { jsPDF } from "jspdf";

export interface CertificateData {
  numero: string;
  nombreCompleto: string;
  tituloPrograma: string;
  duracionHoras?: number | null;
  fechaEmision: string | Date;
  docente?: string | null;
  verificacionUrl?: string;
}

/**
 * Genera un certificado en PDF horizontal (A4 landscape) y dispara la descarga.
 * Diseño profesional acorde a Academia Ceapsi RD.
 */
export function generarCertificadoPDF(data: CertificateData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Fondo crema sutil
  doc.setFillColor(252, 250, 245);
  doc.rect(0, 0, W, H, "F");

  // Bordes decorativos (azul institucional + dorado)
  doc.setDrawColor(15, 52, 96); // azul oscuro
  doc.setLineWidth(2);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setDrawColor(201, 168, 76); // dorado
  doc.setLineWidth(0.6);
  doc.rect(11, 11, W - 22, H - 22);

  // Encabezado
  doc.setTextColor(15, 52, 96);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ACADEMIA CEAPSI RD", W / 2, 28, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text("República Dominicana", W / 2, 34, { align: "center" });

  // Título
  doc.setTextColor(15, 52, 96);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.text("CERTIFICADO", W / 2, 60, { align: "center" });

  doc.setFontSize(14);
  doc.setTextColor(201, 168, 76);
  doc.text("DE FINALIZACIÓN", W / 2, 70, { align: "center" });

  // "Otorgado a"
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text("Se otorga el presente certificado a", W / 2, 88, { align: "center" });

  // Nombre del estudiante
  doc.setFont("times", "bolditalic");
  doc.setFontSize(34);
  doc.setTextColor(20, 20, 20);
  doc.text(data.nombreCompleto, W / 2, 105, { align: "center" });

  // Línea bajo el nombre
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - 70, 110, W / 2 + 70, 110);

  // Descripción
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text("por haber completado satisfactoriamente el programa", W / 2, 122, { align: "center" });

  // Nombre del programa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 52, 96);
  const tituloLines = doc.splitTextToSize(`«${data.tituloPrograma}»`, W - 80);
  doc.text(tituloLines, W / 2, 134, { align: "center" });

  // Duración + fecha
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const fecha = new Date(data.fechaEmision).toLocaleDateString("es-DO", {
    year: "numeric", month: "long", day: "numeric",
  });
  const detalles: string[] = [];
  if (data.duracionHoras) detalles.push(`con una duración de ${data.duracionHoras} horas académicas`);
  detalles.push(`emitido el ${fecha}`);
  doc.text(detalles.join(", "), W / 2, 152, { align: "center" });

  // Firmas
  const firmaY = H - 40;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(40, firmaY, 110, firmaY);
  doc.line(W - 110, firmaY, W - 40, firmaY);

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.text("Dirección Académica", 75, firmaY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Academia Ceapsi RD", 75, firmaY + 10, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.text(data.docente ?? "Docente del programa", W - 75, firmaY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Docente", W - 75, firmaY + 10, { align: "center" });

  // Pie: número de certificado + verificación
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Código de verificación: ${data.numero}`, W / 2, H - 18, { align: "center" });
  if (data.verificacionUrl) {
    doc.text(`Verifica en: ${data.verificacionUrl}`, W / 2, H - 13, { align: "center" });
  }

  doc.save(`Certificado-${data.numero}.pdf`);
}
