import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listMyCourses from "./tools/list-my-courses";
import listMyCertificates from "./tools/list-my-certificates";

// El issuer OAuth debe apuntar directo a Supabase (no al proxy .lovable.cloud).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "academia-ceapsi-mcp",
  title: "Academia Ceapsi RD",
  version: "0.1.0",
  instructions:
    "Herramientas para consultar tu perfil académico en Academia Ceapsi RD: cursos matriculados, certificados emitidos y verificación de identidad. Todas las operaciones actúan como el usuario autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listMyCourses, listMyCertificates],
});
