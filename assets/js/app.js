(() => {
  "use strict";
  const state = { manifest: [], byTitle: new Map(), byPath: new Map(), current: "" };
  const els = {
    content: document.querySelector("#content"), loading: document.querySelector("#loading"),
    error: document.querySelector("#error"), errorDetail: document.querySelector("#error-detail"),
    tree: document.querySelector("#tree"), search: document.querySelector("#nav-search"),
    sidebar: document.querySelector("#site-nav"), scrim: document.querySelector("#scrim"),
    navToggle: document.querySelector("#nav-toggle"), closeNav: document.querySelector("#close-nav"),
    theme: document.querySelector("#theme-toggle"), expand: document.querySelector("#expand-all"), reader: document.querySelector("#reader")
  };

  const normalize = value => decodeURIComponent(value || "").replace(/^\.\//, "").replace(/\\/g, "/");
  const pageFromUrl = () => normalize(new URL(location.href).searchParams.get("page") || "Entrenched.md");
  const hrefFor = path => `?page=${encodeURIComponent(path)}`;
  const escapeHtml = value => value.replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const slugify = value => value.toLowerCase().trim().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function findPage(target) {
    const cleaned = normalize(target).replace(/^\//, "").trim();
    const withoutExtension = cleaned.replace(/\.(?:md|pdf)$/i, "");
    const basename = withoutExtension.split("/").pop().toLowerCase();
    return state.byPath.get(cleaned.toLowerCase())
      || state.byPath.get(withoutExtension.toLowerCase())
      || state.byTitle.get(withoutExtension.toLowerCase())
      || state.byTitle.get(basename);
  }

  function prepareMarkdown(markdown) {
    const callouts = markdown.replace(/^(\s*>\s*)\[!([a-z][a-z0-9_-]*)\][+-]?\s*(.*)$/gim, (_, quote, type, title) => {
      return `${quote}[!${type.toUpperCase()}] ${title.trim()}\n${quote.trimEnd()}`;
    });
    return callouts.replace(/!?\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const title = target.trim();
      const found = findPage(title);
      return found ? `[${label?.trim() || title.replace(/\.(?:md|pdf)$/i, "")}](${hrefFor(found.path)})` : (label?.trim() || title);
    });
  }

  function safeRenderedHtml(markdown) {
    const renderer = new marked.Renderer();
    renderer.heading = ({ tokens, depth }) => {
      const body = marked.Parser.parseInline(tokens);
      return `<h${depth} id="${slugify(body)}">${body}</h${depth}>`;
    };
    renderer.link = ({ href, title, tokens }) => {
      const body = marked.Parser.parseInline(tokens);
      let safe = href && !/^javascript:/i.test(href) ? href : "#";
      if (!safe.startsWith("?page=") && !/^(?:https?:|mailto:|#)/i.test(safe)) {
        const linkedPage = findPage(safe);
        if (linkedPage) safe = hrefFor(linkedPage.path);
      }
      const external = /^https?:/i.test(safe);
      const page = safe.startsWith("?page=") ? ` data-page="${escapeHtml(decodeURIComponent(safe.slice(6)))}"` : "";
      return `<a href="${escapeHtml(safe)}"${page}${title ? ` title="${escapeHtml(title)}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${body}</a>`;
    };
    renderer.html = ({ text }) => escapeHtml(text);
    return marked.parse(prepareMarkdown(markdown), { gfm: true, breaks: false, renderer });
  }

  function enhanceCallouts(root) {
    const supported = new Set(["note", "tip", "important", "warning", "caution"]);
    root.querySelectorAll("blockquote").forEach(blockquote => {
      const marker = blockquote.firstElementChild;
      if (!marker || marker.tagName !== "P") return;
      const match = marker.textContent.trim().match(/^\[!([A-Z][A-Z0-9_-]*)\]\s*(.*)$/i);
      if (!match) return;
      const type = match[1].toLowerCase();
      const style = supported.has(type) ? type : "note";
      const title = match[2].trim() || type.replace(/[-_]+/g, " ").replace(/^./, letter => letter.toUpperCase());
      const heading = document.createElement("div");
      heading.className = "callout-title";
      heading.textContent = title;
      marker.remove();
      blockquote.classList.add("callout", `callout-${style}`);
      blockquote.prepend(heading);
    });
  }

  function buildTree() {
    const home = state.manifest.find(item => item.path === "Entrenched.md");
    const groups = new Map();
    state.manifest.filter(item => item.path !== "Entrenched.md").forEach(item => {
      if (!groups.has(item.folder)) groups.set(item.folder, []);
      groups.get(item.folder).push(item);
    });
    els.tree.replaceChildren();
    if (home) els.tree.append(makeLink(home, true));
    [...groups.entries()].sort(([a],[b]) => a.localeCompare(b, undefined, { numeric: true })).forEach(([folder, files]) => {
      const details = document.createElement("details"); details.open = true; details.dataset.folder = folder.toLowerCase();
      const summary = document.createElement("summary");
      const label = document.createElement("span"); label.textContent = folder;
      const count = document.createElement("span"); count.className = "tree-count"; count.textContent = files.length;
      summary.append(label, count); details.append(summary);
      const box = document.createElement("div"); box.className = "tree-files";
      files.sort((a,b) => a.title.localeCompare(b.title)).forEach(item => box.append(makeLink(item)));
      details.append(box); els.tree.append(details);
    });
  }

  function makeLink(item, home=false) {
    const a = document.createElement("a"); a.className = `tree-link${home ? " home" : ""}`;
    a.href = hrefFor(item.path); a.dataset.page = item.path; a.dataset.type = item.type || "markdown"; a.dataset.search = `${item.title} ${item.folder} ${item.type || "markdown"}`.toLowerCase();
    const label = document.createElement("span"); label.textContent = item.title; a.append(label);
    if (item.type === "pdf") { const badge = document.createElement("span"); badge.className = "file-badge"; badge.textContent = "PDF"; a.append(badge); }
    return a;
  }

  function setActive(path) {
    document.querySelectorAll(".tree-link").forEach(link => {
      const active = normalize(link.dataset.page) === path;
      link.classList.toggle("active", active);
      if (active) {
        link.setAttribute("aria-current", "page");
        link.closest("details")?.setAttribute("open", "");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  async function openPage(path, { push=true, focus=true }={}) {
    path = normalize(path); state.current = path; setActive(path);
    els.loading.hidden = false; els.content.hidden = true; els.error.hidden = true;
    try {
      const item = state.manifest.find(entry => normalize(entry.path) === path);
      if (item?.type === "pdf" || path.toLowerCase().endsWith(".pdf")) {
        const fileUrl = path.split("/").map(encodeURIComponent).join("/");
        const response = await fetch(fileUrl, { method: "HEAD", cache: "no-store" });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        els.content.innerHTML = `<section class="pdf-viewer"><div class="pdf-heading"><div><p class="eyebrow">PRINTABLE PLAY AID / PDF</p><h1>${escapeHtml(item?.title || path.split("/").pop().replace(/\.pdf$/i,""))}</h1></div><div class="pdf-actions"><a class="pdf-button" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">Open PDF</a><a class="pdf-button secondary" href="${escapeHtml(fileUrl)}" download>Download</a></div></div><object data="${escapeHtml(fileUrl)}" type="application/pdf"><p>This browser cannot display the PDF here. <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">Open the character sheet in a new tab.</a></p></object></section>`;
        els.content.hidden = false; els.loading.hidden = true;
        document.title = `${item?.title || "PDF"} - Entrenched`;
        if (push) history.pushState({ page:path }, "", hrefFor(path));
        window.scrollTo({ top:0, behavior:"instant" }); if (focus) els.reader.focus({ preventScroll:true }); closeMenu();
        return;
      }
      const response = await fetch(path.split("/").map(encodeURIComponent).join("/"), { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const markdown = await response.text(); els.content.innerHTML = safeRenderedHtml(markdown); enhanceCallouts(els.content);
      els.content.hidden = false; els.loading.hidden = true;
      const h1 = els.content.querySelector("h1"); document.title = `${h1?.textContent || "Entrenched"} - Entrenched`;
      if (push) history.pushState({ page:path }, "", hrefFor(path));
      window.scrollTo({ top:0, behavior:"instant" }); if (focus) els.reader.focus({ preventScroll:true }); closeMenu();
    } catch (error) {
      els.loading.hidden = true; els.error.hidden = false; els.errorDetail.textContent = `${path} could not be loaded (${error.message}).`;
    }
  }

  function openMenu(){ els.sidebar.classList.add("open"); els.scrim.hidden=false; els.navToggle.setAttribute("aria-expanded","true"); }
  function closeMenu(){ els.sidebar.classList.remove("open"); els.scrim.hidden=true; els.navToggle.setAttribute("aria-expanded","false"); }
  function applyTheme(theme){ document.documentElement.dataset.theme=theme; localStorage.setItem("entrenched-theme",theme); }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-page]"); if (!link) return;
    event.preventDefault(); openPage(link.dataset.page);
  });
  window.addEventListener("popstate", () => openPage(pageFromUrl(), {push:false}));
  els.navToggle.addEventListener("click", openMenu); els.closeNav.addEventListener("click", closeMenu); els.scrim.addEventListener("click", closeMenu);
  els.theme.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));
  els.expand.addEventListener("click", () => {
    const details=[...document.querySelectorAll(".tree details")]; const shouldOpen=details.some(d=>!d.open); details.forEach(d=>d.open=shouldOpen); els.expand.textContent=shouldOpen?"Collapse all":"Expand all";
  });
  els.search.addEventListener("input", () => {
    const q=els.search.value.trim().toLowerCase();
    document.querySelectorAll(".tree details").forEach(details => {
      let visible=0; details.querySelectorAll(".tree-link").forEach(link => { const show=!q||link.dataset.search.includes(q); link.hidden=!show; if(show)visible++; });
      details.hidden=visible===0; if(q&&visible)details.open=true;
    });
    document.querySelector(".tree-link.home")?.toggleAttribute("hidden", !!q && !"entrenched home".includes(q));
  });

  async function init() {
    applyTheme(localStorage.getItem("entrenched-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
    if (location.protocol === "file:") {
      els.loading.hidden = true;
      els.error.hidden = false;
      els.error.querySelector(".eyebrow").textContent = "LOCAL READER NOT STARTED";
      els.error.querySelector("h1").textContent = "Open the site with its local launcher.";
      els.errorDetail.textContent = "Close this tab, then double-click Open Entrenched Site.cmd in the Entrenched folder. Browsers block Markdown loading when index.html is opened directly.";
      els.error.querySelector(".return-link").hidden = true;
      return;
    }
    try {
      const response=await fetch("assets/content-manifest.json",{cache:"no-store"}); if(!response.ok)throw new Error("Content index unavailable");
      state.manifest=await response.json(); state.manifest.forEach(item => {
        const path = normalize(item.path).toLowerCase();
        const basename = path.split("/").pop().replace(/\.(?:md|pdf)$/i, "");
        state.byTitle.set(item.title.toLowerCase(), item);
        if (!state.byTitle.has(basename)) state.byTitle.set(basename, item);
        state.byPath.set(path, item);
        state.byPath.set(path.replace(/\.(?:md|pdf)$/i, ""), item);
      }); buildTree();
      await openPage(pageFromUrl(),{push:false,focus:false});
    } catch(error) { els.loading.hidden=true; els.error.hidden=false; els.errorDetail.textContent=error.message; }
  }
  init();
})();
