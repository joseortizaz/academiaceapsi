import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { canDownloadCertificate } from "./certificate-status";

describe("descarga según el estado persistido", () => {
  test("emitido permite descargar", () => assert.equal(canDownloadCertificate("emitido"), true));
  test("pendiente_aprobacion no permite descargar", () => assert.equal(canDownloadCertificate("pendiente_aprobacion"), false));
  test("rechazado no permite descargar", () => assert.equal(canDownloadCertificate("rechazado"), false));
  test("revocado no permite descargar", () => assert.equal(canDownloadCertificate("revocado"), false));
});