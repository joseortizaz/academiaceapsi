import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Award, Eye, ExternalLink, Search, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { CertificatePreviewDialog } from "@/components/CertificatePreviewDialog";
import { buildVerifyUrl } from "@/lib/certificate-pdf";
import type { CertificateTemplateData } from "@/components/CertificateTemplate";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/certificados")({
  component: AdminCertificados,
});

interface CertRow {
  id: string;
  numero_certificado: string;
  verification_code: string | null;
  fecha_emision: string;
  estado: string;
  user_id: string;
  programa_id: string;
  enrollment_id: string | null;
  student?: { nombre: string; apellido: string } | null;
  programa?: { titulo: string; tipo: string; duracion_horas: number | null } | null;
}

function AdminCertificados() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [previewData, setPreviewData] = useState<CertificateTemplateData | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["admin-certs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("*")
        .order("fecha_emision", { ascending: false })
        .limit(500);
      if (!data || !data.length) return [] as CertRow[];

      const userIds = [...new Set(data.map((c) => c.user_id))];
      const progIds = [...new Set(data.map((c) => c.programa_id))];

      const [{ data: profs }, { data: progs }] = await Promise.all([
        supabase.from("profiles").select("id, nombre, apellido").in("id", userIds),
        supabase.from("programs").select("id, titulo, tipo, duracion_horas").in("id", progIds),
      ]);

      return data.map((c) => ({
        ...c,
        student: profs?.find((p) => p.id === c.user_id) ?? null,
        programa: progs?.find((p) => p.id === c.programa_id) ?? null,
      })) as CertRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return certs;
    return certs.filter((c) => {
      const nombre = `${c.student?.nombre ?? ""} ${c.student?.apellido ?? ""}`.toLowerCase();
      return (
        nombre.includes(q) ||
        c.programa?.titulo?.toLowerCase().includes(q) ||
        c.numero_certificado.toLowerCase().includes(q) ||
        c.verification_code?.toLowerCase().includes(q)
      );
    });
  }, [certs, search]);

  const regenerate = useMutation({
    mutationFn: async (cert: CertRow) => {
      // Genera un nuevo verification_code (UUID corto) lado cliente.
      const newCode = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32])
        .join("");
      const { error } = await supabase
        .from("certificates")
        .update({ verification_code: newCode })
        .eq("id", cert.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Código de verificación regenerado");
      qc.invalidateQueries({ queryKey: ["admin-certs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al regenerar"),
  });

  const openPreview = (cert: CertRow) => {
    const code = cert.verification_code ?? cert.numero_certificado;
    setPreviewData({
      studentName:
        `${cert.student?.nombre ?? ""} ${cert.student?.apellido ?? ""}`.trim() || "Estudiante",
      programTitle: cert.programa?.titulo ?? "Programa Académico",
      programType: cert.programa?.tipo,
      durationHours: cert.programa?.duracion_horas,
      issueDate: cert.fecha_emision,
      verificationCode: code,
      certificateNumber: cert.numero_certificado,
      verifyUrl: buildVerifyUrl(code),
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Certificados</h1>
          <p className="text-sm text-muted-foreground">
            Todos los certificados emitidos. Búscalos por estudiante, programa o código.
          </p>
        </div>
        <Button onClick={() => setIssueOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Emitir certificado
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por estudiante, programa o código…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estudiante</TableHead>
              <TableHead>Programa</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  <Award className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Sin certificados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.student?.nombre} {c.student?.apellido}
                  </TableCell>
                  <TableCell>{c.programa?.titulo}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(c.fecha_emision).toLocaleDateString("es-DO")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.verification_code}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        c.estado === "emitido"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {c.estado}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openPreview(c)} title="Vista previa">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => regenerate.mutate(c)}
                        disabled={regenerate.isPending}
                        title="Regenerar código"
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                      <Button asChild size="sm" variant="ghost" title="Página pública">
                        <a
                          href={`/verify/${c.verification_code ?? c.numero_certificado}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CertificatePreviewDialog
        open={!!previewData}
        onOpenChange={(o) => !o && setPreviewData(null)}
        data={previewData}
      />

      <IssueCertificateDialog open={issueOpen} onOpenChange={setIssueOpen} onIssued={() => qc.invalidateQueries({ queryKey: ["admin-certs"] })} />
    </div>
  );
}

function IssueCertificateDialog({
  open,
  onOpenChange,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onIssued: () => void;
}) {
  const [enrollmentId, setEnrollmentId] = useState<string>("");

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-enrollments-completed"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, user_id, programa_id, progreso_porcentaje, estado")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!data) return [];
      const userIds = [...new Set(data.map((e) => e.user_id))];
      const progIds = [...new Set(data.map((e) => e.programa_id))];
      const [{ data: profs }, { data: progs }] = await Promise.all([
        supabase.from("profiles").select("id, nombre, apellido").in("id", userIds),
        supabase.from("programs").select("id, titulo, certificado_incluido").in("id", progIds),
      ]);
      return data
        .map((e) => ({
          ...e,
          student: profs?.find((p) => p.id === e.user_id),
          programa: progs?.find((p) => p.id === e.programa_id),
        }))
        .filter((e) => e.programa?.certificado_incluido);
    },
  });

  const issue = useMutation({
    mutationFn: async () => {
      const enr = enrollments.find((e) => e.id === enrollmentId);
      if (!enr) throw new Error("Selecciona una inscripción");

      // Verifica si ya tiene certificado para esta inscripción
      const { data: existing } = await supabase
        .from("certificates")
        .select("id")
        .eq("enrollment_id", enr.id)
        .maybeSingle();
      if (existing) throw new Error("Esta inscripción ya tiene certificado");

      const { error } = await supabase.from("certificates").insert({
        user_id: enr.user_id,
        programa_id: enr.programa_id,
        enrollment_id: enr.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificado emitido");
      onIssued();
      onOpenChange(false);
      setEnrollmentId("");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al emitir"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Emitir certificado manualmente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Selecciona la inscripción de un estudiante en un programa con certificado activado.
          </p>
          <Select value={enrollmentId} onValueChange={setEnrollmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona inscripción…" />
            </SelectTrigger>
            <SelectContent>
              {enrollments.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.student?.nombre} {e.student?.apellido} — {e.programa?.titulo} ({e.progreso_porcentaje}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => issue.mutate()} disabled={issue.isPending || !enrollmentId}>
            Emitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
