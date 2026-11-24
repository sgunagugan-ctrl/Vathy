// Vathy photo + type-bar add-on: bottom message bar, + photo picker, AI photo edits, download.
(function () {
  const IMAGE_MODEL = "gemini-3.1-flash-image";   // change in Menu > Photo settings if Google renames it
  const $ = id => document.getElementById(id);
  const gKey = () => { try { return localStorage.getItem("vathy_gemini_key") || ""; } catch (e) { return ""; } };
  const gModel = () => { try { return localStorage.getItem("vathy_img_model") || IMAGE_MODEL; } catch (e) { return IMAGE_MODEL; } };

  // Let the page shrink above the keyboard so the bar stays visible
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/interactive-widget/.test(vp.content)) vp.content += ", interactive-widget=resizes-content";

  // ---------- Pixel effects (pure functions) ----------
  function posterize(d, step) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(d[i] / step) * step; d[i + 1] = Math.round(d[i + 1] / step) * step; d[i + 2] = Math.round(d[i + 2] / step) * step;
    }
  }
  function cartoonPixels(d, w, h) {
    const g = new Float32Array(w * h), edge = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      if (Math.abs(gx) + Math.abs(gy) > 130) edge[i] = 1;
    }
    posterize(d, 51);
    for (let i = 0; i < w * h; i++) if (edge[i]) { d[4 * i] = 25; d[4 * i + 1] = 25; d[4 * i + 2] = 25; }
  }
  function sketchPixels(a, b) {
    for (let i = 0; i < a.length; i += 4) {
      const ga = a[i], gb = b[i];
      const v = gb >= 255 ? 255 : Math.min(255, ga * 255 / (255 - gb));
      a[i] = a[i + 1] = a[i + 2] = v;
    }
  }

  async function bitmapOf(file, max) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
    return { bmp, w, h };
  }
  function canvasOf(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  async function applyEffect(file, effect) {
    const { bmp, w, h } = await bitmapOf(file, 1280);
    const c = canvasOf(w, h), ctx = c.getContext("2d", { willReadFrequently: true });
    if (effect === "bw") { ctx.filter = "grayscale(1)"; ctx.drawImage(bmp, 0, 0, w, h); }
    else if (effect === "sepia") { ctx.filter = "sepia(1)"; ctx.drawImage(bmp, 0, 0, w, h); }
    else if (effect === "invert") { ctx.filter = "invert(1)"; ctx.drawImage(bmp, 0, 0, w, h); }
    else if (effect === "popart") {
      ctx.filter = "contrast(1.5) saturate(2.4)"; ctx.drawImage(bmp, 0, 0, w, h);
      const im = ctx.getImageData(0, 0, w, h); posterize(im.data, 85); ctx.putImageData(im, 0, 0);
    } else if (effect === "cartoon") {
      ctx.filter = "blur(1.5px) saturate(1.4)"; ctx.drawImage(bmp, 0, 0, w, h);
      const im = ctx.getImageData(0, 0, w, h); cartoonPixels(im.data, w, h); ctx.putImageData(im, 0, 0);
    } else if (effect === "sketch") {
      ctx.filter = "grayscale(1)"; ctx.drawImage(bmp, 0, 0, w, h);
      const A = ctx.getImageData(0, 0, w, h);
      const c2 = canvasOf(w, h), x2 = c2.getContext("2d", { willReadFrequently: true });
      x2.filter = "grayscale(1) invert(1) blur(8px)"; x2.drawImage(bmp, 0, 0, w, h);
      const B = x2.getImageData(0, 0, w, h);
      sketchPixels(A.data, B.data); ctx.putImageData(A, 0, 0);
    } else throw new Error("Unknown effect");
    return c.toDataURL("image/png");
  }

  async function jpegBase64(file) {
    const { bmp, w, h } = await bitmapOf(file, 1280);
    const c = canvasOf(w, h); c.getContext("2d").drawImage(bmp, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  }

  // ---------- Editing back-ends ----------
  async function geminiEdit(file, text, key) {
    const body = { contents: [{ role: "user", parts: [
      { text: "Edit this photo as follows and return the edited image: " + text },
      { inline_data: { mime_type: "image/jpeg", data: await jpegBase64(file) } } ] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] } };
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + gModel() + ":generateContent", {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || res.statusText);
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const img = parts.find(p => p.inlineData || p.inline_data);
    if (!img) { const t = parts.find(p => p.text); throw new Error((t && t.text) || "No image was returned"); }
    const d = img.inlineData || img.inline_data;
    return "data:" + (d.mimeType || d.mime_type || "image/png") + ";base64," + d.data;
  }

  async function classify(text) {
    const apiKey = keyInput.value.trim();
    if (!apiKey) throw new Error("Paste your Groq API key at the top first.");
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({ model: MODEL, temperature: 0, messages: [
        { role: "system", content: "Reply with ONLY one word from: cartoon, sketch, bw, sepia, popart, invert, unsupported. Pick the closest basic photo effect for the user's request, in any language. Cartoon or anime style = cartoon. Pencil drawing = sketch. Black and white = bw. Old or vintage = sepia. Anything else, such as removing a person, object or background, or adding things = unsupported." },
        { role: "user", content: text }] }) });
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || res.statusText);
    const m = String(data.choices[0].message.content || "").toLowerCase().match(/cartoon|sketch|bw|sepia|popart|invert|unsupported/);
    return m ? m[0] : "unsupported";
  }

  async function runEdit(file, text) {
    let gErr = "";
    const key = gKey();
    if (key) {
      try { return { url: await geminiEdit(file, text, key), note: "Here is your edited photo." }; }
      catch (e) { gErr = e.message || String(e); }
    }
    const effect = await classify(text);
    if (effect === "unsupported") {
      throw new Error(gErr ? "The AI edit failed: " + gErr
        : "Without a Gemini key I can only do cartoon, sketch, black and white, sepia, pop art and invert. For anime style, removing a person or background, or any custom edit, add a Gemini key in the \u22EF menu under Photo settings.");
    }
    return { url: await applyEffect(file, effect),
      note: (gErr ? "The AI edit failed (" + gErr.slice(0, 90) + "). " : "") + "Here is a basic \u201C" + effect + "\u201D effect." };
  }

  // ---------- Styles ----------
  const css = document.createElement("style");
  css.textContent = `
    #composer { background: var(--panel); border-top: 1px solid var(--line); padding: 8px 10px calc(8px + env(safe-area-inset-bottom)); }
    #chip { display: flex; align-items: center; gap: 10px; padding: 0 4px 8px; }
    #chip[hidden] { display: none; }
    #chip img { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; }
    #chip span { flex: 1; min-width: 0; color: var(--muted); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #chip button { border: 0; background: none; color: var(--muted); font-size: 20px; cursor: pointer; }
    #bar { display: flex; align-items: center; gap: 8px; }
    #bar input { flex: 1; min-width: 0; border-radius: 22px; padding: 10px 14px; }
    .rbtn { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 50%; border: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    #plus { background: var(--bg); color: var(--text); border: 1px solid var(--line); }
    #go { background: var(--accent); color: #fff; }
    .imgwrap { position: relative; align-self: flex-start; max-width: 85%; }
    .imgwrap.me { align-self: flex-end; }
    .imgwrap img { display: block; max-width: 100%; max-height: 320px; border-radius: 14px; }
    .dl { position: absolute; top: 8px; right: 8px; width: 38px; height: 38px; border-radius: 50%; border: 0; background: rgba(0,0,0,.65); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .dl[hidden] { display: none; }
    #pPanel { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; }
    #pPanel[hidden] { display: none; }
    #pPanel .chead { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--panel); font-weight: 600; }
    #pPanel .chead button { background: none; border: 0; color: var(--muted); font-size: 22px; cursor: pointer; padding: 0 6px; }
    .pbody { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .pbody p { margin: 0; color: var(--muted); font-size: 14px; }
    .pbody button { border: 0; border-radius: 10px; background: var(--accent); color: #fff; font: inherit; padding: 10px 14px; cursor: pointer; }
  `;
  document.head.append(css);

  // ---------- Type bar ----------
  const composer = document.createElement("div"); composer.id = "composer";
  const chip = document.createElement("div"); chip.id = "chip"; chip.hidden = true;
  const chipImg = document.createElement("img"); chipImg.alt = "";
  const chipTxt = document.createElement("span");
  const chipX = document.createElement("button"); chipX.textContent = "\u2715"; chipX.setAttribute("aria-label", "Remove photo");
  chip.append(chipImg, chipTxt, chipX);
  const bar = document.createElement("div"); bar.id = "bar";
  const plus = document.createElement("button"); plus.id = "plus"; plus.className = "rbtn"; plus.setAttribute("aria-label", "Add photo");
  plus.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  const input = document.createElement("input");
  input.type = "text"; input.placeholder = "Type a message"; input.autocomplete = "off"; input.setAttribute("enterkeyhint", "send");
  const go = document.createElement("button"); go.id = "go"; go.className = "rbtn"; go.setAttribute("aria-label", "Send");
  go.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const file = document.createElement("input"); file.type = "file"; file.accept = "image/*"; file.hidden = true;
  bar.append(plus, input, go);
  composer.append(chip, bar, file);
  document.querySelector("footer").before(composer);

  let attached = null;
  function setAttached(f) {
    if (attached) URL.revokeObjectURL(attached.url);
    attached = f ? { file: f, url: URL.createObjectURL(f) } : null;
    chip.hidden = !attached;
    if (attached) { chipImg.src = attached.url; chipTxt.textContent = "Photo ready. Type what to change, then tap \u2191"; input.placeholder = "e.g. make it anime style"; }
    else input.placeholder = "Type a message";
  }
  plus.addEventListener("click", () => file.click());
  file.addEventListener("change", () => { const f = file.files && file.files[0]; if (f && f.type.startsWith("image/")) setAttached(f); file.value = ""; });
  chipX.addEventListener("click", () => setAttached(null));

  // ---------- Chat bubbles ----------
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function bubble(text) {
    log.querySelector(".hint") && log.querySelector(".hint").remove();
    const el = document.createElement("div"); el.className = "msg bot"; el.textContent = text; log.append(el); scroll(); return el;
  }
  function imageBubble(url, mine, downloadable) {
    const wrap = document.createElement("div"); wrap.className = "imgwrap" + (mine ? " me" : "");
    const img = document.createElement("img"); img.src = url; img.alt = mine ? "Your photo" : "Edited photo";
    wrap.append(img);
    if (downloadable) {
      const dl = document.createElement("button"); dl.className = "dl"; dl.hidden = true; dl.setAttribute("aria-label", "Download");
      dl.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
      img.addEventListener("click", () => { dl.hidden = !dl.hidden; });
      dl.addEventListener("click", async e => {
        e.stopPropagation();
        const blob = await (await fetch(url)).blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "vathy-edit." + (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
        document.body.append(a); a.click(); a.remove();
      });
      wrap.append(dl);
    }
    log.append(wrap); scroll();
  }

  // ---------- Sending ----------
  let silentNext = false;
  const prevSpeak = speak;
  speak = function (text, lang, done) {
    if (silentNext) { silentNext = false; if (done) done(); return; }
    return prevSpeak(text, lang, done);
  };

  async function editPhoto(text) {
    if (!text) { setStatus("Type what to change, then tap \u2191."); return; }
    const a = attached; setAttached(null); input.value = "";
    add("user", "\u{1F4F7} " + text);
    imageBubble(a.url, true, false);
    const wait = bubble("Editing your photo...");
    setStatus("Editing photo...");
    try {
      const r = await runEdit(a.file, text);
      wait.remove();
      add("bot", r.note);
      imageBubble(r.url, false, true);
    } catch (e) {
      wait.remove();
      add("bot", "Sorry, I could not edit the photo. " + (e.message || e));
    }
    setStatus(started && !asleep ? "Listening..." : "Ready");
  }

  function send() {
    if (authConfigured && !user) { setStatus("Please sign in with Google first."); return; }
    const text = input.value.trim();
    if (attached) { editPhoto(text); return; }
    if (!text) return;
    if (busy) { setStatus("Please wait for the reply."); return; }
    input.value = "";
    silentNext = !(started && !asleep);
    ask(text).finally(() => { silentNext = false; });
  }
  go.addEventListener("click", send);
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); send(); } });

  // ---------- Photo settings (menu item) ----------
  const panel = document.createElement("div"); panel.id = "pPanel"; panel.hidden = true;
  const head = document.createElement("div"); head.className = "chead";
  const ttl = document.createElement("span"); ttl.textContent = "Photo settings";
  const close = document.createElement("button"); close.textContent = "\u2715"; close.setAttribute("aria-label", "Close");
  head.append(ttl, close);
  const body = document.createElement("div"); body.className = "pbody";
  const p1 = document.createElement("p");
  p1.textContent = "Real AI edits (anime style, removing a person or background, any custom change) need a Google Gemini API key with billing turned on. Each edited image costs a few US cents; check Google\u2019s pricing page. Without a key, Vathy only does basic effects: cartoon, sketch, black and white, sepia, pop art and invert.";
  const kIn = document.createElement("input"); kIn.type = "password"; kIn.placeholder = "Gemini API key (optional)"; kIn.autocomplete = "off";
  const mIn = document.createElement("input"); mIn.placeholder = "Image model name"; mIn.autocomplete = "off";
  const save = document.createElement("button"); save.textContent = "Save";
  const p2 = document.createElement("p");
  body.append(p1, kIn, mIn, save, p2);
  panel.append(head, body);
  document.body.append(panel);
  save.addEventListener("click", () => {
    try { localStorage.setItem("vathy_gemini_key", kIn.value.trim()); localStorage.setItem("vathy_img_model", mIn.value.trim() || IMAGE_MODEL); } catch (e) {}
    p2.textContent = "Saved."; 
  });
  close.addEventListener("click", () => { panel.hidden = true; });
  const menu = $("menu");
  if (menu) {
    const b = document.createElement("button"); b.textContent = "Photo settings";
    b.addEventListener("click", () => { menu.hidden = true; kIn.value = gKey(); mIn.value = gModel(); p2.textContent = ""; panel.hidden = false; });
    menu.append(b);
  }

})();
