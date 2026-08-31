import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { CertificateTemplate, type CertificateTemplateData } from "./CertificateTemplate";
import { exportCertificateNodeToPDF } from "@/lib/certificate-pdf";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CertificateTemplateData | null;
}

export function CertificatePreviewDialog({ open, onOpenChange, data }: Props) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!nodeRef.current || !data) return;
    setDownloading(true);
    try {
      await exportCertificateNodeToPDF(
        nodeRef.current,
        `Certificado-${data.certificateNumber}.pdf`,
      );
    } catch (e) {
      console.error("Error exportando certificado a PDF:", e);
      toast.error("No se pudo generar el certificado. Intenta de nuevo.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Vista previa del certificado</DialogTitle>
        </DialogHeader>

        {data && (
          <>
            {/* Contenedor escalado para preview */}
            <div className="overflow-auto rounded-lg border bg-muted/30 p-4">
              <div
                style={{
                  width: 1400,
                  height: 990,
                  transform: "scale(0.55)",
                  transformOrigin: "top left",
                  marginBottom: -445,
                  marginRight: -630,
                }}
              >
                <CertificateTemplate ref={nodeRef} {...data} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              <Button onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Descargar PDF
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
