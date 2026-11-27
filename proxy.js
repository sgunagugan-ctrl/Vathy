// Vathy: talks to your Worker (no keys for users), keeps the login token, and shows "My plan".
(function () {
  const WORKER = "https://vathy-proxy.sgunagugan.workers.dev";   // your Worker address (no slash at the end)
  if (WORKER.includes("YOUR-WORKER-URL")) return;                  // not set up yet: keep the key boxes as they are

  const SKEY = "vathy_session";
  const realFetch = window.fetch.bind(window);
  const session = () => { try { return localStorage.getItem(SKEY) || ""; } catch (e) { return ""; } };
  const post = (path, body) => realFetch(WORKER + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session() },
    body: typeof body === "string" ? body : JSON.stringify(body || {})
  });

  // Send the AI and search requests through the Worker
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const body = init && init.body;
    if (url.startsWith("https://api.groq.com/")) return post("/groq", body);
    if (url.startsWith("https://api.tavily.com/")) return post("/tavily", body);
    return realFetch(input, init);
  };

  // When someone signs in with Google, swap that sign-in for a Vathy login token
  const baseParse = parseJwt;
  parseJwt = function (t) { login(t); return baseParse(t); };
  async function login(credential) {
    try {
      const r = await realFetch(WORKER + "/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: credential }) });
      const d = await r.json();
      if (r.ok && d.session) { try { localStorage.setItem(SKEY, d.session); } catch (e) {} }
      else setStatus((d.error && d.error.message) || "Sign-in check failed.");
    } catch (e) { setStatus("Could not reach the Vathy server."); }
  }
  document.addEventListener("click", e => {
    if (e.target && e.target.closest && e.target.closest("#signout")) { try { localStorage.removeItem(SKEY); } catch (_) {} }
  }, true);

  // Hide the key boxes: the app thinks a key is present
  function hideKeyBoxes() {
    document.querySelectorAll("header input").forEach(b => { b.value = "server"; b.style.display = "none"; });
  }
  hideKeyBoxes();
  window.addEventListener("load", () => {
    hideKeyBoxes();
    setTimeout(() => { if (typeof user !== "undefined" && user && !session()) setStatus("Please sign out and sign in once more to finish setting up."); }, 1000);
  });
  setTimeout(hideKeyBoxes, 800);

  // ---------- My plan (menu item and screen) ----------
  const css = document.createElement("style");
  css.textContent = `
    #planPanel { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; overflow-y: auto; }
    #planPanel[hidden] { display: none; }
    #planPanel .ph { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--panel); font-weight: 600; }
    #planPanel .ph button { background: none; border: 0; color: var(--muted); font-size: 22px; cursor: pointer; padding: 0 6px; }
    #planPanel .pb { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    #planPanel .pcard { padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
    #planPanel .pbig { font-size: 22px; font-weight: 700; }
    #planPanel .pm { color: var(--muted); font-size: 14px; }
  `;
  document.head.append(css);
  const panel = document.createElement("div"); panel.id = "planPanel"; panel.hidden = true;
  const head = document.createElement("div"); head.className = "ph";
  const ttl = document.createElement("span"); ttl.textContent = "My plan";
  const close = document.createElement("button"); close.textContent = "\u2715"; close.setAttribute("aria-label", "Close");
  head.append(ttl, close);
  const pb = document.createElement("div"); pb.className = "pb";
  panel.append(head, pb);
  document.body.append(panel);
  close.addEventListener("click", () => { panel.hidden = true; });

  function card(big, lines) {
    const c = document.createElement("div"); c.className = "pcard";
    const b = document.createElement("div"); b.className = "pbig"; b.textContent = big; c.append(b);
    lines.forEach(t => { const p = document.createElement("div"); p.className = "pm"; p.textContent = t; c.append(p); });
    return c;
  }
  async function showPlan() {
    panel.hidden = false; pb.textContent = "Loading...";
    try {
      const r = await post("/me", {}), d = await r.json();
      if (!r.ok) { pb.textContent = (d.error && d.error.message) || "Could not load your plan."; return; }
      pb.textContent = "";
      const until = d.plan_until ? " until " + new Date(d.plan_until * 1000).toLocaleDateString() : "";
      pb.append(
        card(d.plan === "pro" ? "Pro" + until : "Free", [d.email]),
        card("AI requests today", [d.used.ai + " of " + d.limits.ai + " used"]),
        card("Web searches today", [d.used.search + " of " + d.limits.search + " used"]),
        card("Limits reset", ["Every day at midnight UTC."]),
        card("Pro plan", ["Longer code and answers, a stronger AI and higher daily limits. Coming soon."])
      );
    } catch (e) { pb.textContent = "Could not reach the Vathy server."; }
  }
  const menu = document.getElementById("menu");
  if (menu) {
    const b = document.createElement("button"); b.textContent = "My plan";
    b.addEventListener("click", () => { menu.hidden = true; showPlan(); });
    menu.append(b);
  }
})();
