// Vathy web search add-on: Tavily (if a key is set), otherwise Wikipedia.
(function () {
  // Optional Tavily key box, added under the Groq key
  const header = document.querySelector("header");
  const tav = document.createElement("input");
  tav.type = "password"; tav.placeholder = "Tavily key for web search (optional)"; tav.autocomplete = "off";
  tav.style.flex = "1 1 100%";
  header.style.flexWrap = "wrap";
  header.append(tav);
  try { tav.value = localStorage.getItem("tavily_key") || ""; } catch (e) {}
  tav.addEventListener("change", () => { try { localStorage.setItem("tavily_key", tav.value.trim()); } catch (e) {} });

  // Tell the AI about the new tool
  TOOLS.push({ type: "function", function: {
    name: "web_search",
    description: "Search the web for news, current events, recent facts, or anything complicated you are not sure about.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Short search query" } }, required: ["query"] }
  } });

  const baseSystemPrompt = systemPrompt;
  systemPrompt = function () {
    return baseSystemPrompt() + " For news, current events, recent facts or complicated questions you are not sure about, call web_search first, then answer briefly in your own words from the results.";
  };

  async function tavilySearch(q, key) {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ query: q, max_results: 4, include_answer: true, search_depth: "basic" })
    });
    if (!r.ok) throw new Error("Tavily error " + r.status);
    const d = await r.json();
    return {
      source: "web search", answer: d.answer || "",
      results: (d.results || []).map(x => ({ title: x.title, url: x.url, snippet: (x.content || "").slice(0, 300) }))
    };
  }

  async function wikiSearch(q) {
    const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=" + encodeURIComponent(q) +
      "&gsrlimit=3&prop=extracts&exintro=1&explaintext=1&exchars=500&format=json&origin=*");
    const d = await r.json();
    const pages = Object.values((d.query && d.query.pages) || {}).sort((a, b) => a.index - b.index);
    if (!pages.length) return { error: "No results found" };
    return { source: "Wikipedia", results: pages.map(p => ({ title: p.title, summary: (p.extract || "").slice(0, 500) })) };
  }

  const baseRunTool = runTool;
  runTool = async function (name, args) {
    if (name !== "web_search") return baseRunTool(name, args);
    const key = tav.value.trim();
    if (key) {
      try { return await tavilySearch(args.query, key); } catch (e) { /* fall back to Wikipedia */ }
    }
    return wikiSearch(args.query);
  };
})();
