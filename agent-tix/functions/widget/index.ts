// Agent Tix — serves the booking widget
//
// One address the whole site points at. Changing the widget changes every page
// at once, with nothing to re-paste anywhere.
//
// Cached for five minutes at the edge, with stale-while-revalidate, so a change
// reaches guests quickly without every page load hitting this function.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import widgetSource from "./source.ts";

Deno.serve((req: Request) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  return new Response(req.method === "HEAD" ? null : widgetSource, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      // Served to the site, so any page may load it. It is public code and
      // carries no secrets; the guest-facing checks live on the two functions
      // it calls, which do look at where the request came from.
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
