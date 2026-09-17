(() => {
  "use strict";
  const defaults = { siteTitle:"Obsidian Reader", siteSubtitle:"Published notes", homeDocument:"Home.md", loadingText:"Opening document…", sidebarNote:"", icon:"assets/images/site-icon.svg", themeStorageKey:"obsidian-reader-theme", attributions:[] };
  const state = { config:defaults, manifest:[], byTitle:new Map(), byPath:new Map(), current:"" };
  const $ = selector => document.querySelector(selector);
  const els = { content:$("#content"), loading:$("#loading"), error:$("#error"), errorDetail:$("#error-detail"), errorLabel:$("#error-label"), errorTitle:$("#error-title"), tree:$("#tree"), search:$("#nav-search"), sidebar:$("#site-nav"), scrim:$("#scrim"), navToggle:$("#nav-toggle"), closeNav:$("#close-nav"), theme:$("#theme-toggle"), expand:$("#expand-all"), reader:$("#reader"), siteTitle:$("#site-title"), siteSubtitle:$("#site-subtitle"), brandMark:$("#brand-mark"), siteIcon:$("#site-icon"), sidebarNote:$("#sidebar-note"), sourceCredits:$("#source-credits") };
  const normalize = value => decodeURIComponent(value || "").replace(/^\.\//, "").replace(/\\/g, "/");
  const pageFromUrl = () => normalize(new URL(location.href).searchParams.get("page") || state.config.homeDocument);
  const hrefFor = path => `?page=${encodeURIComponent(path)}`;
  const encodedPath = path => normalize(path).split("/").map(encodeURIComponent).join("/");
  const mediaPattern = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const slugify = value => value.toLowerCase().trim().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function findPage(target) {
    const cleaned = normalize(target).replace(/^\//, "").trim();
    const stem = cleaned.replace(/\.(?:md|pdf)$/i, "");
    const basename = stem.split("/").pop().toLowerCase();
    return state.byPath.get(cleaned.toLowerCase()) || state.byPath.get(stem.toLowerCase()) || state.byTitle.get(stem.toLowerCase()) || state.byTitle.get(basename);
  }

  function prepareMarkdown(markdown) {
    const callouts = markdown.replace(/^(\s*>\s*)\[!([a-z][a-z0-9_-]*)\][+-]?\s*(.*)$/gim, (_, quote, type, title) => `${quote}[!${type.toUpperCase()}] ${title.trim()}\n${quote.trimEnd()}`);
    const embeds = callouts.replace(/!\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const source=target.trim();
      if(!mediaPattern.test(source))return label?.trim()||source;
      return `![${label?.trim()||source.split("/").pop()}](<${source}>)`;
    });
    return embeds.replace(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_, target, heading, label) => {
      const title = target.trim(); const found = findPage(title);
      if (!found) return label?.trim() || title;
      return `[${label?.trim() || title.replace(/\.(?:md|pdf)$/i, "")}](${hrefFor(found.path)}${heading ? `#${slugify(heading)}` : ""})`;
    });
  }

  function safeRenderedHtml(markdown) {
    const renderer = new marked.Renderer();
    renderer.heading = ({tokens,depth}) => { const body=marked.Parser.parseInline(tokens); return `<h${depth} id="${slugify(body)}">${body}</h${depth}>`; };
    renderer.link = ({href,title,tokens}) => {
      const body=marked.Parser.parseInline(tokens); let safe=href && !/^javascript:/i.test(href) ? href : "#";
      if (!safe.startsWith("?page=") && !/^(?:https?:|mailto:|#)/i.test(safe)) { const [path,anchor]=safe.split("#",2); const page=findPage(path); if(page)safe=`${hrefFor(page.path)}${anchor?`#${slugify(anchor)}`:""}`; }
      const external=/^https?:/i.test(safe); const page=safe.startsWith("?page=") ? ` data-page="${escapeHtml(decodeURIComponent(safe.slice(6).split("#")[0]))}"` : "";
      return `<a href="${escapeHtml(safe)}"${page}${title?` title="${escapeHtml(title)}"`:""}${external?' target="_blank" rel="noopener noreferrer"':""}>${body}</a>`;
    };
    renderer.image = ({href,title,text}) => `<img src="${escapeHtml(href||"")}" data-media-source="${escapeHtml(href||"")}" alt="${escapeHtml(text||"")}"${title?` title="${escapeHtml(title)}"`:""} loading="lazy" decoding="async">`;
    renderer.html = ({text}) => escapeHtml(text);
    return marked.parse(prepareMarkdown(markdown), {gfm:true,breaks:false,renderer});
  }

  function mediaCandidates(source) {
    const clean=normalize(source).replace(/^\//,"");
    if(/^(?:https?:|data:|blob:)/i.test(source))return [source];
    const name=clean.split("/").pop();
    const folder=state.current.split("/").slice(0,-1).join("/");
    return [...new Set([clean,folder&&`${folder}/${clean}`,`assets/images/${clean}`,`assets/images/Art/${name}`].filter(Boolean).map(encodedPath))];
  }

  function closeImagePreview() {
    const preview=document.querySelector(".image-preview");
    if(!preview)return;
    preview.remove();document.body.classList.remove("preview-open");
  }

  function openImagePreview(image) {
    closeImagePreview();
    const preview=document.createElement("div");preview.className="image-preview";preview.setAttribute("role","dialog");preview.setAttribute("aria-modal","true");preview.setAttribute("aria-label",image.alt?`Full-size preview: ${image.alt}`:"Full-size image preview");preview.tabIndex=-1;
    const full=document.createElement("img");full.src=image.currentSrc||image.src;full.alt=image.alt;full.title="Click or tap to return to the reader";
    preview.append(full);document.body.append(preview);document.body.classList.add("preview-open");preview.focus();
    full.addEventListener("click",closeImagePreview);preview.addEventListener("click",event=>{if(event.target===preview)closeImagePreview();});
  }

  function enhanceImages(root) {
    root.querySelectorAll("img[data-media-source]").forEach(image=>{
      const choices=mediaCandidates(image.dataset.mediaSource);let index=0;
      const tryNext=()=>{if(index<choices.length)image.src=choices[index++];};
      image.addEventListener("error",tryNext);tryNext();
      image.tabIndex=0;image.setAttribute("role","button");image.setAttribute("aria-label",`${image.alt||"Image"}. Open full-size preview.`);
      image.addEventListener("click",()=>openImagePreview(image));image.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openImagePreview(image);}});
    });
  }

  function enhanceCallouts(root) {
    const supported=new Set(["note","tip","important","warning","caution"]);
    root.querySelectorAll("blockquote").forEach(block => {
      const marker=block.firstElementChild; if(!marker || marker.tagName!=="P")return;
      const match=marker.textContent.trim().match(/^\[!([A-Z][A-Z0-9_-]*)\]\s*(.*)$/i); if(!match)return;
      const type=match[1].toLowerCase(); const title=match[2].trim() || type.replace(/[-_]+/g," ").replace(/^./,c=>c.toUpperCase());
      const heading=document.createElement("div"); heading.className="callout-title"; heading.textContent=title; marker.remove();
      const body=block.nextElementSibling;
      if(body?.tagName==="BLOCKQUOTE"&&!/^\[![A-Z]/i.test(body.textContent.trim())){while(body.firstChild)block.append(body.firstChild);body.remove();}
      block.classList.add("callout",`callout-${supported.has(type)?type:"note"}`); block.prepend(heading);
    });
  }

  function makeLink(item, home=false) {
    const link=document.createElement("a"); link.className=`tree-link${home?" home":""}`; link.href=hrefFor(item.path); link.dataset.page=item.path; link.dataset.type=item.type||"markdown"; link.dataset.search=`${item.title} ${item.folder||""} ${item.type||"markdown"}`.toLowerCase();
    const label=document.createElement("span"); label.textContent=item.title; link.append(label);
    if(item.type==="pdf"){const badge=document.createElement("span");badge.className="file-badge";badge.textContent="PDF";link.append(badge);} return link;
  }

  function buildTree() {
    const home=findPage(state.config.homeDocument); const root={folders:new Map(),files:[]};
    state.manifest.filter(item=>!home||item.path!==home.path).forEach(item=>{const parts=normalize(item.path).split("/");parts.pop();let node=root;parts.forEach(name=>{if(!node.folders.has(name))node.folders.set(name,{folders:new Map(),files:[]});node=node.folders.get(name);});node.files.push(item);});
    const count=node=>node.files.length+[...node.folders.values()].reduce((sum,child)=>sum+count(child),0);
    const render=(node,container)=>{[...node.folders.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).forEach(([name,child])=>{const details=document.createElement("details");details.open=true;const summary=document.createElement("summary");const label=document.createElement("span");label.textContent=name;const total=document.createElement("span");total.className="tree-count";total.textContent=count(child);summary.append(label,total);details.append(summary);const box=document.createElement("div");box.className="tree-files";render(child,box);details.append(box);container.append(details);});node.files.sort((a,b)=>a.title.localeCompare(b.title)).forEach(item=>container.append(makeLink(item)));};
    els.tree.replaceChildren(); if(home)els.tree.append(makeLink(home,true)); render(root,els.tree);
  }

  function setActive(path){document.querySelectorAll(".tree-link").forEach(link=>{const active=normalize(link.dataset.page)===path;link.classList.toggle("active",active);if(active){link.setAttribute("aria-current","page");let parent=link.parentElement;while(parent){if(parent.tagName==="DETAILS")parent.open=true;parent=parent.parentElement;}}else link.removeAttribute("aria-current");});}
  function closeMenu(){els.sidebar.classList.remove("open");els.scrim.hidden=true;els.navToggle.setAttribute("aria-expanded","false");}

  async function openPage(path,{push=true,focus=true,anchor=""}={}) {
    path=normalize(path||state.config.homeDocument);state.current=path;setActive(path);els.loading.hidden=false;els.content.hidden=true;els.error.hidden=true;
    try {
      const item=state.manifest.find(entry=>normalize(entry.path)===path);if(!item)throw new Error("Document is not listed in the content index");const fileUrl=encodedPath(path);
      els.content.classList.toggle("print-checklist",/^06 Play Aids\/(?:Combat Checklist|Movement and Exploration Checklist|Run Cycle Checklist)\.md$/i.test(path));
      els.content.classList.toggle("print-examples",/^06 Play Aids\/Example Sappers\.md$/i.test(path));
      els.content.classList.toggle("print-reference",/^00 Start Here\/Quick Reference\.md$/i.test(path));
      if(item.type==="pdf"||path.toLowerCase().endsWith(".pdf")){const response=await fetch(fileUrl,{method:"HEAD",cache:"no-store"});if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);els.content.innerHTML=`<section class="pdf-viewer"><div class="pdf-heading"><div><p class="eyebrow">PDF DOCUMENT</p><h1>${escapeHtml(item.title)}</h1></div><div class="pdf-actions"><a class="pdf-button" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">Open PDF</a><a class="pdf-button secondary" href="${escapeHtml(fileUrl)}" download>Download</a></div></div><object data="${escapeHtml(fileUrl)}" type="application/pdf"><p>This browser cannot display the PDF here. <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">Open it in a new tab.</a></p></object></section>`;}
      else {const response=await fetch(fileUrl,{cache:"no-store"});if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);els.content.innerHTML=safeRenderedHtml(await response.text());enhanceCallouts(els.content);enhanceImages(els.content);}
      els.content.hidden=false;els.loading.hidden=true;const h1=els.content.querySelector("h1");document.title=`${h1?.textContent||item.title} — ${state.config.siteTitle}`;if(push)history.pushState({page:path},"",`${hrefFor(path)}${anchor}`);const target=anchor?document.getElementById(decodeURIComponent(anchor.replace(/^#/,""))):null;if(target)target.scrollIntoView();else window.scrollTo({top:0,behavior:"instant"});if(focus)els.reader.focus({preventScroll:true});closeMenu();
    } catch(error){els.loading.hidden=true;els.error.hidden=false;els.errorDetail.textContent=`${path} could not be loaded (${error.message}).`;}
  }

  function applyConfig(){els.siteTitle.textContent=state.config.siteTitle;els.siteSubtitle.textContent=state.config.siteSubtitle;els.loading.textContent=state.config.loadingText;els.sidebarNote.textContent=state.config.sidebarNote;els.sidebarNote.hidden=!state.config.sidebarNote;els.brandMark.src=state.config.icon;els.siteIcon.href=state.config.icon;document.querySelectorAll("[data-home-link]").forEach(link=>{link.href=hrefFor(state.config.homeDocument);link.dataset.page=state.config.homeDocument;});els.sourceCredits.replaceChildren();(state.config.attributions||[]).forEach(credit=>{if(!credit.text&&!credit.label&&!credit.suffix)return;const line=document.createElement("p");line.className="source-credit";if(credit.text)line.append(document.createTextNode(credit.text));if(credit.label){if(credit.url){const link=document.createElement("a");link.href=credit.url;link.target="_blank";link.rel=credit.rel||"noopener noreferrer";link.textContent=credit.label;line.append(link);}else line.append(document.createTextNode(credit.label));}if(credit.suffix)line.append(document.createTextNode(credit.suffix));els.sourceCredits.append(line);});els.sourceCredits.hidden=!els.sourceCredits.childElementCount;}
  function applyTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem(state.config.themeStorageKey,theme);}

  document.addEventListener("click",event=>{const link=event.target.closest("a[data-page]");if(!link)return;event.preventDefault();openPage(link.dataset.page,{anchor:new URL(link.href,location.href).hash});});
  window.addEventListener("popstate",()=>openPage(pageFromUrl(),{push:false,anchor:location.hash}));
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeImagePreview();});
  els.navToggle.addEventListener("click",()=>{els.sidebar.classList.add("open");els.scrim.hidden=false;els.navToggle.setAttribute("aria-expanded","true");});els.closeNav.addEventListener("click",closeMenu);els.scrim.addEventListener("click",closeMenu);
  els.theme.addEventListener("click",()=>applyTheme(document.documentElement.dataset.theme==="light"?"dark":"light"));
  els.expand.addEventListener("click",()=>{const details=[...document.querySelectorAll(".tree details")];const open=details.some(d=>!d.open);details.forEach(d=>d.open=open);els.expand.textContent=open?"Collapse all":"Expand all";});
  els.search.addEventListener("input",()=>{const query=els.search.value.trim().toLowerCase();document.querySelectorAll(".tree-link").forEach(link=>link.hidden=!!query&&!link.dataset.search.includes(query));[...document.querySelectorAll(".tree details")].reverse().forEach(details=>{const visible=[...details.querySelectorAll(".tree-link")].some(link=>!link.hidden);details.hidden=!visible;if(query&&visible)details.open=true;});});

  async function init(){
    if(location.protocol==="file:"){els.loading.hidden=true;els.error.hidden=false;els.errorLabel.textContent="LOCAL READER NOT STARTED";els.errorTitle.textContent="Open the site with its local launcher.";els.errorDetail.textContent="Close this tab, then run tools/Open Local Site.cmd. Browsers block Markdown loading when index.html is opened directly.";$(".return-link").hidden=true;return;}
    try{const configResponse=await fetch("assets/site-config.json",{cache:"no-store"});if(configResponse.ok)state.config={...defaults,...await configResponse.json()};applyConfig();applyTheme(localStorage.getItem(state.config.themeStorageKey)||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"));const response=await fetch("assets/content-manifest.json",{cache:"no-store"});if(!response.ok)throw new Error("Content index unavailable. Run tools/Update Content Index.cmd.");state.manifest=await response.json();state.manifest.forEach(item=>{const path=normalize(item.path).toLowerCase();const basename=path.split("/").pop().replace(/\.(?:md|pdf)$/i,"");state.byTitle.set(item.title.toLowerCase(),item);if(!state.byTitle.has(basename))state.byTitle.set(basename,item);state.byPath.set(path,item);state.byPath.set(path.replace(/\.(?:md|pdf)$/i,""),item);});buildTree();await openPage(pageFromUrl(),{push:false,focus:false,anchor:location.hash});}catch(error){els.loading.hidden=true;els.error.hidden=false;els.errorDetail.textContent=error.message;}
  }
  init();
})();
