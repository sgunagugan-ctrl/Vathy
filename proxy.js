// Vathy: use the key-holder Worker so users do not need their own keys.
(function () {
  const WORKER = "https://vathy-proxy.sgunagugan.workers.dev";   // your Worker address (no slash at the end)
  if (WORKER.includes("YOUR-WORKER-URL")) return;                  // not set up yet: keep the key boxes as they are

  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const body = init && init.body;
    const send = path => realFetch(WORKER + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body });
    if (url.startsWith("https://api.groq.com/")) return send("/groq");
    if (url.startsWith("https://api.tavily.com/")) return send("/tavily");
    return realFetch(input, init);
  };

  // The app thinks a key is present, and every key box in the top bar is hidden
  function hideKeyBoxes() {
    document.querySelectorAll("header input").forEach(b => { b.value = "server"; b.style.display = "none"; });
  }
  hideKeyBoxes();
  window.addEventListener("load", hideKeyBoxes);   // runs again after every add-on has loaded
  setTimeout(hideKeyBoxes, 800);
})();
