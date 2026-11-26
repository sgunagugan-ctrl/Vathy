// Vathy coding helper: writes code in any language, shows it in a code box with copy and download icons,
// and adds "how to run it" steps with the right website.
(function () {
  // ---------- What to tell the AI ----------
  const CODER_PROMPT = " CODING: You are an expert programmer in every language, including Python, Java, JavaScript, TypeScript, C, C++, C#, Go, Rust, Kotlin, Swift, PHP, Ruby, SQL, HTML/CSS, Bash, R and Dart. " +
    "When the user asks for code, a program, a script or a page, or asks to convert code to another language, write the COMPLETE working code in ONE fenced code block that starts with three backticks and the language name, with short comments and nothing missing. " +
    "Use these language names after the backticks: python, javascript, typescript, java, c, cpp, csharp, go, rust, kotlin, swift, php, ruby, sql, html, bash, r, dart. " +
    "Put a whole web page (HTML, CSS and JavaScript) in one html block. For Java, name the public class Main. " +
    "Write one short sentence before the code, and after it explain in at most 3 short sentences how it works. " +
    "Do NOT write steps for running it or website names, because the app adds them. For coding requests only, ignore the rule about no markdown and use the fenced code block.";
  const basePrompt = systemPrompt;
  systemPrompt = function () { return basePrompt() + CODER_PROMPT; };

  // ---------- Languages ----------
  const ALIAS = { py: "python", js: "javascript", node: "javascript", nodejs: "javascript", ts: "typescript", "c++": "cpp", cplusplus: "cpp", "c#": "csharp", cs: "csharp",
    golang: "go", rs: "rust", kt: "kotlin", sh: "bash", shell: "bash", zsh: "bash", htm: "html", html5: "html", css: "html", mysql: "sql", postgresql: "sql", sqlite: "sql", rb: "ruby" };
  const canon = l => { l = String(l || "").trim().toLowerCase(); return ALIAS[l] || l; };
  const EXT = { python: "py", javascript: "js", typescript: "ts", java: "java", c: "c", cpp: "cpp", csharp: "cs", go: "go", rust: "rs", kotlin: "kt", dart: "dart", sql: "sql",
    html: "html", php: "php", ruby: "rb", swift: "swift", r: "r", bash: "sh", lua: "lua", perl: "pl", scala: "scala", haskell: "hs" };
  const NAMES = { python: "Python", javascript: "JavaScript", typescript: "TypeScript", java: "Java", c: "C", cpp: "C++", csharp: "C#", go: "Go", rust: "Rust", kotlin: "Kotlin",
    dart: "Dart", sql: "SQL", html: "HTML / CSS / JS web page", php: "PHP", ruby: "Ruby", swift: "Swift", r: "R", bash: "Bash", lua: "Lua", perl: "Perl", scala: "Scala", haskell: "Haskell" };
  const PZ = (path, name) => ({ site: "https://www.programiz.com/" + path + "/online-compiler/", siteName: "Programiz " + name + " Compiler" });
  const STD = ["Delete the sample code in the editor.", "Paste your code.", "Tap Run.", "Read the output under the editor."];
  const RUN = {
    python: Object.assign(PZ("python-programming", "Python"), { steps: ["Delete the sample code in the editor.", "Paste your code.", "Tap Run.", "Read the output under the editor. If the program asks for input, type it in the output box."] }),
    javascript: Object.assign(PZ("javascript", "JavaScript"), { steps: ["Delete the sample code in the editor.", "Paste your code.", "Tap Run.", "Read the output under the editor. Use console.log to print."] }),
    java: Object.assign(PZ("java-programming", "Java"), { steps: ["Delete the sample code in the editor.", "Paste your code. Keep the class name Main.", "Tap Run.", "Read the output under the editor."] }),
    c: Object.assign(PZ("c-programming", "C"), { steps: STD }),
    cpp: Object.assign(PZ("cpp-programming", "C++"), { steps: STD }),
    csharp: Object.assign(PZ("csharp-programming", "C#"), { steps: STD }),
    typescript: { site: "https://www.typescriptlang.org/play/", siteName: "TypeScript Playground", steps: ["Delete the sample code on the left.", "Paste your code.", "Tap Run at the top.", "Open the Logs tab on the right to see the output."] },
    go: { site: "https://go.dev/play/", siteName: "Go Playground", steps: ["Delete the sample code.", "Paste your code.", "Tap Run.", "Read the output at the bottom."] },
    rust: { site: "https://play.rust-lang.org/", siteName: "Rust Playground", steps: ["Delete the sample code.", "Paste your code.", "Tap Run at the top left.", "Read the output at the bottom."] },
    kotlin: { site: "https://play.kotlinlang.org/", siteName: "Kotlin Playground", steps: ["Delete the sample code.", "Paste your code.", "Tap the green Run button.", "Read the output below the code."] },
    dart: { site: "https://dartpad.dev/", siteName: "DartPad", steps: ["Delete the sample code.", "Paste your code.", "Tap Run.", "Read the output in the console area."] },
    sql: { site: "https://sqliteonline.com/", siteName: "SQLite Online", steps: ["Paste your SQL into the big editor.", "Tap Run.", "Read the results in the table below."] },
    html: { site: "https://www.w3schools.com/html/tryit.asp?filename=tryhtml_default", siteName: "W3Schools Try It editor",
      steps: ["Select all the code in the left box and delete it.", "Paste your code.", "Tap the green Run button.", "Your page appears on the right, or below it on a phone."] }
  };
  function runInfo(lang) {
    if (RUN[lang]) return Object.assign({ name: NAMES[lang] }, RUN[lang]);
    const name = NAMES[lang] || (lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : "your language");
    return { name: name, site: "https://onecompiler.com/", siteName: "OneCompiler",
      steps: ["Choose " + name + " from the language list (use the search box if needed).", "Delete the sample code.", "Paste your code.", "Tap Run and read the output."] };
  }

  // ---------- Splitting a reply into text and code ----------
  function parse(text) {
    const re = /```([^\n`]*)\n([\s\S]*?)(?:```|$)/g, out = [];
    let idx = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > idx) out.push({ code: false, v: text.slice(idx, m.index) });
      out.push({ code: true, lang: canon(m[1]), v: m[2].replace(/\n$/, "") });
      idx = re.lastIndex;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (idx < text.length) out.push({ code: false, v: text.slice(idx) });
    return out;
  }

  // ---------- Styles ----------
  const css = document.createElement("style");
  css.textContent = `
    .msg.bot.hascode { max-width: 100%; width: 100%; }
    .ctext { white-space: pre-wrap; margin: 6px 0; }
    .codebox { margin: 8px 0; border-radius: 12px; overflow: hidden; background: #0d1624; border: 1px solid var(--line); }
    .codehead { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 6px 12px; background: #16233a; color: #9fb4d6; font-size: 13px; }
    .codebtns { display: flex; gap: 6px; }
    .cbtn2 { width: 34px; height: 34px; border: 0; border-radius: 8px; background: rgba(255,255,255,.1); color: #e6efff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .codebox pre { margin: 0; padding: 12px; overflow-x: auto; max-height: 420px; color: #e6edf3; font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; white-space: pre; tab-size: 2; }
    .runcard { margin-top: 10px; padding: 12px 14px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); white-space: normal; }
    .runtitle { font-weight: 700; margin-bottom: 6px; }
    .runcard ol { margin: 0 0 10px; padding-left: 20px; }
    .runcard li { margin: 4px 0; }
    .runlink { display: inline-block; padding: 8px 14px; border-radius: 10px; background: var(--accent); color: #fff; text-decoration: none; }
  `;
  document.head.append(css);

  // ---------- Code box with copy and download icons ----------
  const ICON_COPY = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  const ICON_OK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#4ade80" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
  const ICON_DL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0";
      document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
      ta.remove(); return ok;
    }
  }

  function codeBox(lang, code) {
    const box = document.createElement("div"); box.className = "codebox";
    const head = document.createElement("div"); head.className = "codehead";
    const label = document.createElement("span"); label.textContent = NAMES[lang] || lang || "code";
    const btns = document.createElement("div"); btns.className = "codebtns";
    const copy = document.createElement("button"); copy.className = "cbtn2"; copy.setAttribute("aria-label", "Copy code"); copy.innerHTML = ICON_COPY;
    copy.addEventListener("click", async () => {
      const ok = await copyText(code);
      copy.innerHTML = ok ? ICON_OK : ICON_COPY;
      setTimeout(() => { copy.innerHTML = ICON_COPY; }, 1500);
    });
    const dl = document.createElement("button"); dl.className = "cbtn2"; dl.setAttribute("aria-label", "Download code"); dl.innerHTML = ICON_DL;
    dl.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
      a.download = lang === "java" ? "Main.java" : "vathy-code." + (EXT[lang] || "txt");
      document.body.append(a); a.click(); a.remove();
    });
    btns.append(copy, dl);
    head.append(label, btns);
    const pre = document.createElement("pre"); const c = document.createElement("code"); c.textContent = code; pre.append(c);
    box.append(head, pre);
    return box;
  }

  function runCard(lang) {
    const info = runInfo(lang);
    const card = document.createElement("div"); card.className = "runcard";
    const title = document.createElement("div"); title.className = "runtitle"; title.textContent = "How to run this (" + info.name + ")";
    const ol = document.createElement("ol");
    ["Open " + info.siteName + " with the button below."].concat(info.steps, ["Got an error? Copy the message and send it to me, and I will fix the code."])
      .forEach(s => { const li = document.createElement("li"); li.textContent = s; ol.append(li); });
    const a = document.createElement("a"); a.className = "runlink"; a.href = info.site; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Open " + info.siteName;
    card.append(title, ol, a);
    return card;
  }

  function render(el) {
    const parts = parse(el.textContent);
    const kids = []; let first = "";
    parts.forEach(p => {
      if (p.code) { if (!first) first = p.lang; kids.push(codeBox(p.lang, p.v)); }
      else if (p.v.trim()) { const d = document.createElement("div"); d.className = "ctext"; d.textContent = p.v.trim(); kids.push(d); }
    });
    if (!first && !parts.some(p => p.code)) return;
    kids.push(runCard(first));
    el.dataset.rich = "1";
    el.classList.add("hascode");
    el.textContent = "";
    el.append(...kids);
    if (el.scrollIntoView) el.scrollIntoView({ block: "start" });
  }

  // Turn every bot message that contains code into a code box (also when a saved chat is reopened)
  new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType === 1 && n.classList.contains("msg") && n.classList.contains("bot") && !n.dataset.rich && n.textContent.includes("```")) render(n);
  }))).observe(log, { childList: true });

  // Do not read the code out loud
  const prevSpeak = speak;
  speak = function (text, lang, done) {
    if (typeof text === "string" && text.includes("```")) {
      let t = text.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\s+/g, " ").trim();
      t = (!t || t.length > 300) ? "I have written the code. You can copy it from the screen, and the steps to run it are below." : t + " The code is on the screen.";
      return prevSpeak(t, lang, done);
    }
    return prevSpeak(text, lang, done);
  };
})();
