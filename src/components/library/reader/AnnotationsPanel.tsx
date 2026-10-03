import { useEffect, useRef, useState } from "react";
import { Lock, Plus, StickyNote, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  COLORES,
  COLOR_KEYS,
  NOTA_MAX,
  sortAnnotations,
  type Annotation,
  type ColorKey,
} from "@/lib/library-reader";

type Props = {
  annotations: Annotation[];
  paginaActual: number;
  activaId: string | null;
  /** Cuando cambia, enfoca el campo de nota de esa anotación (recién creada con "Nota"). */
  editarId: string | null;
  onGoTo: (a: Annotation) => void;
  onUpdate: (id: string, patch: { color?: ColorKey; nota?: string | null }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onCreatePageNote: (nota: string) => Promise<boolean>;
  onClose: () => void;
};

export function AnnotationsPanel({
  annotations,
  paginaActual,
  activaId,
  editarId,
  onGoTo,
  onUpdate,
  onDelete,
  onCreatePageNote,
  onClose,
}: Props) {
  const [nuevaNota, setNuevaNota] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const lista = sortAnnotations(annotations);

  useEffect(() => {
    if (!activaId && !editarId) return;
    const el = document.getElementById(`anotacion-${editarId ?? activaId}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activaId, editarId]);

  const guardarNotaPagina = async () => {
    const texto = (nuevaNota ?? "").trim();
    if (!texto) return setNuevaNota(null);
    setGuardando(true);
    const ok = await onCreatePageNote(texto);
    setGuardando(false);
    if (ok) setNuevaNota(null);
  };

  return (
    <aside className="flex h-full w-full flex-col border-l bg-card sm:w-80">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Mis notas</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Solo tú puedes verlas
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar notas">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b p-3">
        {nuevaNota === null ? (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setNuevaNota("")}>
            <Plus className="mr-2 h-4 w-4" />
            Nota en la página {paginaActual}
          </Button>
        ) : (
          <div className="space-y-2">
            <Textarea
              autoFocus
              rows={3}
              maxLength={NOTA_MAX}
              value={nuevaNota}
              onChange={(e) => setNuevaNota(e.target.value)}
              placeholder={`Escribe tu nota sobre la página ${paginaActual}…`}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setNuevaNota(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={guardarNotaPagina}
                disabled={guardando || !nuevaNota.trim()}
              >
                Guardar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {lista.length === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-muted-foreground">
            <StickyNote className="mx-auto mb-2 h-6 w-6 opacity-50" />
            Selecciona un texto del documento para resaltarlo o agregar una nota.
          </div>
        ) : (
          lista.map((a) => (
            <AnnotationCard
              key={a.id}
              a={a}
              activa={a.id === activaId}
              enfocar={a.id === editarId}
              onGoTo={onGoTo}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function AnnotationCard({
  a,
  activa,
  enfocar,
  onGoTo,
  onUpdate,
  onDelete,
}: {
  a: Annotation;
  activa: boolean;
  enfocar: boolean;
  onGoTo: (a: Annotation) => void;
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
}) {
  const [nota, setNota] = useState(a.nota ?? "");
  const [confirmar, setConfirmar] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const esNotaDePagina = a.rects.length === 0;

  useEffect(() => setNota(a.nota ?? ""), [a.nota]);
  useEffect(() => {
    if (enfocar) ref.current?.focus();
  }, [enfocar]);

  const guardar = async () => {
    const limpia = nota.trim();
    if (limpia === (a.nota ?? "").trim()) return;
    if (esNotaDePagina && !limpia) {
      // Una nota de página sin texto no tiene sentido: se restaura.
      setNota(a.nota ?? "");
      return;
    }
    const ok = await onUpdate(a.id, { nota: limpia || null });
    if (!ok) setNota(a.nota ?? "");
  };

  return (
    <article
      id={`anotacion-${a.id}`}
      className={cn(
        "rounded-lg border bg-background p-3 text-sm transition",
        activa && "ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        onClick={() => onGoTo(a)}
        className="mb-2 flex w-full items-start gap-2 text-left"
        title="Ir a esta parte del documento"
      >
        <span
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{ background: esNotaDePagina ? "transparent" : COLORES[a.color].solid }}
          aria-hidden
        >
          {esNotaDePagina && <StickyNote className="h-3 w-3 text-muted-foreground" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-muted-foreground">
            Página {a.pagina}
            {esNotaDePagina ? " · Nota de página" : ""}
          </span>
          {a.texto && (
            <span className="mt-1 line-clamp-4 block italic text-foreground/80">“{a.texto}”</span>
          )}
        </span>
      </button>

      <Textarea
        ref={ref}
        rows={2}
        maxLength={NOTA_MAX}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onBlur={guardar}
        placeholder="Agregar una nota…"
        className="min-h-[2.5rem] resize-y text-sm"
        aria-label={`Nota de la página ${a.pagina}`}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        {!esNotaDePagina ? (
          <div className="flex gap-1.5" role="group" aria-label="Color del resaltado">
            {COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => c !== a.color && onUpdate(a.id, { color: c })}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition",
                  c === a.color ? "border-foreground" : "border-transparent hover:scale-110",
                )}
                style={{ background: COLORES[c].solid }}
                aria-label={COLORES[c].label}
                aria-pressed={c === a.color}
              />
            ))}
          </div>
        ) : (
          <span />
        )}
        {confirmar ? (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">¿Eliminar?</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => onDelete(a.id)}
            >
              Sí
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => setConfirmar(false)}
            >
              No
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmar(true)}
            aria-label="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </article>
  );
}
