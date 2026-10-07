/**
 * Gecko's Gateway — EmailRep proxy
 *
 * Deploy this file as a Cloudflare Worker.
 * Store the EmailRep API key as a Worker secret named EMAILREP_API_KEY.
 *
 * The browser calls this Worker instead of EmailRep directly so the API key
 * never appears in the public GitHub Pages JavaScript.
 */

const ALLOWED_ORIGINS = new Set([
  "https://cobaltmoth0.github.io",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed." }, 405, origin);
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed." }, 403, origin);
    }

    const email = new URL(request.url).searchParams.get("email")?.trim() || "";
    if (!EMAIL_RE.test(email)) {
      return json({ error: "Enter a valid email address." }, 400, origin);
    }

    if (!env.EMAILREP_API_KEY) {
      return json({ error: "EmailRep API key is not configured on the proxy." }, 500, origin);
    }

    try {
      const upstream = await fetch("https://emailrep.io/" + encodeURIComponent(email), {
        headers: {
          "Accept": "application/json",
          "Key": env.EMAILREP_API_KEY,
          "User-Agent": "Geckos-Gateway-Email-Reputation-Checker",
        },
        cf: { cacheTtl: 0, cacheEverything: false },
      });

      const body = await upstream.text();

      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(origin),
          "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
        },
      });
    } catch {
      return json({ error: "Unable to contact EmailRep." }, 502, origin);
    }
  },
};
