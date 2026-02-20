const chat = document.querySelector("#chat");
const q = document.querySelector("#q");
const send = document.querySelector("#send");
const debug = document.querySelector("#debug");
const historyEl = document.querySelector("#history");

const HISTORY_KEY = "iaSqlHistory";
const HISTORY_MAX = 20;

function bubble(text, who="bot"){
  const d = document.createElement("div");
  d.className = "bubble " + (who === "me" ? "me" : "bot");
  d.innerHTML = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function tableFromRows(rows){
  if (!rows || !rows.length) return "<div class='muted'>Sin filas.</div>";
  const cols = Object.keys(rows[0]);
  let html = "<table><thead><tr>" + cols.map(c=>`<th>${c}</th>`).join("") + "</tr></thead><tbody>";
  html += rows.map(r => "<tr>" + cols.map(c=>`<td>${r[c] ?? ""}</td>`).join("") + "</tr>").join("");
  html += "</tbody></table>";
  return html;
}

function loadHistory(){
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(h) ? h : [];
  } catch { return []; }
}

function saveHistory(arr){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, HISTORY_MAX)));
}

function addToHistory(text){
  const h = loadHistory();
  const cleaned = text.trim();
  const next = [cleaned, ...h.filter(x => x !== cleaned)].slice(0, HISTORY_MAX);
  saveHistory(next);
  renderHistory();
}

function renderHistory(){
  const h = loadHistory();
  historyEl.innerHTML = "";

  if (!h.length){
    historyEl.innerHTML = "<div class='muted'>Sin historial todavía.</div>";
    return;
  }

  h.forEach(item => {
    const chip = document.createElement("div");
    chip.className = "hchip";
    chip.title = item;
    chip.textContent = item;
    chip.onclick = () => {
      q.value = item;
      ask();
    };
    historyEl.appendChild(chip);
  });
}

// Botones rápidos
document.querySelectorAll(".qbtn").forEach(b => {
  b.addEventListener("click", () => {
    const text = b.dataset.q || "";
    q.value = text;
    ask();
  });
});

async function ask(){
  const text = q.value.trim();
  if(!text) return;

  bubble(text, "me");
  addToHistory(text);
  q.value = "";

  const r = await fetch("sql_router.php", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ question: text })
  });

  const j = await r.json();
  debug.textContent = JSON.stringify(j, null, 2);

  if(!j.ok){
    bubble("❌ " + (j.error || "Error"), "bot");
    return;
  }

  bubble("<b>SQL:</b> <code>" + j.sql + "</code>" + tableFromRows(j.rows), "bot");
}

send.addEventListener("click", ask);
q.addEventListener("keydown", (e)=>{ if(e.key==="Enter") ask(); });

renderHistory();
bubble("Hola 👋 Usa los botones rápidos o pregúntame por usuarios / aplicaciones / categorías.", "bot");

