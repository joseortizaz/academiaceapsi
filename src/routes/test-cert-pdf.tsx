// RUTA TEMPORAL de verificación — eliminar tras la prueba.
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CertificateTemplate } from "@/components/CertificateTemplate";
import { exportCertificateNodeToPDF } from "@/lib/certificate-pdf";

export const Route = createFileRoute("/test-cert-pdf")({
  component: TestCertPdf,
});

function TestCertPdf() {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("idle");

  const handleDownload = async () => {
    if (!nodeRef.current) return;
    setStatus("working");
    try {
      await exportCertificateNodeToPDF(nodeRef.current, "Certificado-CEAPSI-2026-10a5a852.pdf");
      setStatus("ok");
    } catch (e) {
      console.error(e);
      setStatus("error: " + String(e));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <button id="dl" onClick={handleDownload}>
        Descargar
      </button>
      <div id="status" data-testid="status">
        {status}
      </div>
      <CertificateTemplate
        ref={nodeRef}
        studentName="Estudiante de Prueba Genograma"
        programTitle="Genograma Familiar"
        programType="curso"
        durationHours={20}
        issueDate={new Date().toISOString()}
        verificationCode="TESTCODE123"
        certificateNumber="CEAPSI-2026-10a5a852"
        verifyUrl="http://localhost:8080/verify/TESTCODE123"
      />
    </div>
  );
}
