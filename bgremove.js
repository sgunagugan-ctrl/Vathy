// Vathy free background remover: runs inside your phone's browser, no key needed.
// Works with photo.js. Say or type things like "remove the background" or "make the background white".
(function () {
  const $ = id => document.getElementById(id);
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";
  let lastFile = null, working = false, segPromise = null;

  // Remember the photo picked with the + button (photo.js clears the picker right after)
  document.addEventListener("change", e => {
    const t = e.target;
    if (t && t.type === "file" && t.files && t.files[0] && t.files[0].type.startsWith("image/")) lastFile = t.files[0];
  }, true);

  const BG = /background|backdrop|\u0BAA\u0BBF\u0BA9\u0BCD\u0BA9\u0BA3\u0BBF|\u092A\u0943\u0937\u094D\u0920\u092D\u0942\u092E\u093F|\u092C\u0948\u0915\u0917\u094D\u0930\u093E\u0909\u0902\u0921/i;
  const CUT = /remove|delete|erase|clear|cut ?out|cutout|take (it )?off|transparent|without|neekku|neeki|eduthidu|hatao|hata do|\u0BA8\u0BC0\u0B95\u0BCD\u0B95|\u0B8E\u0B9F\u0BC1|\u0939\u091F\u093E/i;
  function intent(text) {
    if (!BG.test(text)) return null;
    if (/white|\u0BB5\u0BC6\u0BB3\u0BCD\u0BB3\u0BC8|\u0938\u092B\u0947\u0926/i.test(text)) return "white";
    if (CUT.test(text)) return "clear";
    return null;
  }

  const geminiOn = () => { try { return !!localStorage.getItem("vathy_gemini_key"); } catch (e) { return false; } };

  function check() {
    const chip = $("chip"), input = document.querySelector("#bar input");
    if (!chip || chip.hidden || !lastFile || !input || working) return null;
    if (geminiOn()) return null;                                              // Gemini does it better
    if (typeof authConfigured !== "undefined" && authConfigured && !user) return null;   // let photo.js ask to sign in
    const mode = intent(input.value);
    return mode ? { mode: mode, input: input } : null;
  }

  document.addEventListener("click", e => {
    const b = e.target && e.target.closest ? e.target.closest("#go") : null;
    if (!b) return;
    const h = check(); if (!h) return;
    e.preventDefault(); e.stopImmediatePropagation(); run(h);
  }, true);
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || !e.target || !e.target.matches || !e.target.matches("#bar input")) return;
    const h = check(); if (!h) return;
    e.preventDefault(); e.stopImmediatePropagation(); run(h);
  }, true);

  // ---------- Chat bubbles ----------
  function bubble(text) {
    const el = document.createElement("div"); el.className = "msg bot"; el.textContent = text;
    log.append(el); log.scrollTop = log.scrollHeight; return el;
  }
  function imageBubble(url, mine, downloadable) {
    const wrap = document.createElement("div"); wrap.className = "imgwrap" + (mine ? " me" : "");
    const img = document.createElement("img"); img.src = url; img.alt = mine ? "Your photo" : "Edited photo";
    wrap.append(img);
    if (downloadable) {
      const dl = document.createElement("button"); dl.className = "dl"; dl.hidden = true; dl.setAttribute("aria-label", "Download");
      dl.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
      img.addEventListener("click", () => { dl.hidden = !dl.hidden; });
      dl.addEventListener("click", async ev => {
        ev.stopPropagation();
        const blob = await (await fetch(url)).blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "vathy-edit." + (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
        document.body.append(a); a.click(); a.remove();
      });
      wrap.append(dl);
    }
    log.append(wrap); log.scrollTop = log.scrollHeight;
  }

  // ---------- Background removal ----------
  function getSeg() {
    if (!segPromise) {
      segPromise = (async () => {
        const mod = await import(MODEL_URL);
        return mod.pipeline("background-removal", "Xenova/modnet", {
          dtype: "fp32",
          progress_callback: p => { if (p && p.status === "progress" && typeof p.progress === "number") setStatus("Downloading model " + Math.round(p.progress) + "%"); }
        });
      })().catch(e => { segPromise = null; throw e; });
    }
    return segPromise;
  }

  function sizedCanvas(bmp, max) {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  }

  // Put a 1-channel mask into the alpha channel of the picture
  function applyMask(d, w, h, mask, mw, mh, mc) {
    for (let y = 0; y < h; y++) {
      const sy = Math.min(mh - 1, Math.floor(y * mh / h));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(mw - 1, Math.floor(x * mw / w));
        d[4 * (y * w + x) + 3] = mask[(sy * mw + sx) * mc];
      }
    }
  }

  async function removeBackground(file, mode) {
    const base = sizedCanvas(await createImageBitmap(file), 1024);
    const w = base.width, h = base.height;
    const blob = await new Promise(r => base.toBlob(r, "image/png"));
    const inUrl = URL.createObjectURL(blob);
    setStatus("Loading the background remover...");
    const seg = await getSeg();
    setStatus("Removing background...");
    const out = await seg(inUrl);
    URL.revokeObjectURL(inUrl);
    const r = Array.isArray(out) ? out[0] : out;
    const fc = document.createElement("canvas"); fc.width = w; fc.height = h;
    const ctx = fc.getContext("2d");
    if (mode === "white") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
    if (r.channels === 4 && r.toCanvas) {
      ctx.drawImage(r.toCanvas(), 0, 0, w, h);
    } else {
      const t = document.createElement("canvas"); t.width = w; t.height = h;
      const tx = t.getContext("2d"); tx.drawImage(base, 0, 0);
      const im = tx.getImageData(0, 0, w, h);
      applyMask(im.data, w, h, r.data, r.width, r.height, r.channels || 1);
      tx.putImageData(im, 0, 0);
      ctx.drawImage(t, 0, 0);
    }
    return fc.toDataURL("image/png");
  }

  async function run(h) {
    working = true;
    const text = h.input.value.trim(), file = lastFile;
    h.input.value = ""; lastFile = null;
    const x = document.querySelector("#chip button"); if (x) x.click();   // clears the preview
    add("user", "\u{1F4F7} " + text);
    imageBubble(URL.createObjectURL(file), true, false);
    const wait = bubble("Removing the background. The first time it downloads a small model, so please wait...");
    try {
      const url = await removeBackground(file, h.mode);
      wait.remove();
      add("bot", (h.mode === "white" ? "Here is your photo with a white background." : "Here is your photo with the background removed.") + " This works best for photos of people.");
      imageBubble(url, false, true);
    } catch (e) {
      wait.remove();
      add("bot", "Sorry, I could not remove the background. " + (e.message || e) + " The first use needs internet to download the model.");
    }
    setStatus(started && !asleep ? "Listening..." : "Ready");
    working = false;
  }
})();
