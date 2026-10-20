import { describe, expect, test } from "bun:test";
import { canDownloadCertificate } from "./certificate-status";

describe("descarga según el estado persistido", () => {
  test("emitido permite descargar", () => expect(canDownloadCertificate("emitido")).toBe(true));
  test("pendiente_aprobacion no permite descargar", () => expect(canDownloadCertificate("pendiente_aprobacion")).toBe(false));
  test("rechazado no permite descargar", () => expect(canDownloadCertificate("rechazado")).toBe(false));
  test("revocado no permite descargar", () => expect(canDownloadCertificate("revocado")).toBe(false));
});