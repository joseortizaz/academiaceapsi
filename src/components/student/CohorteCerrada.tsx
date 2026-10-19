import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COHORTE_DIAS_GRACIA, fechaLargaCohorte, type AccesoCohorte } from "@/lib/cohortes";

/** Pantalla del reproductor cuando el grupo del alumno ya cerró (fecha de término + 10 días). */
export function CohorteCerrada({ acceso }: { acceso: AccesoCohorte }) {
  return (
    <div className="mx-auto max-w-xl p-8 text-center">
      <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 text-xl font-bold">El acceso a este programa finalizó</h2>
      <p className="mt-2 text-muted-foreground">
        {acceso.cohorte ? (
          <>
            Tu grupo <strong>{acceso.cohorte}</strong>
          </>
        ) : (
          "Tu grupo"
        )}
        {acceso.fecha_fin ? <> terminó el {fechaLargaCohorte(acceso.fecha_fin)}</> : " terminó"}.
        Los contenidos estuvieron disponibles hasta {COHORTE_DIAS_GRACIA} días después de la fecha
        de término
        {acceso.ultimo_dia_acceso ? <> ({fechaLargaCohorte(acceso.ultimo_dia_acceso)})</> : null}.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Tus certificados siguen disponibles. Si necesitas algo de este programa, escríbenos.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/certificados">Mis certificados</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/mis-cursos">Volver a mis cursos</Link>
        </Button>
      </div>
    </div>
  );
}
