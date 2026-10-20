import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

// Every integration test rolls back, including notifications and audit entries.
async function checkInitialState(modalidad: string, admin: boolean, expected: string) {
  const url = process.env.CERTIFICATE_TEST_DATABASE_URL;
  if (!url) throw new Error("Falta la conexión de prueba");
  const sql = postgres(url, { max: 1, prepare: false });
  let verified = false;
  const rollback = new Error("rollback certificate test");
  try {
    await sql.begin(async (tx) => {
      const [actor] = await tx`select id from public.profiles where public.has_role(id, 'admin'::public.app_role) = ${admin} limit 1`;
      assert.ok(actor, "La prueba requiere un perfil con el rol indicado");
      const before = await tx`select id, estado from public.certificates order by id`;
      const [program] = await tx`insert into public.programs (titulo, slug, descripcion, tipo, modalidad) values ('Prueba transaccional certificado', ${`certificate-test-${crypto.randomUUID()}`}, 'Prueba que se revierte', 'curso', ${modalidad}) returning id`;
      const [enrollment] = await tx`insert into public.enrollments (user_id, programa_id, estado, progreso_porcentaje) values (${actor.id}, ${program.id}, 'activo', 100) returning id`;
      await tx`select set_config('request.jwt.claim.sub', ${actor.id}, true)`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: actor.id, role: "authenticated" })}, true)`;
      await tx`set local role authenticated`;
      const [cert] = await tx`insert into public.certificates (user_id, programa_id, enrollment_id, numero_certificado, estado) values (${actor.id}, ${program.id}, ${enrollment.id}, ${`TEST-${crypto.randomUUID()}`}, 'emitido') returning id, estado`;
      assert.equal(cert.estado, expected);
      await tx`reset role`;
      if (expected === "pendiente_aprobacion") {
        const notifications = await tx`select user_id, enlace from public.notifications where tipo='certificado_pendiente' and programa_id=${program.id}`;
        const admins = await tx`select user_id from public.user_roles where role='admin'`;
        assert.ok(admins.length > 0);
        assert.equal(notifications.length, admins.length);
        assert.ok(notifications.every((n) => n.enlace === "/admin/certificados"));
      }
      const after = await tx`select id, estado from public.certificates where id <> ${cert.id} order by id`;
      assert.deepEqual(after, before, "Los certificados anteriores no cambian");
      verified = true;
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await sql.end();
  }
  assert.equal(verified, true);
}

// A dedicated privileged test database is required to SET ROLE authenticated;
// the sandbox read-only connection cannot exercise insert/RLS behavior.
const options = { skip: !process.env.CERTIFICATE_TEST_DATABASE_URL };
test("sincrono: fuerza pendiente aunque el alumno envíe emitido y notifica admins", options, () => checkInitialState("sincrono", false, "pendiente_aprobacion"));
test("mixto: fuerza pendiente aunque el alumno envíe emitido y notifica admins", options, () => checkInitialState("mixto", false, "pendiente_aprobacion"));
test("asincrono: alumno recibe emitido automáticamente", options, () => checkInitialState("asincrono", false, "emitido"));
test("admin: emisión manual síncrona queda emitida", options, () => checkInitialState("sincrono", true, "emitido"));