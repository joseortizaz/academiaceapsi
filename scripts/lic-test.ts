import { getOrAssignZoomLicense } from "../src/lib/zoom-licenses.server";
const A="dfee9a8e-2f75-44f1-8ba2-db6a08391cd8";
console.log("sujeidy", await getOrAssignZoomLicense(A));
console.log("sujeidy again", await getOrAssignZoomLicense(A));
const others = await (await import("../src/integrations/supabase/client.server")).supabaseAdmin.from("teachers").select("id").neq("id",A).limit(2);
const [b,c] = others.data as any[];
console.log("teacher B", b.id, await getOrAssignZoomLicense(b.id));
try { console.log("teacher C", await getOrAssignZoomLicense(c.id)); } catch(e:any){ console.log("teacher C error:", e.message); }
console.log("admin fallback (null)", await getOrAssignZoomLicense(null));
