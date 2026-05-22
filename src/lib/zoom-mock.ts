// Mock Zoom integration store — persisted in localStorage, reactive via custom events.
// Connects Admin (integration + logs), Docente (schedule + recordings), Estudiante (live banner + recordings).

import { useEffect, useState } from "react";

export type ZoomClassStatus = "scheduled" | "live" | "recorded";

export type ZoomClass = {
  id: string;
  titulo: string;
  programaId: string;
  programaTitulo: string;
  docenteNombre: string;
  startAt: string; // ISO
  durationMin: number;
  zoomMeetingId: string;
  zoomJoinUrl: string;
  zoomStartUrl: string;
  autoGenerate: boolean;
  autoRecord: boolean;
  status: ZoomClassStatus;
  recordingUrl?: string;
  recordingDurationMin?: number;
  createdAt: string;
};

export type WebhookLog = {
  id: string;
  event: string;
  message: string;
  at: string;
  level: "info" | "success" | "warning";
};

export type ZoomConnection = {
  connected: boolean;
  email?: string;
  connectedAt?: string;
  accountName?: string;
};

type StoreShape = {
  connection: ZoomConnection;
  classes: ZoomClass[];
  logs: WebhookLog[];
};

const KEY = "ceapsi.zoom.mock.v1";
const EVT = "ceapsi-zoom-store-changed";

const SAMPLE_RECORDING =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

function seed(): StoreShape {
  const now = Date.now();
  const inOneHour = new Date(now + 60 * 60 * 1000).toISOString();
  const yesterday = new Date(now - 26 * 60 * 60 * 1000).toISOString();
  return {
    connection: { connected: false },
    classes: [
      {
        id: cryptoId(),
        titulo: "Clase magistral: Fundamentos de HTML semántico",
        programaId: "demo-web",
        programaTitulo: "Introducción a Desarrollo Web",
        docenteNombre: "Prof. María Pérez",
        startAt: inOneHour,
        durationMin: 60,
        zoomMeetingId: "928 4731 0021",
        zoomJoinUrl: "https://zoom.us/j/92847310021?pwd=demo",
        zoomStartUrl: "https://zoom.us/s/92847310021?role=host",
        autoGenerate: true,
        autoRecord: true,
        status: "scheduled",
        createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: cryptoId(),
        titulo: "Workshop: Embudos de conversión",
        programaId: "demo-mkt",
        programaTitulo: "Marketing Digital Avanzado",
        docenteNombre: "Prof. Carlos Reyes",
        startAt: yesterday,
        durationMin: 90,
        zoomMeetingId: "771 0042 8810",
        zoomJoinUrl: "https://zoom.us/j/77100428810?pwd=demo",
        zoomStartUrl: "https://zoom.us/s/77100428810?role=host",
        autoGenerate: true,
        autoRecord: true,
        status: "recorded",
        recordingUrl: SAMPLE_RECORDING,
        recordingDurationMin: 87,
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    logs: [
      {
        id: cryptoId(),
        event: "recording.completed",
        message: "Grabación de 'Workshop: Embudos de conversión' procesada y publicada.",
        at: new Date(now - 22 * 60 * 60 * 1000).toISOString(),
        level: "success",
      },
      {
        id: cryptoId(),
        event: "meeting.ended",
        message: "Reunión 771 0042 8810 finalizada — iniciando procesamiento de grabación.",
        at: new Date(now - 23 * 60 * 60 * 1000).toISOString(),
        level: "info",
      },
    ],
  };
}

function cryptoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function read(): StoreShape {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw) as StoreShape;
  } catch {
    return seed();
  }
}

function write(s: StoreShape) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(EVT));
}

export const zoomStore = {
  get: read,
  connect(email: string) {
    const s = read();
    s.connection = {
      connected: true,
      email,
      accountName: "Academia Ceapsi RD",
      connectedAt: new Date().toISOString(),
    };
    s.logs.unshift({
      id: cryptoId(),
      event: "oauth.connected",
      message: `Cuenta Zoom conectada: ${email}`,
      at: new Date().toISOString(),
      level: "success",
    });
    write(s);
  },
  disconnect() {
    const s = read();
    s.connection = { connected: false };
    s.logs.unshift({
      id: cryptoId(),
      event: "oauth.revoked",
      message: "Cuenta Zoom desconectada.",
      at: new Date().toISOString(),
      level: "warning",
    });
    write(s);
  },
  scheduleClass(input: {
    titulo: string;
    programaId: string;
    programaTitulo: string;
    docenteNombre: string;
    startAt: string;
    durationMin: number;
    autoGenerate: boolean;
    autoRecord: boolean;
  }): ZoomClass {
    const s = read();
    const meetingId = Math.floor(Math.random() * 1e10)
      .toString()
      .padStart(10, "0")
      .replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3");
    const rawId = meetingId.replace(/\s/g, "");
    const newClass: ZoomClass = {
      id: cryptoId(),
      ...input,
      zoomMeetingId: meetingId,
      zoomJoinUrl: input.autoGenerate
        ? `https://zoom.us/j/${rawId}?pwd=demo`
        : "",
      zoomStartUrl: input.autoGenerate
        ? `https://zoom.us/s/${rawId}?role=host`
        : "",
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };
    s.classes.unshift(newClass);
    s.logs.unshift({
      id: cryptoId(),
      event: "meeting.created",
      message: `Reunión creada: "${input.titulo}" (ID ${meetingId}).`,
      at: new Date().toISOString(),
      level: "info",
    });
    write(s);
    return newClass;
  },
  startClass(id: string) {
    const s = read();
    const c = s.classes.find((x) => x.id === id);
    if (!c) return;
    c.status = "live";
    s.logs.unshift({
      id: cryptoId(),
      event: "meeting.started",
      message: `Clase iniciada: "${c.titulo}".`,
      at: new Date().toISOString(),
      level: "info",
    });
    write(s);
  },
  simulateMeetingEnd(id: string) {
    const s = read();
    const c = s.classes.find((x) => x.id === id);
    if (!c) return;
    s.logs.unshift({
      id: cryptoId(),
      event: "meeting.ended",
      message: `Reunión ${c.zoomMeetingId} finalizada — procesando grabación…`,
      at: new Date().toISOString(),
      level: "info",
    });
    // Simulate webhook landing a bit later
    setTimeout(() => {
      const s2 = read();
      const c2 = s2.classes.find((x) => x.id === id);
      if (!c2) return;
      c2.status = "recorded";
      c2.recordingUrl = SAMPLE_RECORDING;
      c2.recordingDurationMin = c2.durationMin;
      s2.logs.unshift({
        id: cryptoId(),
        event: "recording.completed",
        message: `Grabación lista para "${c2.titulo}". Disponible en el aula virtual.`,
        at: new Date().toISOString(),
        level: "success",
      });
      write(s2);
    }, 1500);
    write(s);
  },
  deleteClass(id: string) {
    const s = read();
    s.classes = s.classes.filter((c) => c.id !== id);
    write(s);
  },
  clearLogs() {
    const s = read();
    s.logs = [];
    write(s);
  },
};

export function useZoomStore() {
  const [state, setState] = useState<StoreShape>(() => read());
  useEffect(() => {
    const handler = () => setState(read());
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return state;
}

export function isLiveNow(c: ZoomClass): boolean {
  if (c.status === "live") return true;
  if (c.status === "recorded") return false;
  const start = new Date(c.startAt).getTime();
  const end = start + c.durationMin * 60 * 1000;
  const now = Date.now();
  return now >= start && now <= end;
}
