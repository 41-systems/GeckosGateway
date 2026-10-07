"use strict";
const $ = id => document.getElementById(id);

async function getJSON(url, opts = {}, ms = 10000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", ...opts, signal: c.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch (e) {
    throw e.name === "AbortError" ? new Error("Request timed out") : e;
  } finally { clearTimeout(t); }
}

function ping(url, ms = 6000) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return fetch(url, { mode: "no-cors", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: c.signal }).catch(() => {});
}

function fill(el, rows) {
  el.textContent = "";
  for (const r of rows) {
    if (r.length > 1) {
      const s = document.createElement("span");
      s.className = "highlight";
      s.textContent = r[0] + " ";
      el.append(s, document.createTextNode(String(r[1] ?? "N/A") + "\n"));
    } else el.append(document.createTextNode(String(r[0] ?? "") + "\n"));
  }
}

function addLink(el, href, text) {
  if (!/^https:\/\//.test(href)) return;
  const a = document.createElement("a");
  a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.className = "map-link"; a.textContent = text;
  el.append(a, "\n");
}

function cleanDomain(raw) {
  try {
    const h = new URL("http://" + String(raw).trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")).hostname.replace(/\.$/, "");
    return /^(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9-]{2,63}$/.test(h) ? h : null;
  } catch { return null; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function rand(max) {
  if (max <= 1) return 0;
  const lim = Math.floor(0x100000000 / max) * max, a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return a[0] % max;
}

function setAccent(btn) {
  const container = document.querySelector(".container");
  container.classList.remove(...Array.from({ length: 7 }, (_, i) => `accent-${i + 1}`));
  container.classList.add(`accent-${[...document.querySelectorAll(".tab-btn")].indexOf(btn) % 7 + 1}`);
}

function switchTab(btn) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  $(btn.dataset.tab).classList.add("active");
  btn.classList.add("active");
  setAccent(btn);
  if (btn.dataset.tab === "news-panel" && !newsLoaded) loadNews();
}

const RR = { 1: "A", 2: "NS", 5: "CNAME", 15: "MX", 16: "TXT", 28: "AAAA" };

async function lookupDNS() {
  const out = $("dns-output"), d = cleanDomain($("domain-input").value), t = $("record-type").value;
  if (!d) { out.textContent = "Enter a valid domain name, e.g. example.com"; return; }
  out.textContent = `Fetching ${t} record for ${d}...`;
  try {
    const j = await getJSON(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(d)}&type=${encodeURIComponent(t)}`,
      { headers: { Accept: "application/dns-json" }, cache: "no-store" });
    if (!j.Answer?.length) { out.textContent = `No ${t} records found for ${d}.`; return; }
    out.textContent = `Results for ${d} (${t}):\n\n` + j.Answer.map(r =>
      `Name: ${r.name}\nType: ${RR[r.type] || r.type}\nTTL: ${r.TTL}s\nData: ${r.data}`).join("\n-------------------------------\n");
  } catch (e) { out.textContent = "Error querying DNS: " + e.message; }
}

async function runLeakTest() {
  const out = $("leak-output"), btn = $("leak-btn");
  const id = String(1000000 + rand(9000000));
  const resultsUrl = `https://bash.ws/dnsleak/test/${id}`;
  btn.disabled = true;
  try {
    out.textContent = "Step 1/3: triggering 10 unique DNS lookups...";
    await Promise.all(Array.from({ length: 10 }, (_, i) => ping(`https://${i + 1}.${id}.bash.ws/`)));
    out.textContent = "Step 2/3: waiting for the test server to collect resolver data...";
    let rows = [];
    for (let i = 0; i < 4; i++) {
      await sleep(1500);
      rows = await getJSON(resultsUrl + "?json", { cache: "no-store" });
      if (Array.isArray(rows) && rows.some(r => r.type === "dns")) break;
    }
    if (!Array.isArray(rows)) throw new Error("Unexpected response from test server");
    const info = r => [r.ip, r.country_name, r.asn].filter(Boolean).join(" · ");
    const mine = rows.filter(r => r.type === "ip"), dns = rows.filter(r => r.type === "dns"), verdict = rows.filter(r => r.type === "conclusion");
    const lines = [];
    mine.forEach(r => lines.push(["Your IP:", info(r)]));
    lines.push([""], [`Resolvers seen (${dns.length}):`]);
    if (!dns.length) lines.push(["No resolver queries were recorded. Try again with any ad-blocker or DNS filter turned off."]);
    dns.forEach(r => lines.push(["Resolver:", info(r)]));
    verdict.forEach(r => lines.push([""], ["Service verdict:", r.ip]));
    fill(out, lines);
  } catch (e) {
    out.textContent = "Couldn't fetch results (" + e.message + "). You can view them here:\n";
    addLink(out, resultsUrl + "?txt", "Open results on bash.ws ↗");
  } finally { btn.disabled = false; }
}

async function checkReachability() {
  const out = $("reach-output"), btn = $("reach-btn");
  let target;
  try {
    const raw = $("reach-input").value.trim();
    if (!raw) throw new Error("Enter a website or URL.");
    target = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
    if (target.username || target.password) throw new Error("URLs containing embedded credentials are not allowed.");
  } catch (e) {
    out.classList.remove("reach-success", "reach-failure");
    out.textContent = e.message;
    return;
  }

  btn.disabled = true;
  out.classList.remove("reach-success", "reach-failure");
  out.textContent = "Testing from this browser...\n\nResolving the host and attempting a network connection.";
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(target.href, {
      method: "GET", mode: "no-cors", cache: "no-store", credentials: "omit",
      referrerPolicy: "no-referrer", signal: controller.signal
    });
    const elapsed = Math.round(performance.now() - started);
    out.classList.add("reach-success");
    fill(out, [
      ["Result:", "✓ Reachable from this browser/network"],
      ["URL:", target.href], ["Host:", target.hostname], ["Time:", elapsed + " ms"], [""],
      ["What this means:", "The browser completed a network request to the host. The response is intentionally unreadable here because this is a cross-origin browser test."],
      [""],
      ["Note:", "A successful test proves the host was reachable, but cannot prove that every page/resource is allowed. A DNS filter that returns a block page can also appear reachable."]
    ]);
    if (response.type !== "opaque") {
      out.append("\n");
      fill(out, [["Response:", response.status + (response.statusText ? " " + response.statusText : "")]]);
    }
  } catch (e) {
    const elapsed = Math.round(performance.now() - started);
    const reason = e.name === "AbortError" ? "Timed out" : "Network request failed";
    out.classList.add("reach-failure");
    fill(out, [
      ["Result:", "✗ Not reachable from this browser/network"],
      ["URL:", target.href], ["Host:", target.hostname], ["Time:", elapsed + " ms"], [""],
      ["Browser result:", reason], [""],
      ["Possible causes:", "DNS filtering/blocking, firewall or content filtering, TLS failure, captive portal, offline connectivity, or a browser policy."],
      [""],
      ["Important:", "Browser JavaScript cannot directly tell us which DNS server was used or reliably distinguish DNS blocking from every other network failure."]
    ]);
  } finally {
    clearTimeout(timer);
    btn.disabled = false;
  }
}async function fetchIPDetails() {
  const out = $("ip-output"), box = $("ip-map-container"), map = $("ip-map");
  out.textContent = "Fetching IP information and geolocation data...";
  box.classList.remove("visible");
  try {
    const d = await getJSON("https://ipwho.is/", { cache: "no-store" });
    if (d.success === false) throw new Error(d.message || "Lookup failed");
    const c = d.connection || {}, lat = Number(d.latitude), lon = Number(d.longitude);
    const ok = d.latitude != null && d.longitude != null && Number.isFinite(lat) && Number.isFinite(lon);
    fill(out, [
      ["Public WAN IP:", d.ip],
      ["Network / ASN:", `AS${c.asn ?? d.asn ?? "N/A"} - ${c.org ?? d.asn_org ?? "N/A"}`],
      ["ISP:", c.isp ?? d.isp],
      [""], ["--- GEO LOCATION DETAILS ---"],
      ["City / Region:", `${d.city ?? "N/A"}, ${d.region ?? "N/A"} (${d.postal ?? "N/A"})`],
      ["Country:", `${d.country ?? "N/A"} (${d.country_code ?? "N/A"})`],
      ["Coordinates:", ok ? `${lat}, ${lon}` : "N/A"],
      [""]
    ]);
    if (ok) {
      const o = 0.04;
      map.src = "https://www.openstreetmap.org/export/embed.html?bbox=" + encodeURIComponent(`${lon - o},${lat - o},${lon + o},${lat + o}`) +
        "&layer=mapnik&marker=" + encodeURIComponent(`${lat},${lon}`);
      box.classList.add("visible");
      addLink(out, `https://www.google.com/maps?q=${lat},${lon}`, "View in Google Maps ↗");
    }
    out.append("\n");
    const s = document.createElement("span"); s.className = "highlight"; s.textContent = "User Agent: ";
    out.append(s, navigator.userAgent);
  } catch (e) { out.textContent = "Error fetching IP details: " + e.message; }
}

async function fetchWHOIS() {
  const out = $("whois-output"), d = cleanDomain($("whois-input").value);
  if (!d) { out.textContent = "Enter a valid domain name, e.g. wikipedia.org"; return; }
  out.textContent = `Querying RDAP registration records for ${d}...`;
  try {
    let j;
    try { j = await getJSON(`https://rdap.org/domain/${encodeURIComponent(d)}`, { headers: { Accept: "application/rdap+json" } }, 15000); }
    catch (e) { throw e.message === "HTTP 404" ? new Error("Domain or RDAP record not found.") : e; }
    const fd = s => { const t = new Date(s); return isNaN(t) ? "N/A" : t.toUTCString(); };
    const ev = a => fd((j.events || []).find(e => e.eventAction === a)?.eventDate);
    const reg = (j.entities || []).find(e => Array.isArray(e.roles) && e.roles.includes("registrar"));
    const registrar = reg?.vcardArray?.[1]?.find(i => i[0] === "fn")?.[3] || reg?.handle || "N/A";
    const ns = (j.nameservers || []).map(n => n.ldhName || n.handle).filter(Boolean);
    const st = Array.isArray(j.status) ? j.status : [];
    fill(out, [
      ["Domain Name:", j.ldhName || d], ["Registrar:", registrar], ["Registered On:", ev("registration")],
      ["Expires On:", ev("expiration")], ["Last Updated:", ev("last changed")], ["Nameservers:", ns.join(", ") || "N/A"],
      ["RDAP Status(es):", st.length ? "" : "N/A"], ...st.map(s => ["• " + s])
    ]);
  } catch (e) { out.textContent = "Error querying RDAP data: " + e.message; }
}

function simpleHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function canvasFingerprint() {
  try {
    const c = document.createElement("canvas"), x = c.getContext("2d");
    c.width = 200; c.height = 50;
    x.textBaseline = "top"; x.font = "14px Arial";
    x.fillStyle = "#f60"; x.fillRect(125, 1, 62, 20);
    x.fillStyle = "#069"; x.fillText("Gecko Gateway 🦎", 2, 15);
    x.fillStyle = "rgba(102,204,0,.7)"; x.fillText("Fingerprint", 4, 17);
    return c.toDataURL();
  } catch { return "Canvas Blocked"; }
}

function webglInfo() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return { vendor: "N/A", renderer: "N/A" };
    const d = gl.getExtension("WEBGL_debug_renderer_info");
    return { vendor: gl.getParameter(d ? d.UNMASKED_VENDOR_WEBGL : gl.VENDOR), renderer: gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
  } catch { return { vendor: "Blocked", renderer: "Blocked" }; }
}

function generateFingerprint() {
  const gl = webglInfo(), res = `${screen.width}x${screen.height} (${screen.colorDepth}-bit)`;
  const cores = navigator.hardwareConcurrency || "N/A", mem = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "N/A";
  const lang = navigator.language || "N/A", tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "N/A";
  const touch = navigator.maxTouchPoints > 0 ? `Yes (${navigator.maxTouchPoints} points)` : "No";
  const raw = [navigator.userAgent, res, cores, mem, lang, tz, gl.vendor, gl.renderer, canvasFingerprint()].join("|");
  fill($("fp-output"), [
    ["Fingerprint Hash:", "#" + simpleHash(raw).toUpperCase()], [""],
    ["GPU Vendor:", gl.vendor], ["GPU Renderer:", gl.renderer], ["Screen Size:", res], ["CPU Cores:", cores],
    ["Device RAM:", mem], ["Language:", lang], ["Timezone:", tz], ["Touch Screen:", touch],
    ["Cookies Enabled:", navigator.cookieEnabled ? "Enabled" : "Disabled"],
    ["Do Not Track:", navigator.doNotTrack || "Unspecified"], ["User Agent:", navigator.userAgent]
  ]);
}

// Passphrase words are generated procedurally from cryptographically random letters.
// There is intentionally no dictionary or precompiled word list.
const WORD_CONSONANTS = "bcdfghjklmnpqrstvwxyz";
const WORD_VOWELS = "aeiou";
const WORD_PATTERNS = ["CVC", "CVCC", "CVCV", "CVVC", "CCVC", "CVCVC", "CVCCV", "CVCVCV"];

function randomWord() {
  const pattern = WORD_PATTERNS[rand(WORD_PATTERNS.length)];
  let word = "";
  for (const type of pattern) {
    const pool = type === "C" ? WORD_CONSONANTS : WORD_VOWELS;
    word += pool[rand(pool.length)];
  }
  return word;
}
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?", WORD_SYMBOLS = "!@#$%^&*";
const LEET = { a: "4", e: "3", i: "1", o: "0", s: "5", t: "7" };

function syncPwdUI() {
  const pass = $("pwd-mode").value === "passphrase";
  document.querySelectorAll(".mode-char-option").forEach(e => e.hidden = pass);
  document.querySelectorAll(".mode-word-option").forEach(e => e.hidden = !pass);
  $("custom-sep-container").hidden = !(pass && $("pwd-separator").value === "custom");
  $("pwd-len-val").textContent = $("pwd-length").value;
  $("pwd-words-val").textContent = $("pwd-word-count").value;
}

function generatePassword() {
  syncPwdUI();
  const mode = $("pwd-mode").value, prefix = $("pwd-prefix").value, suffix = $("pwd-suffix").value, noSim = $("exc-similar").checked;
  let body = "", bits = 0;

  if (mode === "characters") {
    const len = +$("pwd-length").value, style = $("pwd-case-style").value, ex = $("pwd-custom-exclude").value;
    let up = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", lo = "abcdefghijklmnopqrstuvwxyz", nu = "0123456789";
    if (noSim) { up = up.replace(/[IO]/g, ""); lo = lo.replace("l", ""); nu = nu.replace(/[01]/g, ""); }
    const sets = [];
    [["inc-uppercase", up], ["inc-lowercase", lo], ["inc-numbers", nu], ["inc-symbols", SYMBOLS]].forEach(([id, s]) => {
      const a = [...s].filter(c => !ex.includes(c));
      if ($(id).checked && a.length) sets.push(a);
    });
    const extra = [...new Set([...$("pwd-custom-include").value].filter(c => !ex.includes(c)))];
    if (extra.length) sets.push(extra);
    const pool = [...new Set(sets.flat())];
    if (!pool.length) { $("pwd-result").textContent = "Select at least one character set!"; return; }

    const noAdj = $("no-repeat-adjacent").checked && pool.length > 1, out = Array(len).fill(null);
    if ($("enforce-all-sets").checked) {
      const pos = [...out.keys()];
      for (let i = pos.length - 1; i > 0; i--) { const j = rand(i + 1); [pos[i], pos[j]] = [pos[j], pos[i]]; }
      sets.slice(0, len).forEach((s, k) => { out[pos[k]] = s[rand(s.length)]; });
    }
    for (let i = 0; i < len; i++) {
      if (out[i] !== null) continue;
      let c, n = 0;
      do c = pool[rand(pool.length)]; while (noAdj && n++ < 50 && (c === out[i - 1] || c === out[i + 1]));
      out[i] = c;
    }
    const tr = (c, i) => style === "lowercase" ? c.toLowerCase() : style === "uppercase" ? c.toUpperCase()
      : style === "alternating" ? (i % 2 ? c.toUpperCase() : c.toLowerCase()) : style === "leetspeak" ? (LEET[c.toLowerCase()] || c) : c;
    body = out.map(tr).join("");
    bits = len * Math.log2(new Set(pool.map(c => tr(c, 0))).size);
  } else {
    const n = +$("pwd-word-count").value, wc = $("pwd-word-case").value, nm = $("pwd-word-numbers").value, sm = $("pwd-word-symbols").value;
    const sc = $("pwd-separator").value, sep = sc === "custom" ? $("pwd-custom-sep").value : sc;
    const cap = s => s[0].toUpperCase() + s.slice(1), parts = [];
    // Each word is independently generated from fresh crypto-random characters.
    // Entropy is estimated from the character choices rather than a dictionary size.
    const avgPatternEntropy = Math.log2(WORD_PATTERNS.length) +
      (WORD_PATTERNS.reduce((sum, p) => sum + [...p].filter(c => c === "C").length, 0) / WORD_PATTERNS.length) * Math.log2(WORD_CONSONANTS.length) +
      (WORD_PATTERNS.reduce((sum, p) => sum + [...p].filter(c => c === "V").length, 0) / WORD_PATTERNS.length) * Math.log2(WORD_VOWELS.length);
    bits = n * avgPatternEntropy;
    for (let i = 0; i < n; i++) {
      let w;
      do w = randomWord(); while (noSim && /[iol]/i.test(w));

      if (wc === "title") w = cap(w);
      else if (wc === "upper") w = w.toUpperCase();
      else if (wc === "alternating-words") w = i % 2 ? w.toUpperCase() : cap(w);
      else if (wc === "random-words") { if (rand(2)) w = w.toUpperCase(); bits += 1; }
      else if (wc === "random-letters") { w = [...w].map(c => rand(2) ? c.toUpperCase() : c).join(""); bits += w.length; }
      if (nm === "after-each-1") { w += rand(10); bits += Math.log2(10); }
      else if (nm === "after-each-2") { w += 10 + rand(90); bits += Math.log2(90); }
      if (sm === "symbol-after-each") { w += WORD_SYMBOLS[rand(WORD_SYMBOLS.length)]; bits += 3; }
      parts.push(w);
    }
    body = parts.join(sep);
    if (nm === "end-1") { body += sep + rand(10); bits += Math.log2(10); }
    else if (nm === "end-2") { body += sep + (10 + rand(90)); bits += Math.log2(90); }
    else if (nm === "end-4") { body += sep + (1000 + rand(9000)); bits += Math.log2(9000); }
    if (sm === "symbol-end") { body += WORD_SYMBOLS[rand(WORD_SYMBOLS.length)]; bits += 3; }
  }
  $("pwd-result").textContent = prefix + body + suffix;
  showStrength(Math.round(bits));
}

function showStrength(bits) {
  const [label, color] = bits < 40 ? ["Weak", "--red"] : bits < 65 ? ["Moderate", "--amber"] : bits < 90 ? ["Strong", "--blue"] : ["Very Strong 🛡️", "--green"];
  $("entropy-bits").textContent = `${bits} bits`;
  $("strength-text").textContent = label;
  const text = $("strength-text"), bar = $("strength-bar");
  text.className = `strength-${color.slice(2)}`;
  bar.className = "strength-bar-fill";
  bar.classList.add(`strength-${Math.min(100, Math.round(bits / 128 * 100 / 5) * 5)}`, `strength-${color.slice(2)}`);
}

async function copyPassword() {
  const text = $("pwd-result").textContent, btn = $("copy-btn");
  if (!text || text === "Click Generate below..." || text.startsWith("Select at least")) return;
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const t = document.createElement("textarea");
      t.value = text; t.className = "clipboard-copy-field";
      document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    btn.textContent = "Copied! ✓";
  } catch { btn.textContent = "Copy failed"; }
  setTimeout(() => btn.textContent = "Copy 📋", 1800);
}

let newsLoaded = false;
const HTTPS = /^https:\/\//;
const ago = t => { const m = Math.max(0, Math.round((Date.now() / 1000 - t) / 60)); return m < 60 ? m + "m ago" : m < 1440 ? Math.round(m / 60) + "h ago" : Math.round(m / 1440) + "d ago"; };
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "news.ycombinator.com"; } };
const hnItem = (id, title, url, pts, com, t) => ({
  title: String(title || "(untitled)"),
  url: HTTPS.test(url || "") ? url : `https://news.ycombinator.com/item?id=${encodeURIComponent(id)}`,
  meta: `${pts ?? 0} points · ${com ?? 0} comments · ${hostOf(url || "")} · ${ago(t)}`,
  discuss: `https://news.ycombinator.com/item?id=${encodeURIComponent(id)}`
});

const NEWS = {
  "hn-top": async () => {
    const ids = (await getJSON("https://hacker-news.firebaseio.com/v0/topstories.json")).slice(0, 20);
    const items = await Promise.all(ids.map(id => getJSON(`https://hacker-news.firebaseio.com/v0/item/${encodeURIComponent(id)}.json`).catch(() => null)));
    return items.filter(i => i && i.title).map(i => hnItem(i.id, i.title, i.url, i.score, i.descendants, i.time));
  },
  "hn-sec": async () => {
    const since = Math.floor(Date.now() / 1000) - 7 * 86400;
    const j = await getJSON("https://hn.algolia.com/api/v1/search?tags=story&query=security&hitsPerPage=20&numericFilters=" + encodeURIComponent("created_at_i>" + since));
    return (j.hits || []).filter(h => h.title).map(h => hnItem(h.objectID, h.title, h.url, h.points, h.num_comments, h.created_at_i));
  },
  "ghsa": async () => {
    const j = await getJSON("https://api.github.com/advisories?type=reviewed&per_page=20&sort=published&direction=desc", { headers: { Accept: "application/vnd.github+json" } });
    return j.map(a => ({ title: `[${String(a.severity || "unknown").toUpperCase()}] ${a.summary}`, url: a.html_url, meta: `${a.cve_id || a.ghsa_id} · ${ago(Date.parse(a.published_at) / 1000)}` }));
  }
};

async function loadNews() {
  const out = $("news-list"), btn = $("news-btn"), src = $("news-source").value;
  if (!NEWS[src]) return;
  newsLoaded = true;
  btn.disabled = true;
  out.textContent = "Loading headlines...";
  try {
    const items = await NEWS[src]();
    out.textContent = "";
    if (!items.length) { out.textContent = "Nothing found."; return; }
    for (const it of items) {
      if (HTTPS.test(it.url || "")) addLink(out, it.url, it.title); else out.append(it.title + "\n");
      out.append(it.meta + "\n");
      if (it.discuss) addLink(out, it.discuss, "💬 Discussion ↗");
      out.append("\n");
    }
  } catch (e) { out.textContent = "Could not load news: " + e.message; }
  finally { btn.disabled = false; }
}

const FILE_LIMIT = 256 * 1024 * 1024;

async function checkFile() {
  const out = $("file-output"), f = $("file-input").files[0];
  if (!f) return;
  if (f.size > FILE_LIMIT) { out.textContent = "File is too large to hash here (limit 256 MB)."; return; }
  if (!crypto.subtle) { out.textContent = "Hashing needs a secure (https) connection."; return; }
  out.textContent = "Calculating SHA-256...";
  try {
    const digest = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
    const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
    fill(out, [["File:", f.name], ["Size:", f.size.toLocaleString() + " bytes"], ["SHA-256:", hash], [""]]);
    addLink(out, `https://www.virustotal.com/gui/file/${hash}`, "🛡️ Open VirusTotal report ↗");
    addLink(out, `https://hybrid-analysis.com/sample/${hash}`, "🔬 Open Hybrid Analysis report ↗");
  } catch (e) { out.textContent = "Could not read file: " + e.message; }
}

document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => switchTab(b)));
$("dns-btn").addEventListener("click", lookupDNS);
$("reach-btn").addEventListener("click", checkReachability);
$("leak-btn").addEventListener("click", runLeakTest);
$("ip-btn").addEventListener("click", fetchIPDetails);
$("whois-btn").addEventListener("click", fetchWHOIS);
$("fp-btn").addEventListener("click", generateFingerprint);
$("gen-btn").addEventListener("click", generatePassword);
$("copy-btn").addEventListener("click", copyPassword);
$("pwd-panel").addEventListener("input", syncPwdUI);
$("domain-input").addEventListener("keydown", e => { if (e.key === "Enter") lookupDNS(); });
$("reach-input").addEventListener("keydown", e => { if (e.key === "Enter") checkReachability(); });
$("whois-input").addEventListener("keydown", e => { if (e.key === "Enter") fetchWHOIS(); });
$("news-btn").addEventListener("click", loadNews);
$("news-source").addEventListener("change", loadNews);
$("file-input").addEventListener("change", checkFile);
setAccent(document.querySelector(".tab-btn.active"));
syncPwdUI();
