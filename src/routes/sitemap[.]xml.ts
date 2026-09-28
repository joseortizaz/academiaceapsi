import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import {
  isSitemapRouteIncluded,
  sitemapPathForLocation,
  sitemapStaticPaths,
  sitemapXML,
  type SitemapEntry,
} from "@/lib/sitemap";

const BASE_URL = "https://academiaceapsi.com";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        const router = await getRouterInstance();
        const entries: SitemapEntry[] = sitemapStaticPaths(router).map((path) => ({ path }));

        const { createClient } = await import("@supabase/supabase-js");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const pageSize = 1000;

        const programRoute = "/programas/$slug";
        if (isSitemapRouteIncluded(router.routesById[programRoute])) {
          for (let offset = 0; ; ) {
            const { data, error } = await supabase
              .from("programs")
              .select("id,slug")
              .in("estado", ["publicado", "en_curso"])
              .order("id")
              .range(offset, offset + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            for (const row of data) {
              if (!row.slug) continue;
              const location = router.buildLocation({
                to: "/programas/$slug", params: { slug: row.slug }, search: () => ({}), hash: "",
              } as never);
              const path = sitemapPathForLocation(router, location, programRoute);
              if (path) entries.push({ path });
            }
            offset += data.length;
          }
        }

        const blogRoute = "/blog/$slug";
        if (isSitemapRouteIncluded(router.routesById[blogRoute])) {
          for (let offset = 0; ; ) {
            const { data, error } = await supabase
              .from("blog_posts")
              .select("id,slug")
              .eq("estado", "publicado")
              .order("id")
              .range(offset, offset + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            for (const row of data) {
              if (!row.slug) continue;
              const location = router.buildLocation({
                to: "/blog/$slug", params: { slug: row.slug }, search: () => ({}), hash: "",
              } as never);
              const path = sitemapPathForLocation(router, location, blogRoute);
              if (path) entries.push({ path });
            }
            offset += data.length;
          }
        }

        return new Response(sitemapXML(BASE_URL, entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
