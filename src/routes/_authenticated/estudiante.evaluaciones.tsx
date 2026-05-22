import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estudiante/evaluaciones")({
  component: Evaluaciones,
});

type Pregunta = {
  pregunta: string;
  opciones: string[];
  correcta: number;
};

type Quiz = {
  id: string;
  titulo: string;
  curso: string;
  duracion: string;
  preguntas: Pregunta[];
};

const QUIZZES: Quiz[] = [
  {
    id: "q1",
    titulo: "Fundamentos de Psicología Clínica",
    curso: "Introducción a la Psicología",
    duracion: "10 min",
    preguntas: [
      {
        pregunta: "¿Qué corriente psicológica enfatiza el estudio del comportamiento observable?",
        opciones: ["Psicoanálisis", "Conductismo", "Humanismo", "Gestalt"],
        correcta: 1,
      },
      {
        pregunta: "¿Quién es considerado el padre del psicoanálisis?",
        opciones: ["Carl Jung", "B. F. Skinner", "Sigmund Freud", "Iván Pávlov"],
        correcta: 2,
      },
      {
        pregunta: "El refuerzo positivo busca:",
        opciones: [
          "Eliminar una conducta",
          "Aumentar la probabilidad de una conducta",
          "Castigar una respuesta",
          "Ignorar el estímulo",
        ],
        correcta: 1,
      },
    ],
  },
  {
    id: "q2",
    titulo: "Marketing Digital Avanzado",
    curso: "Estrategias de Marketing",
    duracion: "15 min",
    preguntas: [
      {
        pregunta: "¿Qué significa SEO?",
        opciones: [
          "Search Engine Optimization",
          "Social Engagement Online",
          "Sales Easy Operations",
          "System Encoded Output",
        ],
        correcta: 0,
      },
      {
        pregunta: "Un embudo de conversión empieza típicamente con:",
        opciones: ["Compra", "Atención", "Lealtad", "Recomendación"],
        correcta: 1,
      },
    ],
  },
];

const HISTORIAL = [
  { curso: "Introducción al Desarrollo Web", quiz: "Examen final HTML/CSS", nota: 95, fecha: "2026-04-12", estado: "Aprobado" },
  { curso: "Marketing Digital Avanzado", quiz: "Módulo 3: SEO Técnico", nota: 88, fecha: "2026-03-28", estado: "Aprobado" },
  { curso: "Psicología Organizacional", quiz: "Quiz - Liderazgo", nota: 72, fecha: "2026-03-10", estado: "Aprobado" },
  { curso: "Diseño UX/UI", quiz: "Heurísticas de Nielsen", nota: 58, fecha: "2026-02-22", estado: "Reprobado" },
];

function Evaluaciones() {
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Evaluaciones y Logros</h1>
        <p className="text-muted-foreground">
          Pon a prueba tus conocimientos y revisa tu desempeño académico.
        </p>
      </div>

      {activeQuiz ? (
        <QuizPlayer quiz={activeQuiz} onExit={() => setActiveQuiz(null)} />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-bold">Quizzes disponibles</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {QUIZZES.map((q) => (
                <Card key={q.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{q.titulo}</CardTitle>
                      <Badge variant="outline">{q.duracion}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{q.curso}</p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {q.preguntas.length} preguntas
                    </span>
                    <Button onClick={() => setActiveQuiz(q)} size="sm">
                      <ClipboardCheck className="mr-2 h-4 w-4" /> Iniciar quiz
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-amber-500" /> Historial de calificaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso</TableHead>
                      <TableHead>Evaluación</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Nota</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {HISTORIAL.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{h.curso}</TableCell>
                        <TableCell className="text-muted-foreground">{h.quiz}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(h.fecha).toLocaleDateString("es-DO")}
                        </TableCell>
                        <TableCell className="text-right font-bold">{h.nota}</TableCell>
                        <TableCell>
                          <Badge
                            variant={h.estado === "Aprobado" ? "default" : "destructive"}
                            className={h.estado === "Aprobado" ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20" : ""}
                          >
                            {h.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function QuizPlayer({ quiz, onExit }: { quiz: Quiz; onExit: () => void }) {
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [enviado, setEnviado] = useState(false);

  const aciertos = quiz.preguntas.reduce(
    (s, p, i) => s + (respuestas[i] === p.correcta ? 1 : 0), 0,
  );
  const nota = Math.round((aciertos / quiz.preguntas.length) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{quiz.titulo}</CardTitle>
            <p className="text-sm text-muted-foreground">{quiz.curso}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onExit}>Salir</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {quiz.preguntas.map((p, i) => (
          <div key={i} className="space-y-2">
            <p className="font-medium">
              {i + 1}. {p.pregunta}
            </p>
            <div className="grid gap-2">
              {p.opciones.map((op, j) => {
                const selected = respuestas[i] === j;
                const correct = enviado && j === p.correcta;
                const wrong = enviado && selected && j !== p.correcta;
                return (
                  <button
                    key={j}
                    type="button"
                    disabled={enviado}
                    onClick={() => setRespuestas({ ...respuestas, [i]: j })}
                    className={cn(
                      "flex items-center justify-between rounded-md border p-3 text-left text-sm transition",
                      selected && !enviado && "border-primary bg-primary/5",
                      correct && "border-emerald-500 bg-emerald-500/10",
                      wrong && "border-red-500 bg-red-500/10",
                      !enviado && !selected && "hover:bg-muted/50",
                    )}
                  >
                    <span>{op}</span>
                    {correct && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {wrong && <XCircle className="h-4 w-4 text-red-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {enviado ? (
          <div className="rounded-lg border bg-muted/30 p-5 text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-500" />
            <p className="mt-2 text-lg font-bold">
              {aciertos} de {quiz.preguntas.length} correctas
            </p>
            <p className="text-3xl font-extrabold text-primary">{nota}%</p>
            <p className="text-sm text-muted-foreground">
              {nota >= 70 ? "¡Aprobado! 🎉" : "Sigue practicando 💪"}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={() => { setRespuestas({}); setEnviado(false); }}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reintentar
              </Button>
              <Button onClick={onExit}>Finalizar</Button>
            </div>
          </div>
        ) : (
          <Button
            className="w-full"
            disabled={Object.keys(respuestas).length !== quiz.preguntas.length}
            onClick={() => setEnviado(true)}
          >
            Enviar respuestas
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
