export function canDownloadCertificate(estado: string) {
  return estado === "emitido";
}

export function certificateStatusLabel(estado: string) {
  if (estado === "pendiente_aprobacion") return "Pendiente de aprobación";
  if (estado === "emitido") return "Emitido";
  if (estado === "rechazado") return "Rechazado";
  if (estado === "revocado") return "Revocado";
  return estado;
}

export function certificateStatusClass(estado: string) {
  if (estado === "emitido") return "bg-success/10 text-success";
  if (estado === "pendiente_aprobacion") return "bg-accent/20 text-accent-foreground";
  return "bg-destructive/10 text-destructive";
}