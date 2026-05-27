import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateLessonFromWeb } from "@/lib/ai-generators.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Lesson = {
  titulo?: string;
  introduccion?: string;
  contenido_markdown?: string;
  puntos_clave?: string[];
  fuentes?: { n: number; titulo: string; url: string }[];
  _firecrawl_disponible?: boolean;
  _fuentes_encontradas?: number;
};

interface Props {
  onApply: (data: { titulo: string; contenido: string }) => void;
  triggerLabel?: string;
}

export function AiContentGenerator({ onApply, triggerLabel = "Generar con IA desde la web" }: Props) {
  const [open, setOpen] = useState(false);
  const [tema, setTema] = useState("");
  const [objetivos, setObjetivos] = useState("");
  const [nivel, setNivel] = useState("intermedio");
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editContenido, setEditContenido] = useState("");

  const runGenerate = useServerFn(generateLessonFromWeb);

  const handleGenerate = async () => {
    if (!tema.trim()) { toast.error("Indica un tema"); return; }
    setLoading(true);
    try {
      const res = await runGenerate({ data: { tema, objetivos, nivel } });
      setLesson(res);
      setEditTitulo(res.titulo ?? tema);
      const fuentesMd = res.fuentes?.length
        ? "\n\n---\n\n**Fuentes:**\n" + res.fuentes.map((f) => `${f.n}. [${f.titulo}](${f.url})`).join("\n")
        : "";
      const puntosMd = res.puntos_clave?.length
        ? "\n\n**Puntos clave:**\n" + res.puntos_clave.map((p) => `- ${p}`).join("\n")
        : "";
      setEditContenido((res.introduccion ?? "") + "\n\n" + (res.contenido_markdown ?? "") + puntosMd + fuentesMd);
      if (!res._firecrawl_disponible) {
        toast.warning("Firecrawl no está conectado. Se generó solo con conocimiento general (sin fuentes web).");
      } else {
        toast.success(`Contenido generado con ${res._fuentes_encontradas} fuente(s) web.`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error generando contenido");
    } finally { setLoading(false); }
  };

  const handleApply = () => {
    onApply({ titulo: editTitulo, contenido: editContenido });
    setOpen(false);
    setLesson(null);
    setTema("");
    setObjetivos("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Sparkles className="mr-2 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Generar contenido con IA</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tema / título de la lección</Label>
            <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej: Fundamentos de la terapia cognitivo-conductual" />
          </div>
          <div>
            <Label>Objetivos de aprendizaje (opcional)</Label>
            <Textarea value={objetivos} onChange={(e) => setObjetivos(e.target.value)} rows={2} placeholder="Ej: Comprender principios básicos, identificar técnicas..." />
          </div>
          <div>
            <Label>Nivel</Label>
            <Input value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="introductorio, intermedio, avanzado" />
          </div>

          <Button type="button" onClick={handleGenerate} disabled={loading || !tema.trim()} className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando en la web y generando…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generar</>}
          </Button>

          {lesson && lesson._firecrawl_disponible === false && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <strong>Firecrawl no está conectado.</strong> Para que la IA busque información actualizada en la web con citas, conecta Firecrawl desde <em>Connectors</em>. Mientras tanto, se usó solo conocimiento general del modelo.
              </div>
            </div>
          )}

          {lesson && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-4">
              <h4 className="text-sm font-semibold">Revisa y edita antes de guardar</h4>
              <div>
                <Label>Título</Label>
                <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} />
              </div>
              <div>
                <Label>Contenido (Markdown)</Label>
                <Textarea value={editContenido} onChange={(e) => setEditContenido(e.target.value)} rows={16} className="font-mono text-xs" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          {lesson && <Button onClick={handleApply}>Usar este contenido</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
