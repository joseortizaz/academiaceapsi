import { createHmac, timingSafeEqual } from "crypto";

const BASE_URL = () => process.env.BALANCE_ACTIVO_API_URL || "https://balanceactivo.net/api/public/v1";
const API_KEY = () => process.env.BALANCE_ACTIVO_API_KEY;
const WEBHOOK_SECRET = () => process.env.BALANCE_ACTIVO_WEBHOOK_SECRET;

export class BalanceActivoError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function baFetch<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const key = API_KEY();
  if (!key) throw new BalanceActivoError(0, "no_key", "BALANCE_ACTIVO_API_KEY no está configurada");
  const url = `${BASE_URL()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new BalanceActivoError(res.status, err.code || "http_error", err.message || res.statusText);
  }
  return (json?.data ?? json) as T;
}

export type BaCustomer = {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  documento?: string | null;
};

export type BaInvoice = {
  id: string;
  cliente_id: string;
  ncf?: string | null;
  numero?: string | null;
  fecha?: string | null;
  concepto?: string | null;
  moneda?: string | null;
  subtotal?: number | null;
  itbis?: number | null;
  total: number;
  saldo?: number | null;
  estado: string;
  pdf_url?: string | null;
  factura_lineas?: any[];
};

export type BaPayment = {
  id: string;
  factura_id: string;
  cliente_id?: string;
  fecha?: string | null;
  monto: number;
  moneda?: string | null;
  metodo?: string | null;
  nota?: string | null;
};

export function verifyBaSignature(rawBody: string, header: string | null): boolean {
  const secret = WEBHOOK_SECRET();
  if (!secret || !header?.startsWith("sha256=")) return false;
  try {
    const received = Buffer.from(header.slice(7), "hex");
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}
