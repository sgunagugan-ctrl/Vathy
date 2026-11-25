// Vathy add-on: Voice settings (speed, pitch, voice) and shortcuts (Maps, YouTube, WhatsApp).
(function () {
  const ls = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const lset = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const num = (k, d) => { const n = parseFloat(ls(k)); return n > 0 ? n : d; };
  const norm = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const langOf = l => String(l || "").replace("_", "-").toLowerCase();

  // ---------- Voice settings: speed, pitch and voice are applied to every spoken reply ----------
  const origSpeak = SpeechSynthesis.prototype.speak;
  speechSynthesis.speak = function (u) {
    try {
      u.rate = num("vathy_rate", 1); u.pitch = num("vathy_pitch", 1);
      const uri = ls("vathy_voice_" + u.lang);
      if (uri) { const v = speechSynthesis.getVoices().find(x => x.voiceURI === uri); if (v) u.voice = v; }
    } catch (e) {}
    return origSpeak.call(speechSynthesis, u);
  };

  // ---------- Styles ----------
  const css = document.createElement("style");
  css.textContent = `
    .vpanel { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; overflow-y: auto; }
    .vpanel[hidden] { display: none; }
    .vpanel .chead { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--panel); font-weight: 600; }
    .vpanel .chead button { background: none; border: 0; color: var(--muted); font-size: 22px; cursor: pointer; padding: 0 6px; }
    .vbody { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .vrow { display: flex; flex-direction: column; gap: 6px; }
    .vrow label { display: flex; justify-content: space-between; font-weight: 600; }
    .vrow input[type=range] { width: 100%; accent-color: var(--accent); }
    .vrow select, .vrow input[type=tel] { width: 100%; }
    .vnote { color: var(--muted); font-size: 14px; margin: 0; }
    .vmrow { display: flex; align-items: center; gap: 14px; }
    .vsw { position: relative; flex: 0 0 auto; width: 76px; height: 40px; border-radius: 20px; border: 0; cursor: pointer; transition: background .2s; }
    .vsw.on { background: #22c55e; }
    .vsw.off { background: #ef4444; }
    .vsw::after { content: ""; position: absolute; top: 4px; left: 4px; width: 32px; height: 32px; border-radius: 50%; background: #fff; transition: transform .2s; }
    .vsw.on::after { transform: translateX(36px); }
    .vmstate { font-weight: 700; font-size: 18px; }
    .vmstate.on { color: #22c55e; }
    .vmstate.off { color: #ef4444; }
    body.voicemode #composer { display: none !important; }
    @media (prefers-reduced-motion: reduce) { .vsw, .vsw::after { transition: none; } }
    .vbtns { display: flex; gap: 8px; }
    .vbtns button { flex: 1; border: 0; border-radius: 10px; background: var(--accent); color: #fff; font: inherit; padding: 10px 14px; cursor: pointer; }
    .vbtns button.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
  `;
  document.head.append(css);

  // ---------- Voice settings screen ----------
  const panel = document.createElement("div"); panel.id = "vPanel"; panel.className = "vpanel"; panel.hidden = true;
  const head = document.createElement("div"); head.className = "chead";
  const ttl = document.createElement("span"); ttl.textContent = "Voice settings";
  const close = document.createElement("button"); close.textContent = "\u2715"; close.setAttribute("aria-label", "Close");
  head.append(ttl, close);
  const body = document.createElement("div"); body.className = "vbody";

  function slider(label, key, min, max, step) {
    const row = document.createElement("div"); row.className = "vrow";
    const lab = document.createElement("label"); const name = document.createElement("span"); name.textContent = label;
    const val = document.createElement("span");
    lab.append(name, val);
    const r = document.createElement("input"); r.type = "range"; r.min = min; r.max = max; r.step = step;
    const sync = () => { r.value = num(key, 1); val.textContent = Number(r.value).toFixed(2) + "x"; };
    r.addEventListener("input", () => { lset(key, r.value); val.textContent = Number(r.value).toFixed(2) + "x"; });
    row.append(lab, r);
    return { row: row, sync: sync };
  }
  const speed = slider("Speaking speed", "vathy_rate", 0.5, 1.5, 0.05);
  const pitch = slider("Voice pitch", "vathy_pitch", 0.5, 1.5, 0.05);

  const vRow = document.createElement("div"); vRow.className = "vrow";
  const vLab = document.createElement("label"); const vName = document.createElement("span"); vName.textContent = "Voice";
  vLab.append(vName);
  const vFor = document.createElement("p"); vFor.className = "vnote";
  const vSel = document.createElement("select");
  const vNote = document.createElement("p"); vNote.className = "vnote";
  vRow.append(vLab, vFor, vSel, vNote);

  const cRow = document.createElement("div"); cRow.className = "vrow";
  const cLab = document.createElement("label"); const cName = document.createElement("span"); cName.textContent = "WhatsApp country code";
  cLab.append(cName);
  const cIn = document.createElement("input"); cIn.type = "tel"; cIn.placeholder = "digits only, e.g. 91"; cIn.autocomplete = "off";
  const cNote = document.createElement("p"); cNote.className = "vnote";
  cNote.textContent = "Used for saved numbers that have no country code. Numbers saved with a + already work.";
  cIn.addEventListener("input", () => lset("vathy_cc", cIn.value.replace(/\D/g, "")));
  cRow.append(cLab, cIn, cNote);

  const btns = document.createElement("div"); btns.className = "vbtns";
  const test = document.createElement("button"); test.textContent = "Test voice";
  const reset = document.createElement("button"); reset.className = "ghost"; reset.textContent = "Reset";
  btns.append(test, reset);
  body.append(speed.row, pitch.row, vRow, cRow, btns);
  panel.append(head, body);
  document.body.append(panel);

  const TESTS = { en: "Hello, I am Vathy.", ta: "\u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD", tl: "Vanakkam, naan Vathy.", hi: "\u0928\u092E\u0938\u094D\u0924\u0947",
    te: "\u0C28\u0C2E\u0C38\u0C4D\u0C15\u0C3E\u0C30\u0C02", ml: "\u0D28\u0D2E\u0D38\u0D4D\u0D15\u0D3E\u0D30\u0D02", kn: "\u0CA8\u0CAE\u0CB8\u0CCD\u0C95\u0CBE\u0CB0",
    bn: "\u09A8\u09AE\u09B8\u09CD\u0995\u09BE\u09B0", mr: "\u0928\u092E\u0938\u094D\u0915\u093E\u0930", gu: "\u0AA8\u0AAE\u0AB8\u0ACD\u0AA4\u0AC7" };

  function populate() {
    const code = cfg().tts, pre = code.slice(0, 2).toLowerCase();
    vFor.textContent = "Voice for " + langSel.options[langSel.selectedIndex].text + " (" + code + ")";
    const voices = speechSynthesis.getVoices().filter(v => langOf(v.lang).startsWith(pre));
    vSel.textContent = "";
    const d = document.createElement("option"); d.value = ""; d.textContent = "Default voice"; vSel.append(d);
    voices.forEach(v => { const o = document.createElement("option"); o.value = v.voiceURI; o.textContent = v.name + " (" + v.lang + ")"; vSel.append(o); });
    vSel.value = ls("vathy_voice_" + code);
    if (vSel.value !== ls("vathy_voice_" + code)) vSel.value = "";
    vNote.textContent = voices.length ? "" : "No voices found for this language. Install one in your phone\u2019s text-to-speech settings.";
  }
  vSel.addEventListener("change", () => lset("vathy_voice_" + cfg().tts, vSel.value));
  speechSynthesis.addEventListener("voiceschanged", populate);
  langSel.addEventListener("change", populate);
  test.addEventListener("click", () => {
    const u = new SpeechSynthesisUtterance(TESTS[langSel.value] || TESTS.en);
    u.lang = cfg().tts; speechSynthesis.cancel(); speechSynthesis.speak(u);
  });
  reset.addEventListener("click", () => {
    ["vathy_rate", "vathy_pitch", "vathy_voice_" + cfg().tts].forEach(k => lset(k, ""));
    speed.sync(); pitch.sync(); populate();
  });
  close.addEventListener("click", () => { panel.hidden = true; speechSynthesis.cancel(); });

  const menu = document.getElementById("menu");
  if (menu) {
    const b = document.createElement("button"); b.textContent = "Voice settings";
    b.addEventListener("click", () => { menu.hidden = true; speed.sync(); pitch.sync(); cIn.value = ls("vathy_cc"); populate(); panel.hidden = false; });
    menu.append(b);
  }

  // ---------- Voice mode: green = on (no keyboard), red = off ----------
  const VM_KEY = "vathy_voicemode";
  const vmOn = () => ls(VM_KEY) === "1";
  const vmPanel = document.createElement("div"); vmPanel.id = "vmPanel"; vmPanel.className = "vpanel"; vmPanel.hidden = true;
  const vmHead = document.createElement("div"); vmHead.className = "chead";
  const vmTtl = document.createElement("span"); vmTtl.textContent = "Voice mode";
  const vmClose = document.createElement("button"); vmClose.textContent = "\u2715"; vmClose.setAttribute("aria-label", "Close");
  vmHead.append(vmTtl, vmClose);
  const vmBody = document.createElement("div"); vmBody.className = "vbody";
  const vmDesc = document.createElement("p"); vmDesc.className = "vnote";
  vmDesc.textContent = "Turn this on to talk to Vathy without typing. The keyboard and the type bar are hidden. Turn it off to type again or to edit photos.";
  const vmRow = document.createElement("div"); vmRow.className = "vmrow";
  const sw = document.createElement("button"); sw.setAttribute("role", "switch"); sw.setAttribute("aria-label", "Voice mode");
  const vmState = document.createElement("span");
  vmRow.append(sw, vmState);
  vmBody.append(vmDesc, vmRow);
  vmPanel.append(vmHead, vmBody);
  document.body.append(vmPanel);
  const dot = document.createElement("span");
  dot.style.cssText = "display:inline-block;width:10px;height:10px;border-radius:50%;margin-left:8px";

  function applyVM() {
    const on = vmOn();
    document.body.classList.toggle("voicemode", on);
    sw.className = "vsw " + (on ? "on" : "off"); sw.setAttribute("aria-checked", String(on));
    vmState.className = "vmstate " + (on ? "on" : "off"); vmState.textContent = on ? "ON" : "OFF";
    dot.style.background = on ? "#22c55e" : "#ef4444";
    if (on && document.activeElement && document.activeElement.blur) document.activeElement.blur();   // close the keyboard
  }
  sw.addEventListener("click", () => {
    lset(VM_KEY, vmOn() ? "" : "1");
    applyVM();
    if (vmOn() && typeof tapWake === "function" && (!started || asleep)) tapWake();   // start listening right away
  });
  vmClose.addEventListener("click", () => { vmPanel.hidden = true; });
  applyVM();
  if (menu) {
    const bVM = document.createElement("button"); bVM.append("Voice mode", dot);
    bVM.addEventListener("click", () => { menu.hidden = true; applyVM(); vmPanel.hidden = false; });
    menu.append(bVM);
  }

  // ---------- Shortcuts: Maps, YouTube, WhatsApp ----------
  const contactKey = () => "vathy_contacts_" + ((typeof user !== "undefined" && user && user.email) ? user.email : "guest");
  const contacts = () => { try { return JSON.parse(localStorage.getItem(contactKey()) || "[]"); } catch (e) { return []; } };
  function findContact(name) {
    const n = norm(name); if (!n) return null;
    const list = contacts();
    return list.find(c => norm(c.name) === n) || list.find(c => norm(c.name) && (norm(c.name).includes(n) || n.includes(norm(c.name)))) || null;
  }
  function waNumber(tel) {
    const t = String(tel).trim(), digits = t.replace(/\D/g, "");
    if (!digits) return null;
    if (t.startsWith("+")) return digits;
    if (t.startsWith("00")) return digits.slice(2);
    if (digits.length > 10) return digits.replace(/^0+/, "");
    const cc = ls("vathy_cc").replace(/\D/g, "");
    return cc ? cc + digits.replace(/^0+/, "") : null;
  }
  function buildAction(kind, arg) {
    if (!arg) return { ok: false, error: "I did not catch that. Please say it again." };
    if (kind === "NAV") return { ok: true, say: "Directions to " + arg + " are ready.", label: "Open directions to " + arg,
      url: "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(arg) };
    if (kind === "YT") return { ok: true, say: "Here is a YouTube search for " + arg + ".", label: "Search YouTube: " + arg,
      url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(arg) };
    const i = arg.indexOf("|"), name = (i < 0 ? arg : arg.slice(0, i)).trim(), msg = i < 0 ? "" : arg.slice(i + 1).trim();
    let tel = name, who = name;
    if (!/^[+\d][\d\s-]{4,}$/.test(name)) {
      const c = findContact(name);
      if (!c) return { ok: false, error: "I could not find " + name + " in your saved contacts. Add them from the menu." };
      tel = c.tel; who = c.name;
    }
    const n = waNumber(tel);
    if (!n) return { ok: false, error: "I need a country code for that number. Add it in Voice settings, or save the number with a plus sign and country code." };
    return { ok: true, say: "WhatsApp is ready for " + who + ".", label: "Open WhatsApp for " + who,
      url: "https://wa.me/" + n + (msg ? "?text=" + encodeURIComponent(msg) : "") };
  }

  const TAG = /\[(NAV|YT|WA):([^\]]*)\]/i, TAGS = /\[(?:NAV|YT|WA):[^\]]*\]/gi;
  const basePrompt = systemPrompt;
  systemPrompt = function () {
    return basePrompt() + " For directions or navigation to a place, begin your reply with [NAV:place]. To play or search a video or song on YouTube, begin with [YT:search words]. " +
      "To send a WhatsApp message, begin with [WA:exact saved contact name|the message text], and say you are getting WhatsApp ready with the message. " +
      "Then say briefly what you are doing. Do not claim the action is already finished.";
  };

  let pending = null;
  const prevAdd = add;
  add = function (role, text) {
    const m = role === "bot" ? String(text).match(TAG) : null;
    if (!m) return prevAdd(role, text);
    const act = buildAction(m[1].toUpperCase(), m[2].trim());
    const clean = String(text).replace(TAGS, "").trim();
    const c = clean || (act.ok ? act.say : "");
    const shown = act.ok ? c + (/[.!?]$/.test(c) ? "" : ".") + " Tap the button below." : act.error;
    pending = { text: shown };
    prevAdd(role, shown);
    if (act.ok) {
      const a = document.createElement("a");
      a.className = "openbtn"; a.href = act.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = act.label;
      a.style.cssText = "text-decoration:none;display:inline-block;max-width:85%";
      log.append(a); log.scrollTop = log.scrollHeight;
    }
  };
  const prevSpeak = speak;
  speak = function (text, lang, done) {
    if (pending && TAG.test(text)) { const p = pending; pending = null; return prevSpeak(p.text, lang, done); }
    return prevSpeak(text, lang, done);
  };
})();
