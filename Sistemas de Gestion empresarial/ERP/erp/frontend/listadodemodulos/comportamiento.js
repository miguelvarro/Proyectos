const ul = document.querySelector("#listadodemodulos nav ul");
const section = document.querySelector("#listadodemodulos section");
const modSearch = document.querySelector("#modSearch");

let categorias = [];
let apps = [];

let categoriaActiva = null;
let textoBusqueda = "";

// Helper: construir ruta backend 
function backendUrl(file) {
  const p = window.location.pathname;

  let m = p.match(/^(.*\/erp)\/frontend\//);
  if (m) return m[1] + "/backend/" + file;

  m = p.match(/^(.*)\/frontend\//);
  if (m) return m[1] + "/backend/" + file;

  return "../backend/" + file;
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  try { return JSON.parse(text); }
  catch (e) {
    console.error("Respuesta no-JSON desde:", url, text.slice(0, 200));
    throw e;
  }
}

function renderCategorias(){
  ul.innerHTML = "";

  // “Todas”
  const liAll = document.createElement("li");
  liAll.textContent = "Todas";
  liAll.dataset.id = "";
  liAll.className = "catItem";
  liAll.onclick = () => {
    categoriaActiva = null;
    setActiveCategory("");
    renderApps();
  };
  ul.appendChild(liAll);

  categorias.forEach(cat => {
    const li = document.createElement("li");
    li.textContent = cat.nombre ?? "Categoría";
    li.dataset.id = String(cat.Identificador ?? "");
    li.className = "catItem";
    li.onclick = () => {
      categoriaActiva = Number(cat.Identificador);
      setActiveCategory(li.dataset.id);
      renderApps();
    };
    ul.appendChild(li);
  });

  setActiveCategory("");
}

function setActiveCategory(idStr){
  document.querySelectorAll("#listadodemodulos nav ul li.catItem").forEach(li => {
    li.classList.toggle("active", li.dataset.id === idStr);
  });
}

function matchBusqueda(app){
  if (!textoBusqueda) return true;
  const n = (app.nombre ?? "").toLowerCase();
  const d = (app.descripcion ?? "").toLowerCase();
  return n.includes(textoBusqueda) || d.includes(textoBusqueda);
}

function matchCategoria(app){
  if (!categoriaActiva) return true;
  return Number(app.categoria_id) === Number(categoriaActiva);
}

function renderApps(){
  section.innerHTML = "";

  const filtradas = apps.filter(a => matchBusqueda(a) && matchCategoria(a));

  if (!filtradas.length){
    section.innerHTML = `<div class="p" style="grid-column:1/-1;">No hay módulos para ese filtro.</div>`;
    return;
  }

  filtradas.forEach(aplicacion => {
    const icono = aplicacion.icono ?? "📦";
    const nombre = aplicacion.nombre ?? "Sin nombre";
    const desc = aplicacion.descripcion ?? "";

    const articulo = document.createElement("article");
    articulo.innerHTML = `
      <div class="logo">${icono}</div>
      <div class="texto">
        <h3>${escapeHtml(nombre)}</h3>
        <p>${escapeHtml(desc)}</p>
        <button>Instalar</button>
      </div>
    `;

    articulo.querySelector("button").onclick = () => {
      if ((nombre || "").toLowerCase().includes("kanban")) {
        const p = window.location.pathname;
        let base = p.match(/^(.*\/erp)\/frontend\//)?.[1] || p.match(/^(.*)\/frontend\//)?.[1] || "..";
        window.location.href = base + "/frontend/kanban/index.php";
      } else {
        alert("Demo: módulo '" + nombre + "' (no implementado).");
      }
    };

    section.appendChild(articulo);
  });
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Search
modSearch?.addEventListener("input", () => {
  textoBusqueda = (modSearch.value || "").trim().toLowerCase();
  renderApps();
});

// Init
(async function(){
  categorias = await fetchJson(backendUrl("listadodemodulos.php?ruta=categorias"));
  apps = await fetchJson(backendUrl("listadodemodulos.php?ruta=aplicaciones"));

  renderCategorias();
  renderApps();
})();

