// Vathy contacts add-on: "Add contacts" menu item, saved contacts, and voice calling.
(function () {
  const KEY = () => "vathy_contacts_" + ((typeof user !== "undefined" && user && user.email) ? user.email : "guest");
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY()) || "[]"); } catch (e) { return []; } };
  const store = list => { try { localStorage.setItem(KEY(), JSON.stringify(list)); } catch (e) {} };
  const cleanTel = t => String(t || "").replace(/[^\d+]/g, "");
  const norm = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

  function addContact(name, tel) {
    name = String(name || "").trim(); tel = cleanTel(tel);
    if (!name || tel.length < 3) return false;
    const list = load().filter(c => c.tel !== tel);
    list.push({ name: name, tel: tel });
    list.sort((a, b) => a.name.localeCompare(b.name));
    store(list);
    return true;
  }

  function findContact(name) {
    if (/^[+\d][\d\s-]{4,}$/.test(name)) return { name: name, tel: cleanTel(name) };
    const n = norm(name); if (!n) return null;
    const list = load();
    return list.find(c => norm(c.name) === n) ||
      list.find(c => norm(c.name) && (norm(c.name).includes(n) || n.includes(norm(c.name)))) || null;
  }

  const dial = c => { window.location.href = "tel:" + c.tel; };

  // ---- Voice calling ----
  const basePrompt = systemPrompt;
  systemPrompt = function () {
    const names = load().map(c => c.name).join(", ");
    return basePrompt() + " If the user asks you to call someone, in any language, begin your reply with [CALL:name] using the exact saved contact name that best matches, " +
      "or the phone number if they said digits, then say briefly that you are calling. Saved contacts: " + (names || "none yet") + ".";
  };

  let pending = null;
  const parse = text => {
    const m = String(text).match(/\[CALL:([^\]]*)\]/i);
    return m ? { name: m[1].trim(), clean: String(text).replace(/\[CALL:[^\]]*\]/gi, "").trim() } : null;
  };

  const prevAdd = add;
  add = function (role, text) {
    const p = role === "bot" ? parse(text) : null;
    if (!p) return prevAdd(role, text);
    const c = findContact(p.name);
    const shown = c ? (p.clean || "Calling " + c.name + ".") : "I could not find " + p.name + " in your saved contacts. Add them from the menu.";
    pending = { contact: c, clean: shown };
    prevAdd(role, shown);
    if (c) {
      const b = document.createElement("button");
      b.className = "openbtn"; b.textContent = "Call " + c.name;
      b.addEventListener("click", () => dial(c));
      log.append(b); log.scrollTop = log.scrollHeight;
    }
  };

  const prevSpeak = speak;
  speak = function (text, lang, done) {
    if (pending && /\[CALL:/i.test(text)) {
      const p = pending; pending = null;
      return prevSpeak(p.clean, lang, () => { if (done) done(); if (p.contact) dial(p.contact); });
    }
    return prevSpeak(text, lang, done);
  };

  // ---- Styles ----
  const css = document.createElement("style");
  css.textContent = `
    #cPanel { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; }
    #cPanel[hidden] { display: none; }
    .chead { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--panel); font-weight: 600; }
    .chead button { background: none; border: 0; color: var(--muted); font-size: 22px; cursor: pointer; padding: 0 6px; }
    .cbar { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--line); background: var(--panel); }
    .cbtn { border: 0; border-radius: 10px; background: var(--accent); color: #fff; font: inherit; padding: 10px 14px; cursor: pointer; }
    .crow { display: flex; gap: 6px; }
    .crow input { flex: 1; min-width: 0; }
    .cnote { color: var(--muted); font-size: 13px; }
    .clist { flex: 1; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
    .citem { display: flex; align-items: center; gap: 4px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
    .cinfo { flex: 1; min-width: 0; padding: 10px 14px; }
    .cinfo b, .cinfo small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cinfo small { color: var(--muted); }
    .ccall { border: 0; border-radius: 8px; background: var(--accent); color: #fff; font: inherit; padding: 6px 12px; cursor: pointer; }
    .cdel { border: 0; background: none; color: var(--muted); font-size: 18px; padding: 10px 12px; cursor: pointer; }
    .cempty { margin: auto; color: var(--muted); text-align: center; padding: 0 20px; }
  `;
  document.head.append(css);

  // ---- Contacts panel ----
  const panel = document.createElement("div");
  panel.id = "cPanel"; panel.hidden = true;
  const head = document.createElement("div"); head.className = "chead";
  const ttl = document.createElement("span"); ttl.textContent = "Contacts";
  const close = document.createElement("button"); close.textContent = "\u2715"; close.setAttribute("aria-label", "Close");
  head.append(ttl, close);

  const bar = document.createElement("div"); bar.className = "cbar";
  const pick = document.createElement("button"); pick.className = "cbtn"; pick.textContent = "Choose from phone contacts";
  const row = document.createElement("div"); row.className = "crow";
  const nameIn = document.createElement("input"); nameIn.placeholder = "Name"; nameIn.autocomplete = "off";
  const telIn = document.createElement("input"); telIn.placeholder = "Phone number"; telIn.type = "tel"; telIn.autocomplete = "off";
  const addBtn = document.createElement("button"); addBtn.className = "cbtn"; addBtn.textContent = "Add";
  row.append(nameIn, telIn, addBtn);
  const note = document.createElement("div"); note.className = "cnote";
  note.textContent = "Contacts are saved only on this phone. Say, for example, \u201Ccall Amma\u201D to call.";
  bar.append(pick, row, note);

  const listEl = document.createElement("div"); listEl.className = "clist";
  panel.append(head, bar, listEl);
  document.body.append(panel);

  function render() {
    listEl.textContent = "";
    const list = load();
    if (!list.length) {
      const e = document.createElement("div"); e.className = "cempty";
      e.textContent = "No contacts saved yet. Choose from your phone or add one above.";
      listEl.append(e); return;
    }
    list.forEach(c => {
      const item = document.createElement("div"); item.className = "citem";
      const info = document.createElement("div"); info.className = "cinfo";
      const b = document.createElement("b"); b.textContent = c.name;
      const s = document.createElement("small"); s.textContent = c.tel;
      info.append(b, s);
      const call = document.createElement("button"); call.className = "ccall"; call.textContent = "Call";
      call.addEventListener("click", () => dial(c));
      const del = document.createElement("button"); del.className = "cdel"; del.textContent = "\u2715"; del.setAttribute("aria-label", "Delete contact");
      del.addEventListener("click", () => { store(load().filter(x => x.tel !== c.tel)); render(); });
      item.append(info, call, del);
      listEl.append(item);
    });
  }

  pick.addEventListener("click", async () => {
    if (!("contacts" in navigator) || !("ContactsManager" in window)) {
      note.textContent = "This browser cannot open your phone contacts. Type the name and number below instead.";
      return;
    }
    try {
      const picked = await navigator.contacts.select(["name", "tel"], { multiple: true });
      let n = 0;
      picked.forEach(c => { if (addContact((c.name && c.name[0]) || "", (c.tel && c.tel[0]) || "")) n++; });
      note.textContent = n ? n + " contact(s) saved in Vathy." : "No contacts with a name and number were selected.";
      render();
    } catch (e) { /* cancelled */ }
  });
  addBtn.addEventListener("click", () => {
    if (addContact(nameIn.value, telIn.value)) { nameIn.value = ""; telIn.value = ""; note.textContent = "Contact saved."; render(); }
    else note.textContent = "Enter a name and a phone number.";
  });
  close.addEventListener("click", () => { panel.hidden = true; });

  // ---- Menu item under the "..." button ----
  const menu = document.getElementById("menu");
  if (menu) {
    const bC = document.createElement("button"); bC.textContent = "Add contacts";
    bC.addEventListener("click", () => { menu.hidden = true; render(); panel.hidden = false; });
    menu.append(bC);
  }
})();
