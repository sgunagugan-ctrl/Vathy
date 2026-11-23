// Vathy chat history add-on: "..." menu with History and New chat.
(function () {
  const KEY = () => "vathy_chats_" + ((typeof user !== "undefined" && user && user.email) ? user.email : "guest");
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY()) || "[]"); } catch (e) { return []; } };
  const store = list => { try { localStorage.setItem(KEY(), JSON.stringify(list)); } catch (e) {} };
  const fresh = () => ({ id: Date.now(), title: "", ts: Date.now(), msgs: [] });
  let current = fresh();

  function save() {
    if (!current.msgs.some(m => m.role === "user")) return;   // do not save empty chats
    current.ts = Date.now();
    const list = load().filter(c => c.id !== current.id);
    list.unshift(current);
    store(list.slice(0, 100));
  }

  // Record every message shown on screen
  const baseAdd = add;
  add = function (role, text) {
    baseAdd(role, text);
    current.msgs.push({ role: role, text: text });
    if (role === "user" && !current.title) current.title = text.slice(0, 40);
    save();
  };

  // Styles
  const css = document.createElement("style");
  css.textContent = `
    #authbar { padding-left: 62px; }
    #menuBtn { position: fixed; top: 12px; left: 10px; z-index: 50; width: 40px; height: 40px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
    #menu { position: fixed; top: 58px; left: 10px; z-index: 51; min-width: 170px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,.25); overflow: hidden; }
    #menu[hidden], #histPanel[hidden] { display: none; }
    #menu button { display: block; width: 100%; text-align: left; padding: 12px 16px; background: none; border: 0; color: var(--text); font: inherit; cursor: pointer; }
    #menu button + button { border-top: 1px solid var(--line); }
    #histPanel { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; }
    .hhead { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--panel); font-weight: 600; }
    .hhead button { background: none; border: 0; color: var(--muted); font-size: 22px; cursor: pointer; padding: 0 6px; }
    .hlist { flex: 1; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
    .hitem { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
    .hopen { flex: 1; min-width: 0; text-align: left; padding: 10px 14px; background: none; border: 0; color: var(--text); font: inherit; cursor: pointer; }
    .hopen b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hopen small { color: var(--muted); }
    .hdel { border: 0; background: none; color: var(--muted); font-size: 18px; padding: 10px 14px; cursor: pointer; }
    .hempty { margin: auto; color: var(--muted); text-align: center; }
  `;
  document.head.append(css);

  // "..." button and its menu
  const btn = document.createElement("button");
  btn.id = "menuBtn"; btn.setAttribute("aria-label", "Menu");
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
  const menu = document.createElement("div");
  menu.id = "menu"; menu.hidden = true;
  const bHist = document.createElement("button"); bHist.textContent = "History";
  const bNew = document.createElement("button"); bNew.textContent = "New chat";
  menu.append(bHist, bNew);

  // History panel
  const panel = document.createElement("div");
  panel.id = "histPanel"; panel.hidden = true;
  const head = document.createElement("div"); head.className = "hhead";
  const ttl = document.createElement("span"); ttl.textContent = "History";
  const close = document.createElement("button"); close.textContent = "\u2715"; close.setAttribute("aria-label", "Close");
  head.append(ttl, close);
  const listEl = document.createElement("div"); listEl.className = "hlist";
  panel.append(head, listEl);
  document.body.append(btn, menu, panel);

  function renderList() {
    listEl.textContent = "";
    const chats = load();
    if (!chats.length) {
      const e = document.createElement("div"); e.className = "hempty"; e.textContent = "No saved chats yet.";
      listEl.append(e); return;
    }
    chats.forEach(c => {
      const row = document.createElement("div"); row.className = "hitem";
      const open = document.createElement("button"); open.className = "hopen";
      const b = document.createElement("b"); b.textContent = c.title || "Chat";
      const s = document.createElement("small");
      s.textContent = new Date(c.ts).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
      open.append(b, s);
      open.addEventListener("click", () => openChat(c));
      const del = document.createElement("button"); del.className = "hdel"; del.textContent = "\u2715"; del.setAttribute("aria-label", "Delete chat");
      del.addEventListener("click", () => { store(load().filter(x => x.id !== c.id)); renderList(); });
      row.append(open, del);
      listEl.append(row);
    });
  }

  function openChat(c) {
    save();
    current = c;
    history = c.msgs.filter(m => m.role === "user" || m.role === "bot")
      .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })).slice(-20);
    log.textContent = "";
    c.msgs.forEach(m => baseAdd(m.role, m.text));
    panel.hidden = true;
  }

  function newChat() {
    speechSynthesis.cancel();
    save();
    current = fresh();
    history = [];
    log.textContent = "";
    const h = document.createElement("div"); h.className = "hint"; h.textContent = "New chat started. Ask me anything.";
    log.append(h);
  }

  btn.addEventListener("click", e => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener("click", () => { menu.hidden = true; });
  bHist.addEventListener("click", () => { menu.hidden = true; renderList(); panel.hidden = false; });
  bNew.addEventListener("click", () => { menu.hidden = true; newChat(); });
  close.addEventListener("click", () => { panel.hidden = true; });
})();
