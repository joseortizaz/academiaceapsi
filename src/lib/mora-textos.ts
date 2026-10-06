/**
 * Textos de los avisos de mora (plan acordado con la dirección, 2026-10-06).
 * Un solo lugar para el correo, la campana del portal, el aviso en pantalla y
 * el mensaje de WhatsApp que envía la dirección a mano.
 */

export type TipoAvisoMora = "previo" | "aviso1" | "aviso2" | "aviso3" | "aviso4";

export type DatosAvisoMora = {
  nombre: string;
  /** Monto pendiente de la cuota a la que se refiere el aviso (RD$). */
  monto: number;
  /** Vencimiento de esa cuota, ISO yyyy-mm-dd. */
  vencimiento: string;
  /** Saldo vencido total del alumno (RD$). */
  saldoVencido?: number;
  contacto: string;
  /** Próxima cuota, si además vence pronto (se menciona al final). */
  proxima?: { monto: number; vencimiento: string } | null;
  /** Hoy en RD (yyyy-mm-dd); permite redactar distinto si la fecha de restricción ya pasó. */
  hoy?: string;
};

/** Hoy en República Dominicana, yyyy-mm-dd. */
export function hoyRD(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "30 de noviembre de 2026" a partir de "2026-11-30" (sin zonas horarias). */
export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** Suma días a una fecha ISO yyyy-mm-dd. */
export function sumarDias(iso: string, dias: number): string {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function rd(n: number): string {
  return `RD$${Number(n ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const DIAS_GRACIA = 5;
export const DIAS_RESTRICCION = 30;

export type TextoAviso = {
  asunto: string;
  /** Párrafos del correo (sin saludo). */
  parrafos: string[];
  /** Versión corta para la campana del portal. */
  corto: string;
};

export function textoAviso(tipo: TipoAvisoMora, d: DatosAvisoMora): TextoAviso {
  const venc = fechaLarga(d.vencimiento);
  const monto = rd(d.monto);
  const finGracia = fechaLarga(sumarDias(d.vencimiento, DIAS_GRACIA));
  const restriccion = fechaLarga(sumarDias(d.vencimiento, DIAS_RESTRICCION));
  const proxima = d.proxima
    ? `Además, su próxima cuota de ${rd(d.proxima.monto)} vence el ${fechaLarga(d.proxima.vencimiento)}.`
    : null;
  const conProxima = (p: string[]) => (proxima ? [...p, proxima] : p);

  switch (tipo) {
    case "previo": {
      return {
        asunto: `Su próximo pago vence el ${venc}`,
        parrafos: [
          `Le recordamos que su próxima cuota de ${monto} debe pagarse el ${venc}.`,
          "Si ya realizó el pago, por favor ignore este mensaje.",
        ],
        corto: `Su próxima cuota de ${monto} vence el ${venc}.`,
      };
    }
    case "aviso1": {
      return {
        asunto: "Último día para pagar su cuota sin mora",
        parrafos: conProxima([
          `Le recordamos que su cuota de ${monto} venció el ${venc}. El ${finGracia} es el último día para pagarla sin entrar en mora.`,
          "Si ya realizó el pago, por favor ignore este mensaje.",
        ]),
        corto: `Su cuota de ${monto} venció el ${venc}. El ${finGracia} es el último día para pagarla sin mora.`,
      };
    }
    case "aviso2": {
      return {
        asunto: "Tiene una cuota pendiente de pago",
        parrafos: conProxima([
          `Su cuota de ${monto}, vencida el ${venc}, sigue pendiente. Le pedimos realizar el pago a la mayor brevedad para mantener su cuenta al día.`,
          `Puede ver su estado de cuenta en el portal. Si necesita ayuda, escríbanos a ${d.contacto}.`,
        ]),
        corto: `Su cuota de ${monto}, vencida el ${venc}, sigue pendiente.`,
      };
    }
    case "aviso3": {
      const restriccionIso = sumarDias(d.vencimiento, DIAS_RESTRICCION);
      if (d.hoy && restriccionIso <= d.hoy) {
        // Ya pasó la fecha (p. ej., avisos activados antes que la restricción).
        const saldo = rd(d.saldoVencido ?? d.monto);
        return {
          asunto: "Su acceso a los contenidos puede ser restringido",
          parrafos: conProxima([
            `Tiene cuotas vencidas desde el ${venc} por un total de ${saldo}. Si no regulariza su situación, el sistema restringirá su acceso a los contenidos de sus programas.`,
            `Para evitarlo, realice el pago o comuníquese con la dirección en ${d.contacto}.`,
          ]),
          corto: `Tiene cuotas vencidas por ${saldo}. Si no regulariza su situación, su acceso a los contenidos será restringido.`,
        };
      }
      return {
        asunto: "Su acceso a los contenidos puede ser restringido",
        parrafos: conProxima([
          `Su cuota de ${monto}, vencida el ${venc}, continúa pendiente. Si el ${restriccion} se acumulan dos cuotas sin pagar, el sistema restringirá su acceso a los contenidos de sus programas.`,
          `Para evitarlo, realice el pago antes de esa fecha o comuníquese con la dirección en ${d.contacto}.`,
        ]),
        corto: `Si el ${restriccion} se acumulan dos cuotas sin pagar, su acceso a los contenidos será restringido.`,
      };
    }
    case "aviso4": {
      const saldo = d.saldoVencido != null ? ` Saldo vencido: ${rd(d.saldoVencido)}.` : "";
      return {
        asunto: "Su acceso a los contenidos ha sido restringido",
        parrafos: [
          `Su acceso a los contenidos ha sido restringido por incumplimiento en el pago. Le pedimos comunicarse con la dirección en ${d.contacto} para regularizar su situación.${saldo}`,
        ],
        corto: "Su acceso a los contenidos ha sido restringido por incumplimiento en el pago. Comuníquese con la dirección.",
      };
    }
  }
}

/** Mensaje completo en texto plano (para WhatsApp). */
export function textoPlano(tipo: TipoAvisoMora, d: DatosAvisoMora): string {
  const t = textoAviso(tipo, d);
  return [`Hola, ${d.nombre}.`, ...t.parrafos, "Academia Ceapsi RD"].join("\n\n");
}

export const ETIQUETA_TIPO: Record<TipoAvisoMora, string> = {
  previo: "Recordatorio previo",
  aviso1: "Aviso 1",
  aviso2: "Aviso 2",
  aviso3: "Aviso 3",
  aviso4: "Aviso 4 (restricción)",
};

export const ETIQUETA_ETAPA: Record<string, string> = {
  al_dia: "Al día",
  gracia: "En gracia",
  mora: "En mora",
  por_restringir: "Por restringir",
  restringido: "Restringido",
  acuerdo: "En acuerdo",
};
