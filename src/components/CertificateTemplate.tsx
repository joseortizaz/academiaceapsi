import { forwardRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import templateAsset from "@/assets/certificate-template.png.asset.json";

export interface CertificateTemplateData {
  studentName: string;
  programTitle: string;
  programType?: "curso" | "diplomado" | string | null;
  durationHours?: number | null;
  issueDate: string | Date;
  verificationCode: string;
  certificateNumber: string;
  verifyUrl: string;
}

/**
 * Renderiza un certificado overlay sobre la plantilla institucional Ceapsi.
 * Dimensiones fijas (1400x990) — equivalen a la proporción A4 horizontal de la plantilla
 * y se usan tanto para previsualización como para captura en PDF con html2canvas.
 */
export const CertificateTemplate = forwardRef<HTMLDivElement, CertificateTemplateData>(
  function CertificateTemplate(
    {
      studentName,
      programTitle,
      programType,
      durationHours,
      issueDate,
      verificationCode,
      certificateNumber,
      verifyUrl,
    },
    ref,
  ) {
    const fecha = new Date(issueDate).toLocaleDateString("es-DO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const tipoLabel = programType === "diplomado" ? "el diplomado" : "el curso";
    const duracionText = durationHours ? `con una duración de ${durationHours} horas académicas` : "";

    return (
      <div
        ref={ref}
        style={{
          width: 1400,
          height: 990,
          position: "relative",
          backgroundImage: `url(${templateAsset.url})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          fontFamily: "'Georgia', 'Times New Roman', serif",
          color: "#1a2542",
        }}
      >
        {/* Nombre del estudiante */}
        <div
          style={{
            position: "absolute",
            top: 410,
            left: 470,
            right: 80,
            textAlign: "center",
            fontFamily: "'Great Vibes', 'Brush Script MT', cursive",
            fontSize: 70,
            color: "#0f3460",
            lineHeight: 1,
            fontWeight: 400,
          }}
        >
          {studentName}
        </div>

        {/* Línea decorativa bajo el nombre */}
        <div
          style={{
            position: "absolute",
            top: 500,
            left: 550,
            right: 170,
            height: 1,
            background: "linear-gradient(to right, transparent, #c9a84c, transparent)",
          }}
        />

        {/* Descripción de aprobación */}
        <div
          style={{
            position: "absolute",
            top: 525,
            left: 470,
            right: 80,
            textAlign: "center",
            fontSize: 18,
            color: "#3a4566",
            fontFamily: "'Helvetica', 'Arial', sans-serif",
            lineHeight: 1.5,
          }}
        >
          Por haber aprobado satisfactoriamente {tipoLabel}
        </div>

        {/* Nombre del programa */}
        <div
          style={{
            position: "absolute",
            top: 565,
            left: 470,
            right: 80,
            textAlign: "center",
            fontSize: 28,
            fontWeight: 700,
            color: "#0f3460",
            fontFamily: "'Helvetica', 'Arial', sans-serif",
            lineHeight: 1.2,
            padding: "0 20px",
          }}
        >
          «{programTitle}»
        </div>

        {/* Duración + fecha */}
        <div
          style={{
            position: "absolute",
            top: 645,
            left: 470,
            right: 80,
            textAlign: "center",
            fontSize: 15,
            color: "#5a6580",
            fontFamily: "'Helvetica', 'Arial', sans-serif",
          }}
        >
          {duracionText && <span>{duracionText}. </span>}
          <span>Emitido el {fecha}.</span>
        </div>

        {/* QR + código de verificación (esquina inferior derecha) */}
        <div
          style={{
            position: "absolute",
            bottom: 38,
            right: 50,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: 8,
            background: "rgba(255,255,255,0.92)",
            borderRadius: 8,
            border: "1px solid #d4d8e3",
          }}
        >
          <QRCodeCanvas
            value={verifyUrl}
            size={88}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#0f3460"
          />
          <div style={{ fontSize: 9, color: "#5a6580", fontFamily: "monospace" }}>
            {verificationCode}
          </div>
          <div style={{ fontSize: 8, color: "#8892ad", fontFamily: "monospace" }}>
            Verificar autenticidad
          </div>
        </div>

        {/* Número de certificado (esquina inferior izquierda) */}
        <div
          style={{
            position: "absolute",
            bottom: 22,
            left: 230,
            fontSize: 10,
            color: "#8892ad",
            fontFamily: "monospace",
            letterSpacing: 1,
          }}
        >
          Nº {certificateNumber}
        </div>
      </div>
    );
  },
);
