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


function cleanURL(raw) {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(String(raw).trim()) ? String(raw).trim() : "https://" + String(raw).trim());
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
    if (u.username || u.password) throw new Error("URLs containing embedded credentials are not allowed.");
    return u;
  } catch (e) { throw new Error(e.message || "Enter a valid HTTP(S) URL."); }
}
function addToolLink(el, href, text, className) {
  const a=document.createElement("a"); a.href=href; a.target="_blank"; a.rel="noopener noreferrer"; a.className=className||"action-btn tool-link"; a.textContent=text; el.append(a); return a;
}
function runWebsiteAudit() {
  const out=$("audit-output");
  try {
    const u=cleanURL($("audit-input").value), host=u.hostname;
    out.textContent="";
    const summary=document.createElement("div"); summary.className="audit-summary"; summary.textContent="Prepared checks for "+u.href+" — open each scanner in a new tab."; out.append(summary);
    const grid=document.createElement("div"); grid.className="tool-grid audit-links";
    addToolLink(grid,"https://www.ssllabs.com/ssltest/analyze.html?d="+encodeURIComponent(host),"🔐 SSL Labs TLS");
    addToolLink(grid,"https://securityheaders.com/?q="+encodeURIComponent(u.href)+"&followRedirects=on","🧱 SecurityHeaders.com");
    addToolLink(grid,"https://developer.mozilla.org/en-US/observatory/analyze?host="+encodeURIComponent(host),"🦊 MDN HTTP Observatory");
    addToolLink(grid,"https://internet.nl/site/"+encodeURIComponent(host)+"/","🌐 Internet.nl");
    addToolLink(grid,"https://sitecheck.sucuri.net/results/"+encodeURIComponent(host),"🛡️ Sucuri SiteCheck");
    addToolLink(grid,"https://www.hardenize.com/report/"+encodeURIComponent(host),"🔎 Hardenize","secondary-btn tool-link");
    out.append(grid);
    const note=document.createElement("p"); note.className="help-text small-note"; note.textContent="These remote checks see only what the public service can observe; they do not prove application code, authentication, database, or business-logic security."; out.append(note);
  } catch(e){out.textContent=e.message;}
}
async function queryDoH(name,type){
  return getJSON("https://cloudflare-dns.com/dns-query?name="+encodeURIComponent(name)+"&type="+encodeURIComponent(type)+"&do=true",{headers:{Accept:"application/dns-json"},cache:"no-store"});
}
function answerData(j,type){return (j.Answer||[]).filter(r=>RR[r.type]===type||String(r.type)===type).map(r=>String(r.data||""));}
async function runDomainSuite(){
  const out=$("domain-suite-output"), d=cleanDomain($("domain-suite-input").value), selector=$("dkim-selector").value.trim();
  if(!d){out.textContent="Enter a valid domain name, e.g. example.com";return;}
  if(selector&&!/^[a-z0-9._-]{1,63}$/i.test(selector)){out.textContent="DKIM selector contains unsupported characters.";return;}
  out.textContent="Querying DNS, DNSSEC and email-security records...";
  const names=[["A",d,"A"],["AAAA",d,"AAAA"],["MX",d,"MX"],["NS",d,"NS"],["TXT",d,"TXT"],["CAA",d,"CAA"],["DS",d,"DS"],["DNSKEY",d,"DNSKEY"],["DMARC","_dmarc."+d,"TXT"]];
  if(selector)names.push(["DKIM",selector+"._domainkey."+d,"TXT"]);
  try{
    const results=await Promise.all(names.map(async x=>[x[0],await queryDoH(x[1],x[2]).catch(e=>({error:e.message}))]));
    const by=Object.fromEntries(results), txt=answerData(by.TXT,"TXT"), dmarc=answerData(by.DMARC,"TXT");
    const spf=txt.filter(x=>/^"?v=spf1\b/i.test(x)), dmarcRecord=dmarc.find(x=>/^"?v=dmarc1\b/i.test(x));
    const dkim=selector?answerData(by.DKIM,"TXT"):[], mx=answerData(by.MX,"MX");
    fill(out,[["Domain:",d],["DNSSEC validated:",by.DNSKEY?.AD||by.DS?.AD?"Yes — resolver authenticated the response":"Not authenticated in this response"],["DNSSEC records:","DS "+answerData(by.DS,"DS").length+" · DNSKEY "+answerData(by.DNSKEY,"DNSKEY").length],["A records:",answerData(by.A,"A").join(", ")||"None"],["AAAA records:",answerData(by.AAAA,"AAAA").join(", ")||"None"],["Nameservers:",answerData(by.NS,"NS").join(", ")||"None"],["MX records:",mx.join(" | ")||"None"],[""],["SPF:",spf.length?spf.join(" | "):"Not found"],["DMARC:",dmarcRecord||"Not found"],["DKIM:",selector?(dkim.length?dkim.join(" | "):"No TXT record found for selector"):"Selector not supplied — cannot reliably test DKIM"],["CAA records:",answerData(by.CAA,"CAA").join(" | ")||"None"],[""],["Tip:","A published SPF/DMARC record is not the same as a fully secure mail configuration. Review policy strength, alignment, DKIM signing, TLS and provider settings."]]);
  }catch(e){out.textContent="Error checking domain: "+e.message;}
}
async function runBrowserPrivacy(){
  const out=$("privacy-output");
  const storage=(()=>{try{return!!window.localStorage;}catch{return false;}})(), session=(()=>{try{return!!window.sessionStorage;}catch{return false;}})();
  let geo="Unavailable"; try{if(navigator.permissions?.query)geo=(await navigator.permissions.query({name:"geolocation"})).state;}catch{}
  const gl=webglInfo();
  fill(out,[["User Agent:",navigator.userAgent],["Do Not Track:",navigator.doNotTrack||"Unspecified"],["Global Privacy Control:",navigator.globalPrivacyControl===true?"Enabled":"Not enabled / unavailable"],["Cookies Enabled:",navigator.cookieEnabled?"Yes":"No"],["WebDriver:",navigator.webdriver?"Detected":"Not reported"],["Local Storage API:",storage?"Available":"Blocked/unavailable"],["Session Storage API:",session?"Available":"Blocked/unavailable"],["Geolocation Permission:",geo],["JavaScript:","Enabled (this tool requires it)"],["Screen:",screen.width+"×"+screen.height+" · "+screen.colorDepth+"-bit · DPR "+(window.devicePixelRatio||1)],["CPU Cores:",navigator.hardwareConcurrency||"N/A"],["Device Memory:",navigator.deviceMemory?navigator.deviceMemory+" GB":"N/A"],["Language:",navigator.language||"N/A"],["Timezone:",Intl.DateTimeFormat().resolvedOptions().timeZone||"N/A"],["Touch:",navigator.maxTouchPoints?"Yes ("+navigator.maxTouchPoints+")":"No"],["WebGL:",gl.vendor==="N/A"?"Unavailable":gl.vendor+" · "+gl.renderer],[""],["Privacy note:","These signals are shown locally. A website can combine many of them into a browser fingerprint."]]);
}
async function runWebRTCCheck(){
  const out=$("webrtc-output");
  if(!window.RTCPeerConnection){out.textContent="WebRTC is not exposed by this browser.";return;}
  out.textContent="Checking local WebRTC support...";
  const pc=new RTCPeerConnection({iceServers:[]}), candidates=[];
  try{
    pc.onicecandidate=e=>{if(e.candidate)candidates.push(e.candidate.candidate);};
    const offer=await pc.createOffer({offerToReceiveAudio:false,offerToReceiveVideo:false}); await pc.setLocalDescription(offer); await sleep(1200);
    const types=[...new Set(candidates.map(c=>{const m=c.match(/\btyp\s+(\w+)/);return m?m[1]:"unknown";}))];
    fill(out,[["RTCPeerConnection:","Available"],["RTCDataChannel:","Available"],["Candidate types seen:",types.length?types.join(", "):"None exposed"],["Candidates collected:",candidates.length],[""],["Interpretation:","This local check does not contact an external STUN server, so it is not a full public-IP leak test. Modern browsers may also mask host addresses with mDNS."]]);
  }catch(e){out.textContent="WebRTC check failed: "+e.message;} finally{pc.close();}
}
function inspectURL(){
  const out=$("url-inspect-output"), vt=$("url-vt-link"), us=$("urlscan-link"); let u;
  try{u=cleanURL($("url-inspect-input").value);}catch(e){out.textContent=e.message;return;}
  const host=u.hostname, labels=host.split(".").filter(Boolean), flags=[], notes=[];
  if(u.protocol!=="https:")flags.push("URL is not HTTPS.");
  if(/^\d+(?:\.\d+){3}$/.test(host))flags.push("Host is an IPv4 address.");
  if(host.includes("xn--")||/[^\x00-\x7F]/.test(host))flags.push("Internationalized/punycode hostname detected.");
  if(u.port&&!["80","443"].includes(u.port))flags.push("Non-standard port: "+u.port);
  if(labels.length>=5)flags.push("Many hostname labels/subdomains.");
  if(host.length>50)flags.push("Unusually long hostname.");
  if(u.href.length>200)flags.push("Long URL (over 200 characters).");
  if(u.search.length>150)flags.push("Long query string.");
  if(u.pathname.length>100)flags.push("Long path.");
  if(u.searchParams.has("redirect")||u.searchParams.has("url")||u.searchParams.has("next")||u.searchParams.has("continue")||u.searchParams.has("return"))flags.push("Redirect-style parameter present.");
  if(u.hash)notes.push("Fragment present (#...); it is normally not sent to the server.");
  if(u.href.includes("%"))notes.push("Percent-encoded characters are present; inspect decoded-looking text carefully.");
  if(labels.some(x=>x.length>30))notes.push("At least one hostname label is unusually long.");
  fill(out,[["Local verdict:",flags.length?"Structural indicators deserve a closer look.":"No obvious structural red flags found."],["Hostname:",host],["Protocol:",u.protocol.replace(":","").toUpperCase()],["Port:",u.port||(u.protocol==="https:"?"443":"80")],["Subdomains:",Math.max(0,labels.length-2)],["Path:",u.pathname||"/"],["Query parameters:",[...u.searchParams.keys()].length],["Credentials:",u.username||u.password?"Yes":"No"],["Flags:",flags.length?flags.join(" · "):"None"],["Notes:",notes.length?notes.join(" · "):"None"],[""],["Important:","This is a local structure check, not a malware verdict. Do not treat a clean result as proof that a URL is safe."]]);
  const b64=btoa(unescape(encodeURIComponent(u.href))).replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
  vt.href="https://www.virustotal.com/gui/url/"+b64; us.href="https://urlscan.io/search/#domain:"+encodeURIComponent(host);
}

const RR = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 15: "MX", 16: "TXT", 28: "AAAA", 43: "DS", 33: "SRV", 257: "CAA", 48: "DNSKEY", 65: "HTTPS" };

async function lookupDNS() {
  const out = $("dns-output"), d = cleanDomain($("domain-input").value), t = $("record-type").value;
  if (!d) { out.textContent = "Enter a valid domain name, e.g. example.com"; return; }
  out.textContent = `Fetching ${t} record for ${d}...`;
  try {
    const j = await getJSON(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(d)}&type=${encodeURIComponent(t)}&do=true`,
      { headers: { Accept: "application/dns-json" }, cache: "no-store" });
    if (!j.Answer?.length) {
      out.textContent = `No ${t} records found for ${d}.\n\nResolver status: ${j.Status === 0 ? "NOERROR" : "DNS status " + j.Status}\nDNSSEC authenticated: ${j.AD ? "Yes — validated" : "No — not validated in this response"}`;
      return;
    }
    const header = [
      `Results for ${d} (${t})`,
      `Resolver status: ${j.Status === 0 ? "NOERROR" : "DNS status " + j.Status}`,
      `DNSSEC authenticated: ${j.AD ? "Yes" : "No / not indicated"}`,
      `Answers: ${j.Answer.length}`,
      j.TC ? "⚠ Response was truncated." : "",
      ""
    ].filter(Boolean).join("\n");
    out.textContent = header + j.Answer.map(r =>
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
    for (let i = 1; i <= 10; i++) { await ping(`https://${i}.${id}.bash.ws/`, 7000); }
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
}function validIPAddress(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  if (v.includes(":")) {
    try { new URL("http://[" + v + "]"); return true; } catch { return false; }
  }
  const parts = v.split(".");
  return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

async function fetchIPDetailsFor(ip, manualLookup) {
  const out = $("ip-output"), box = $("ip-map-container"), map = $("ip-map"), intel = $("ip-intel-links");
  out.textContent = "Looking up IP information...";
  box.classList.remove("visible");
  intel.hidden = true;

  try {
    let target = ip;
    if (!target) {
      const own = await getJSON("https://api64.ipify.org?format=json", { cache: "no-store" });
      target = own.ip;
    }
    if (!validIPAddress(target)) throw new Error("The service returned an invalid IP address.");

    let rdap = null;
    try {
      rdap = await getJSON("https://rdap.org/ip/" + encodeURIComponent(target), { headers: { Accept: "application/rdap+json" }, cache: "no-store" }, 12000);
    } catch (_) {}

    // Geolocation is best-effort. A CORS/rate-limit failure must not break the IP tool.
    let geo = null;
    const geoSources = [
      async () => {
        const data = await getJSON("https://ipapi.co/" + encodeURIComponent(target) + "/json/", { cache: "no-store" }, 8000);
        return data?.error ? null : data;
      },
      async () => {
        const data = await getJSON("https://ipwho.is/" + encodeURIComponent(target), { cache: "no-store" }, 8000);
        if (!data?.success) return null;
        return {
          ip: data.ip,
          city: data.city,
          region: data.region,
          country_name: data.country,
          country_code: data.country_code,
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone?.id || data.timezone,
          asn: data.connection?.asn ? "AS" + data.connection.asn : "",
          org: data.connection?.org || data.connection?.isp || "",
          hostname: data.hostname || ""
        };
      }
    ];
    for (const source of geoSources) {
      try {
        geo = await source();
        if (geo) break;
      } catch (_) {}
    }

    const org = geo?.org || rdap?.name || "N/A";
    const asn = geo?.asn || "N/A";
    const city = geo?.city || "N/A";
    const region = geo?.region || "N/A";
    const country = geo?.country_name || "N/A";
    const cc = geo?.country_code || "N/A";
    const timezone = geo?.timezone || "N/A";
    const hostname = geo?.hostname || "N/A";
    const lat = Number(geo?.latitude), lon = Number(geo?.longitude);
    const ok = Number.isFinite(lat) && Number.isFinite(lon);

    fill(out, [
      [manualLookup ? "IP Address:" : "Your Public WAN IP:", target],
      ["Network / ASN:", asn + (org !== "N/A" ? " - " + org : "")],
      ["Organization:", org],
      ["Reverse DNS / Hostname:", hostname],
      [""],
      ["--- GEO LOCATION DETAILS ---"],
      ["City / Region:", city + ", " + region],
      ["Country:", country + " (" + cc + ")"],
      ["Timezone:", timezone],
      ["Coordinates:", ok ? lat + ", " + lon : "Unavailable"],
      ["RDAP Network:", rdap?.handle || rdap?.name || "Available via RDAP"],
      [""],
      ["Note:", geo ? "Geolocation data loaded." : "Geolocation service was unavailable; core IP/RDAP lookup still completed."]
    ]);

    if (ok) {
      const o = 0.04;
      map.src = "https://www.openstreetmap.org/export/embed.html?bbox=" +
        encodeURIComponent((lon-o)+","+(lat-o)+","+(lon+o)+","+(lat+o)) +
        "&layer=mapnik&marker=" + encodeURIComponent(lat+","+lon);
      box.classList.add("visible");
      addLink(out, "https://www.google.com/maps?q="+lat+","+lon, "View in Google Maps ↗");
    }

    if (manualLookup) {
      intel.hidden = false;
      $("ip-arin-link").href = "https://search.arin.net/rdap/?query=" + encodeURIComponent(target);
      $("ip-abuse-link").href = "https://www.abuseipdb.com/check/" + encodeURIComponent(target);
    }

    out.append("\n");
    const s = document.createElement("span");
    s.className = "highlight";
    s.textContent = manualLookup
      ? "Lookup complete. Reputation tools are available below for this IP."
      : "Detected from your current public connection. Reputation tools are intentionally hidden for your own IP.";
    out.append(s);
  } catch (e) {
    out.textContent = "IP lookup failed: " + e.message;
  }
}
async function lookupIPAddress() {
  const input = $("ip-lookup-input"), ip = input.value.trim();
  if (!validIPAddress(ip)) {
    $("ip-output").textContent = "Enter a valid IPv4 or IPv6 address.";
    return;
  }
  await fetchIPDetailsFor(ip, true);
}

async function checkMyIP() {
  await fetchIPDetailsFor("", false);
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
      ["RDAP Status(es):", st.length ? "" : "N/A"], ...st.map(s => ["• " + s]),
      ["Domain Handle:", j.handle || "N/A"],
      ["DNSSEC Delegation:", j.secureDNS?.delegationSigned ? "Signed" : "Not indicated / unsigned"],
      ["Events Found:", Array.isArray(j.events) ? j.events.length : 0]
    ]);
  } catch (e) { out.textContent = "Error querying RDAP data: " + e.message; }
}

function analyzePhishingURL() {
  const out = $("phish-output");
  let u;
  try {
    const raw = $("phish-input").value.trim();
    if (!raw) throw new Error("Enter a URL.");
    u = new URL(/^[a-z][a-z0-9+.-]:\/\//i.test(raw) ? raw : "https://" + raw);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  } catch (e) {
    out.textContent = e.message;
    return;
  }

  const host = u.hostname;
  const labels = host.split(".").filter(Boolean);
  const flags = [];
  const observations = [];

  if (u.protocol !== "https:") flags.push("Connection is not HTTPS.");
  if (u.username || u.password) flags.push("Embedded username/password detected.");
  if (/^\d+(?:\.\d+){3}$/.test(host)) flags.push("The host is an IPv4 address instead of a normal domain.");
  if (host.startsWith("xn--") || host.includes(".xn--") || /[^\x00-\x7F]/.test(u.hostname)) flags.push("Internationalized/punycode hostname detected; inspect the displayed domain carefully.");
  if (u.port && !["80", "443"].includes(u.port)) flags.push("Non-standard port: " + u.port);
  if (labels.length >= 5) flags.push("The hostname contains many subdomain levels.");
  if (u.hostname.length > 50) flags.push("The hostname is unusually long.");
  if (u.pathname.length > 100) flags.push("The URL path is unusually long.");
  if (u.search.length > 150) flags.push("The query string is unusually long.");
  if (u.hash) observations.push("A fragment (#...) is present; it is not normally sent to the server.");
  if (u.searchParams.has("redirect") || u.searchParams.has("url") || u.searchParams.has("next") || u.searchParams.has("continue")) {
    flags.push("A redirect-style parameter is present.");
  }

  observations.push("Hostname: " + host);
  observations.push("Protocol: " + u.protocol.replace(":", "").toUpperCase());
  observations.push("Subdomains: " + Math.max(0, labels.length - 2));
  observations.push("Path: " + (u.pathname || "/"));
  observations.push("Query parameters: " + [...u.searchParams.keys()].length);
  observations.push("Credentials in URL: " + (u.username || u.password ? "Yes" : "No"));

  const verdict = flags.length === 0 ? "No obvious structural red flags found." :
    flags.length <= 2 ? "Some structural indicators deserve a closer look." :
    "Multiple structural indicators deserve a closer look.";

  fill(out, [
    ["Local triage:", verdict],
    [""],
    ["Indicators:", flags.length ? "" : "None detected"],
    ...flags.map(x => ["• " + x]),
    [""],
    ["URL details:", ""],
    ...observations.map(x => ["• " + x]),
    [""],
    ["Important:", "This is a heuristic URL-structure check. It does not determine whether a site is malicious or safe. Use an external reputation scanner for a second opinion."]
  ]);
}

async function copyPhishingURL() {
  const value = $("phish-input").value.trim();
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    $("phish-copy-btn").textContent = "Copied ✓";
    setTimeout(() => $("phish-copy-btn").textContent = "Copy URL", 1500);
  } catch {
    $("phish-copy-btn").textContent = "Copy failed";
    setTimeout(() => $("phish-copy-btn").textContent = "Copy URL", 1500);
  }
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
  const lang = navigator.language || "N/A", languages = Array.isArray(navigator.languages) ? navigator.languages.join(", ") : lang, tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "N/A";
  const touch = navigator.maxTouchPoints > 0 ? `Yes (${navigator.maxTouchPoints} points)` : "No";
  const raw = [navigator.userAgent, res, cores, mem, lang, tz, gl.vendor, gl.renderer, canvasFingerprint()].join("|");
  fill($("fp-output"), [
    ["Fingerprint Hash:", "#" + simpleHash(raw).toUpperCase()], [""],
    ["GPU Vendor:", gl.vendor], ["GPU Renderer:", gl.renderer], ["Screen Size:", res], ["Viewport:", window.innerWidth + "x" + window.innerHeight], ["Pixel Ratio:", window.devicePixelRatio || 1], ["CPU Cores:", cores],
    ["Device RAM:", mem], ["Platform:", navigator.platform || "N/A"], ["Language:", lang], ["Languages:", languages], ["Timezone:", tz], ["Timezone Offset:", new Date().getTimezoneOffset() + " minutes"], ["Touch Screen:", touch], ["Online:", navigator.onLine ? "Yes" : "No"],
    ["Cookies Enabled:", navigator.cookieEnabled ? "Enabled" : "Disabled"],
    ["Do Not Track:", navigator.doNotTrack || "Unspecified"], ["Global Privacy Control:", navigator.globalPrivacyControl === true ? "Enabled" : "Not enabled / unavailable"], ["WebGL:", gl.vendor === "N/A" ? "Unavailable" : "Available"], ["WebGPU:", "gpu" in navigator ? "Available" : "Unavailable"], ["User Agent:", navigator.userAgent], [""], ["Privacy note:", "Calculated locally in your browser. These signals are not uploaded or stored by Gecko Gateway."]
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
  },
  "malwaretips": async () => rssItems("https://malwaretips.com/blogs/feed", "MalwareTips"),
  "bleeping": async () => rssItems("https://www.bleepingcomputer.com/feed/", "BleepingComputer"),
  "securityweek": async () => rssItems("https://feeds.feedburner.com/securityweek", "SecurityWeek"),
  "therecord": async () => rssItems("https://therecord.media/feed", "The Record"),
  "cisa": async () => rssItems("https://www.cisa.gov/cybersecurity-advisories/all.xml", "CISA"),
  "krebs": async () => rssItems("https://krebsonsecurity.com/feed/", "Krebs on Security"),
  "darkreading": async () => rssItems("https://www.darkreading.com/rss.xml", "Dark Reading"),
  "theregister": async () => rssItems("https://www.theregister.com/security/headlines.atom", "The Register Security"),
  "infosecurity": async () => rssItems("https://www.infosecurity-magazine.com/rss/news/", "Infosecurity Magazine"),
  "malwarebytes": async () => rssItems("https://www.malwarebytes.com/blog/feed/index.xml", "Malwarebytes Labs"),
  "sophos": async () => rssItems("https://news.sophos.com/en-us/category/security-operations/feed/", "Sophos"),
  "securelist": async () => rssItems("https://securelist.com/feed/", "Securelist")
};

async function rssItems(url, source) {
  const api = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(url);
  try {
    const data = await getJSON(api, { cache: "no-store" }, 12000);
    if (data.status && data.status !== "ok") throw new Error(data.message || "Feed conversion failed.");
    const items = Array.isArray(data.items) ? data.items : [];
    const parsed = items.slice(0, 15).map(item => ({
      title: String(item.title || "Untitled").trim(),
      url: String(item.link || item.guid || "").trim(),
      meta: source + " · " + (item.pubDate ? new Date(item.pubDate).toLocaleString() : "recent")
    })).filter(i => HTTPS.test(i.url));
    if (parsed.length) return parsed;
    throw new Error("No readable headlines were returned.");
  } catch (firstError) {
    throw firstError;
  }
}

async function loadNews() {
  const out = $("news-list"), btn = $("news-btn"), src = $("news-source").value;
  if (!NEWS[src]) return;
  newsLoaded = true;
  btn.disabled = true;
  out.textContent = "Loading headlines...";
  try {
    const items = (await NEWS[src]()).slice(0, 12);
    out.textContent = "";
    if (!items.length) {
      out.textContent = "Nothing found.";
      return;
    }

    for (const it of items) {
      const row = document.createElement("article");
      row.className = "news-item";

      if (HTTPS.test(it.url || "")) {
        const title = document.createElement("a");
        title.href = it.url;
        title.target = "_blank";
        title.rel = "noopener noreferrer";
        title.className = "news-title";
        title.textContent = it.title;
        row.append(title);
      } else {
        const title = document.createElement("div");
        title.className = "news-title";
        title.textContent = it.title;
        row.append(title);
      }

      const meta = document.createElement("div");
      meta.className = "news-meta";
      meta.textContent = it.meta || "";
      row.append(meta);

      if (it.discuss) {
        const discuss = document.createElement("a");
        discuss.href = it.discuss;
        discuss.target = "_blank";
        discuss.rel = "noopener noreferrer";
        discuss.className = "news-discuss";
        discuss.textContent = "Discussion ↗";
        row.append(discuss);
      }

      out.append(row);
    }
  } catch (e) {
    out.innerHTML = "";
    const err = document.createElement("div");
    err.className = "news-error";
    err.textContent = "Could not load news: " + e.message;
    out.append(err);
  } finally {
    btn.disabled = false;
  }
}

const FILE_LIMIT = 256 * 1024 * 1024;

async function checkFile() {
  const out=$("file-output"), f=$("file-input").files[0]; if(!f)return;
  if(f.size>FILE_LIMIT){out.textContent="File is too large to hash here (limit 256 MB).";return;}
  if(!crypto.subtle){out.textContent="Hashing needs a secure (https) connection.";return;}
  out.textContent="Reading file and calculating hashes...";
  try{
    const buf=await f.arrayBuffer(), bytes=new Uint8Array(buf);
    const [d256,d512]=await Promise.all([crypto.subtle.digest("SHA-256",buf),crypto.subtle.digest("SHA-512",buf)]);
    const hex=a=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,"0")).join("");
    const freq=new Uint32Array(256); for(const b of bytes)freq[b]++;
    let entropy=0; for(const n of freq)if(n){const p=n/bytes.length;entropy-=p*Math.log2(p);}
    const h256=hex(d256), h512=hex(d512), ext=(f.name.match(/\.([^.]+)$/)?.[1]||"").toLowerCase()||"none";
    fill(out,[["File:",f.name],["Extension:",ext],["MIME Type:",f.type||"Unknown"],["Size:",f.size.toLocaleString()+" bytes"],["Last Modified:",new Date(f.lastModified).toLocaleString()],["SHA-256:",h256],["SHA-512:",h512],["Byte Entropy:",entropy.toFixed(3)+" bits/byte"],[""],["Interpretation:","Higher byte entropy can be seen in compressed/encrypted data, but entropy alone does not identify malware."]]);
    addLink(out,"https://www.virustotal.com/gui/file/"+h256,"🛡️ Open VirusTotal report ↗");
    addLink(out,"https://hybrid-analysis.com/sample/"+h256,"🔬 Open Hybrid Analysis report ↗");
  }catch(e){out.textContent="Could not read file: "+e.message;}
}

document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => switchTab(b)));
$("audit-btn").addEventListener("click",runWebsiteAudit);
$("domain-suite-btn").addEventListener("click",runDomainSuite);
$("privacy-btn").addEventListener("click",runBrowserPrivacy);
$("webrtc-btn").addEventListener("click",runWebRTCCheck);
$("url-inspect-btn").addEventListener("click",inspectURL);
$("phish-analyze-btn").addEventListener("click", analyzePhishingURL);
$("phish-copy-btn").addEventListener("click", copyPhishingURL);
$("phish-input").addEventListener("keydown", e => { if (e.key === "Enter") analyzePhishingURL(); });

$("audit-input").addEventListener("keydown",e=>{if(e.key==="Enter")runWebsiteAudit();});
$("domain-suite-input").addEventListener("keydown",e=>{if(e.key==="Enter")runDomainSuite();});
$("url-inspect-input").addEventListener("keydown",e=>{if(e.key==="Enter")inspectURL();});

$("dns-btn").addEventListener("click", lookupDNS);
$("reach-btn").addEventListener("click", checkReachability);
$("leak-btn").addEventListener("click", runLeakTest);
$("ip-lookup-btn").addEventListener("click", lookupIPAddress);
$("my-ip-btn").addEventListener("click", checkMyIP);
$("whois-btn").addEventListener("click", fetchWHOIS);
$("fp-btn").addEventListener("click", generateFingerprint);
$("gen-btn").addEventListener("click", generatePassword);
$("copy-btn").addEventListener("click", copyPassword);
$("pwd-panel").addEventListener("input", syncPwdUI);
$("domain-input").addEventListener("keydown", e => { if (e.key === "Enter") lookupDNS(); });
$("reach-input").addEventListener("keydown", e => { if (e.key === "Enter") checkReachability(); });
$("ip-lookup-input").addEventListener("keydown", e => { if (e.key === "Enter") lookupIPAddress(); });
$("whois-input").addEventListener("keydown", e => { if (e.key === "Enter") fetchWHOIS(); });
$("news-btn").addEventListener("click", loadNews);
$("news-source").addEventListener("change", loadNews);
$("file-input").addEventListener("change", checkFile);
setAccent(document.querySelector(".tab-btn.active"));
syncPwdUI();
