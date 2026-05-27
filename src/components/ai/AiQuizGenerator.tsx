import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateQuizFromPdf } from "@/lib/ai-generators.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FileUploader } from "@/components/FileUploader";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Generated = {
  enunciado: string;
  tipo: "opcion_multiple" | "verdadero_falso";
  opciones: string[] | null;
  respuesta_correcta: string;
  puntaje: number;
};

interface Props {
  assessmentId: string;
  startingOrder: number;
  onImported: () => void;
}

export function AiQuizGenerator({ assessmentId, startingOrder, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [cantidad, setCantidad] = useState(5);
  const [tipo, setTipo] = useState<"mixto" | "opcion_multiple" | "verdadero_falso">("mixto");
  const [loading, setLoading] = useState(false);
  const [preguntas, setPreguntas] = useState<Generated[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const runGenerate = useServerFn(generateQuizFromPdf);

  const handleGenerate = async () => {
    if (!pdfUrl) { toast.error("Sube un PDF primero"); return; }
    setLoading(true);
    try {
      const res = await runGenerate({ data: { pdfUrl, cantidad, tipo } });
      setPreguntas(res.preguntas);
      setSelected(new Set(res.preguntas.map((_: Generated, i: number) => i)));
      toast.success(`${res.preguntas.length} preguntas generadas. Revísalas y selecciona las que quieras importar.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error generando preguntas");
    } finally { setLoading(false); }
  };

  const updatePregunta = (i: number, patch: Partial<Generated>) => {
    setPreguntas((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const handleImport = async () => {
    const toImport = preguntas.filter((_, i) => selected.has(i));
    if (toImport.length === 0) { toast.error("Selecciona al menos una pregunta"); return; }
    const rows = toImport.map((p, i) => ({
      assessment_id: assessmentId,
      enunciado: p.enunciado,
      tipo: p.tipo,
      opciones: p.tipo === "opcion_multiple" ? p.opciones : null,
      respuesta_correcta: p.respuesta_correcta,
      puntaje: p.puntaje || 1,
      orden: startingOrder + i,
    }));
    const { error } = await supabase.from("assessment_questions").insert(rows as never);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} preguntas agregadas`);
    setOpen(false);
    setPreguntas([]);
    setPdfUrl("");
    onImported();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Sparkles className="mr-2 h-4 w-4" /> Generar con IA desde PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Generar preguntas con IA</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Material de apoyo (PDF)</Label>
            <FileUploader value={pdfUrl} onChange={(u) => setPdfUrl(u ?? "")} accept="application/pdf" />
            {preguntas.length > 0 && <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(preguntas.map((_p: Generated, i: number) => i)))}>Re-seleccionar todas</Button>}
            <p className="mt-1 text-xs text-muted-foreground">Sube un PDF con el contenido base para la evaluación.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cantidad de preguntas</Label>
              <Input type="number" min={1} max={20} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixto">Mixto</SelectItem>
                  <SelectItem value="opcion_multiple">Opción múltiple</SelectItem>
                  <SelectItem value="verdadero_falso">Verdadero / Falso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="button" onClick={handleGenerate} disabled={loading || !pdfUrl} className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generar preguntas</>}
          </Button>

          {preguntas.length > 0 && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Previsualización ({selected.size}/{preguntas.length} seleccionadas)</h4>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(preguntas.map((_, i) => i)))}>Todas</Button>
              </div>
              {preguntas.map((p, i) => (
                <div key={i} className={`rounded border p-3 ${selected.has(i) ? "border-primary bg-background" : "border-border bg-muted/50 opacity-60"}`}>
                  <div className="flex items-start gap-2">
                    <Button size="sm" variant={selected.has(i) ? "default" : "outline"} className="h-7 w-7 p-0"
                      onClick={() => {
                        const ns = new Set(selected);
                        if (ns.has(i)) ns.delete(i); else ns.add(i);
                        setSelected(ns);
                      }}>
                      {selected.has(i) ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </Button>
                    <div className="flex-1 space-y-2">
                      <Input value={p.enunciado} onChange={(e) => updatePregunta(i, { enunciado: e.target.value })} className="font-medium" />
                      {p.tipo === "opcion_multiple" && p.opciones && (
                        <div className="space-y-1">
                          {p.opciones.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input type="radio" checked={p.respuesta_correcta === opt}
                                onChange={() => updatePregunta(i, { respuesta_correcta: opt })} />
                              <Input value={opt} onChange={(e) => {
                                const next = [...(p.opciones ?? [])];
                                const prev = next[oi];
                                next[oi] = e.target.value;
                                updatePregunta(i, {
                                  opciones: next,
                                  respuesta_correcta: p.respuesta_correcta === prev ? e.target.value : p.respuesta_correcta,
                                });
                              }} />
                            </div>
                          ))}
                        </div>
                      )}
                      {p.tipo === "verdadero_falso" && (
                        <Select value={p.respuesta_correcta} onValueChange={(v) => updatePregunta(i, { respuesta_correcta: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="verdadero">Verdadero</SelectItem>
                            <SelectItem value="falso">Falso</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          {preguntas.length > 0 && (
            <Button onClick={handleImport}>Importar {selected.size} pregunta(s)</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
