// Palette 
const EMO = [
  { key:"alegria",  label:"Alegría",  color:[255, 215,  64] },
  { key:"tristeza", label:"Tristeza", color:[ 64, 156, 255] },
  { key:"miedo",    label:"Miedo",    color:[170,  80, 220] },
  { key:"ira",      label:"Ira",      color:[255,  80,  80] },
  { key:"asco",     label:"Asco",     color:[ 90, 200,  90] },
  { key:"sorpresa", label:"Sorpresa", color:[255, 170,  70] },
];

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function mixColorsRGB(baseRGB, weights){
  let r=0,g=0,b=0, sum=0;
  for (let i=0;i<baseRGB.length;i++){
    const w = Math.max(0, weights[i]);
    sum += w;
    r += baseRGB[i][0] * w;
    g += baseRGB[i][1] * w;
    b += baseRGB[i][2] * w;
  }
  if (sum <= 0) return [255,255,255];
  return [r/sum, g/sum, b/sum];
}

function bubbleColorFromEmotions(emotions){
  const weights = EMO.map(e => clamp01((Number(emotions?.[e.key] ?? 0)) / 10));
  const rgb = mixColorsRGB(EMO.map(e=>e.color), weights);
  return { rgb };
}

function rgbToCss(rgb, a=1){
  return `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${a})`;
}

function dominantEmotion(emotions){
  let best = { key:null, label:"", color:[255,255,255], v:0 };
  for (const e of EMO){
    const v = Number(emotions?.[e.key] ?? 0);
    if (v > best.v) best = { key:e.key, label:e.label, color:e.color, v };
  }
  return best;
}

// Emotion UI
function setupEmotionUI(){
  for (const e of EMO){
    const slider = document.getElementById(e.key);
    const valSpan = document.getElementById("val_"+e.key);
    const dot = document.getElementById("dot_"+e.key);
    if (!slider || !valSpan || !dot) continue;
    dot.style.background = rgbToCss(e.color, 1);

    const sync = () => { valSpan.textContent = slider.value; };
    slider.addEventListener("input", sync);
    sync();
  }
}

function readEmotionsFromForm(){
  const emotions = {};
  for (const e of EMO){
    const el = document.getElementById(e.key);
    emotions[e.key] = Number(el?.value || 0);
  }
  return emotions;
}

function setEmotionsToForm(emotions){
  for (const e of EMO){
    const slider = document.getElementById(e.key);
    const v = Number(emotions?.[e.key] ?? 0);
    if (slider) slider.value = String(v);
    const valSpan = document.getElementById("val_"+e.key);
    if (valSpan) valSpan.textContent = String(v);
  }
}

function resetEmotions(){
  setEmotionsToForm({});
}

// Voice (webkitSpeechRecognition)
let recognition;
let currentTarget = null;

if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'es-ES';

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (currentTarget) document.getElementById(currentTarget).value = transcript;
  };

  recognition.onerror = (event) => console.error('Error en grabación:', event.error);
} else {
  alert('Tu navegador no soporta la grabación de voz.');
  document.querySelectorAll('.record-button').forEach(b => b.style.display = 'none');
}

document.querySelectorAll('.record-button').forEach(button => {
  button.addEventListener('click', () => {
    currentTarget = button.getAttribute('data-target');
    if (recognition) {
      recognition.start();
      button.textContent = '🛑';
      recognition.onend = () => { button.textContent = '🎤'; };
    }
  });
});

// Modal
const modal = document.getElementById('memoryModal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementById('closeModal');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}

function renderEmotionBadges(emotions){
  const parts = [];
  for (const e of EMO){
    const v = Number(emotions?.[e.key] ?? 0);
    if (v <= 0) continue;
    parts.push(`
      <span class="badge">
        <span class="dot" style="background:${rgbToCss(e.color,1)}"></span>
        ${escapeHtml(e.label)}: ${v}
      </span>
    `);
  }
  if (!parts.length) return `<div class="emo-badges"><span class="badge">Sin emociones registradas</span></div>`;
  return `<div class="emo-badges">${parts.join("")}</div>`;
}

// CRUD buttons state
let selectedParticleId = null;
let isEdit = false;
let editingId = null;

function showMemoryModal(memory) {
  const emoHtml = renderEmotionBadges(memory.emociones || {});
  const idLine = memory._id ? `<p><strong>ID:</strong> <code>${escapeHtml(memory._id)}</code></p>` : "";
  modalContent.innerHTML = `
    ${idLine}
    <p><strong>Ubicación:</strong> ${escapeHtml(memory.ubicacion || 'Sin ubicación')}</p>
    <p><strong>Momento:</strong> ${escapeHtml(memory.momento || 'Sin fecha')}</p>
    <p><strong>Vista:</strong> ${escapeHtml(memory.vista || 'Nada')}</p>
    <p><strong>Oído:</strong> ${escapeHtml(memory.oido || 'Nada')}</p>
    <p><strong>Sentimos:</strong> ${escapeHtml(memory.sentimos || 'Nada')}</p>
    <p><strong>Olemos:</strong> ${escapeHtml(memory.olemos || 'Nada')}</p>
    <p><strong>Sabor:</strong> ${escapeHtml(memory.sabor || 'Nada')}</p>
    <p><strong>Palpamos:</strong> ${escapeHtml(memory.palpamos || 'Nada')}</p>
    <p><strong>Pensamos:</strong> ${escapeHtml(memory.pensamos || 'Nada')}</p>
    <p><strong>Lecciones aprendidas:</strong> ${escapeHtml(memory.lecciones || '')}</p>

    <div style="display:flex; gap:10px; margin-top:12px;">
      <button id="btnEdit" style="flex:1; padding:10px; border-radius:10px; border:none; cursor:pointer;">Editar</button>
      <button id="btnDelete" style="flex:1; padding:10px; border-radius:10px; border:none; cursor:pointer; background:#ff6a00; color:#111; font-weight:800;">Eliminar</button>
    </div>

    ${emoHtml}
  `;

  // wire buttons
  const btnEdit = document.getElementById("btnEdit");
  const btnDelete = document.getElementById("btnDelete");
  if (btnEdit) btnEdit.onclick = () => enterEditMode(memory);
  if (btnDelete) btnDelete.onclick = () => deleteMemory(memory);

  modal.style.display = 'flex';
}

function hideModal(){
  modal.style.display = 'none';
}

closeModal?.addEventListener('click', () => {
  hideModal();
  selectedParticleId = null;
});
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    hideModal();
    selectedParticleId = null;
  }
});

// Canvas + physics
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Mouse (parallax)
const mouse = { x:0, y:0, nx:0, ny:0, active:false };

function updateMouse(e){
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  mouse.nx = (mouse.x / rect.width) * 2 - 1;
  mouse.ny = (mouse.y / rect.height) * 2 - 1;
  mouse.active = true;
}
canvas.addEventListener("mousemove", updateMouse);
canvas.addEventListener("mouseenter", updateMouse);
canvas.addEventListener("mouseleave", ()=>{ mouse.active = false; });

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);

function distance2D(x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1;
  return Math.sqrt(dx*dx + dy*dy);
}

// Tokenization
function tokenize(text){
  return (text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3);
}

function memoryTokens(memory){
  const fields = [
    memory.vista, memory.momento, memory.oido, memory.sentimos,
    memory.olemos, memory.sabor, memory.palpamos, memory.pensamos,
    memory.ubicacion, memory.lecciones
  ];
  return new Set(tokenize(fields.join(" ")));
}

// Search state
const searchInput = document.getElementById("search");
let searchTerms = [];
searchInput?.addEventListener("input", () => {
  const raw = searchInput.value.trim().toLowerCase();
  searchTerms = raw ? raw.split(/\s+/).filter(t => t.length >= 2) : [];

  particles.forEach(p => {
    p.fija = false;
    p.estableFrames = 0;
    p.vx *= 0.2;
    p.vy *= 0.2;
  });
});

function matchCount(tokens, terms){
  if (!terms.length) return 0;
  let c = 0;
  for (const t of terms){
    for (const w of tokens){
      if (w.includes(t)) { c++; break; }
    }
  }
  return c;
}

// Particles + memories
let memories = [];
let particles = [];

// Particle
class Particle{
  constructor(x,y,a, memory){
    this.x = x; this.y = y;

    this.v = 0.45;
    this.vx = Math.cos(a)*this.v;
    this.vy = Math.sin(a)*this.v;

    this.ax = 0; this.ay = 0;
    this.data = memory;
    this.tokens = memoryTokens(memory);

    this.fija = false;
    this.estableFrames = 0;

    this.r = 18 + Math.random()*10;

    const emo = bubbleColorFromEmotions(memory.emociones || {});
    this.tint = emo.rgb;

    // ensure ID
    this.id = (memory._id || (Date.now() + "-" + Math.random().toString(16).slice(2)));
    memory._id = this.id;

    // z depth from emotions
    const intensity = Object.values(memory.emociones || {}).reduce((acc,v)=>acc+(+v||0),0);
    this.z = clamp01(intensity / 70);

    // render coords (for hitTest with parallax)
    this.rx = this.x;
    this.ry = this.y;
  }

  score(){ return matchCount(this.tokens, searchTerms); }
  isSelected(){ return this.id === selectedParticleId; }

  interactions(width,height){
    if (this.fija){ this.ax=0; this.ay=0; return; }

    const searching = searchTerms.length > 0;
    const myScore = this.score();
    const amActive = searching && myScore > 0;

    const distMin        = 62;
    const distRepelMid   = 260;
    const distRepelOuter = 520;

    const kRepelClose = 0.11;
    const kRepelMid   = 0.0018;
    const kRepelOuter = 0.00025;

    const kAttractFar  = 0.00055;
    const kAttractNear = 0.00125;
    const distTarget   = 190;

    const kCenterPull = 0.00095;
    const center = { x: width * 0.5, y: height * 0.5 };

    let fx=0, fy=0;

    if (amActive) {
      const dxC = center.x - this.x;
      const dyC = center.y - this.y;
      fx += dxC * kCenterPull;
      fy += dyC * kCenterPull;
    }

    for (const p of particles){
      if (p === this) continue;

      const d = distance2D(this.x,this.y,p.x,p.y);
      if (d === 0) continue;

      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const ux = dx / d;
      const uy = dy / d;

      if (d < distMin){
        const intensity = (distMin - d) * kRepelClose;
        fx -= ux * intensity;
        fy -= uy * intensity;
        continue;
      }

      if (d < distRepelMid){
        const intensity = (distRepelMid - d) * kRepelMid;
        fx -= ux * intensity;
        fy -= uy * intensity;
      } else if (d < distRepelOuter){
        const intensity = (distRepelOuter - d) * kRepelOuter;
        fx -= ux * intensity;
        fy -= uy * intensity;
      }

      if (!searching) continue;

      const otherScore = p.score();
      const otherActive = otherScore > 0;

      if (amActive && otherActive){
        const weight = 0.75 + 0.20 * Math.min(6, Math.min(myScore, otherScore));
        fx += ux * (kAttractFar * weight * d);
        fy += uy * (kAttractFar * weight * d);

        const delta = d - distTarget;
        fx += ux * (delta * kAttractNear * weight);
        fy += uy * (delta * kAttractNear * weight);
      }
    }

    const maxForce = 0.11;
    const mag = Math.sqrt(fx*fx + fy*fy);
    if (mag > maxForce){
      fx = fx/mag*maxForce;
      fy = fy/mag*maxForce;
    }

    this.ax = fx;
    this.ay = fy;
  }

  move(width,height){
    if (this.fija) return;

    this.vx += this.ax;
    this.vy += this.ay;

    const searching = searchTerms.length > 0;
    const friction = searching ? 0.90 : 0.925;
    this.vx *= friction;
    this.vy *= friction;

    this.x += this.vx;
    this.y += this.vy;

    const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    const force = Math.sqrt(this.ax*this.ax + this.ay*this.ay);
    if (!searching && speed < 0.02 && force < 0.002){
      this.estableFrames++;
      if (this.estableFrames > 60){
        this.fija = true;
        this.vx=0; this.vy=0;
      }
    } else {
      this.estableFrames = 0;
    }

    const pad = this.r + 10;
    const rebound = -0.5;

    if (this.x > width - pad){ this.x = width - pad; this.vx *= rebound; }
    if (this.x < pad){ this.x = pad; this.vx *= rebound; }
    if (this.y > height - pad){ this.y = height - pad; this.vy *= rebound; }
    if (this.y < pad){ this.y = pad; this.vy *= rebound; }
  }

  drawBubble(){
    const depth = clamp01(this.z ?? 0.5);

    // Parallax  + coords render reales para click
    const par = mouse.active ? (0.15 + depth * 0.85) : 0;
    const px = mouse.nx * 18 * par;
    const py = mouse.ny * 12 * par;

    const x = this.x + px;
    const y = this.y + py;
    this.rx = x;
    this.ry = y;

    // Depth sizing + blur
    const scale = 0.72 + depth * 0.55;
    const r = this.r * scale;

    const blurPx = Math.max(0.2, (1 - depth) * 3.2);

    ctx.save();
    ctx.filter = `blur(${blurPx.toFixed(2)}px)`;

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(x + r*0.25, y + r*0.40, r*0.95, r*0.75, 0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
    ctx.restore();

    // Base glass
    const glass = ctx.createRadialGradient(x - r*0.35, y - r*0.35, r*0.2, x, y, r);
    glass.addColorStop(0, "rgba(255,255,255,0.65)");
    glass.addColorStop(0.35, "rgba(255,255,255,0.18)");
    glass.addColorStop(1, "rgba(255,255,255,0.08)");

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = glass;
    ctx.fill();

    // Inner emotion tint
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    const inner = ctx.createRadialGradient(x - r*0.95, y - r*0.95, r*0.95, x, y, r);
    inner.addColorStop(0, rgbToCss(this.tint, 1.0));
    inner.addColorStop(1, rgbToCss(this.tint, 0.95));
    ctx.fillStyle = inner;
    ctx.fill();
    ctx.restore();

    // Border highlight
    const score = this.score();
    const highlighted = this.isSelected() || score > 0;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.lineWidth = highlighted ? 8.8 : 1.4;
    ctx.strokeStyle = highlighted ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.65)";
    ctx.stroke();

    // Glint
    ctx.beginPath();
    ctx.arc(x - r*0.25, y - r*0.25, r*0.25, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,0.60)";
    ctx.fill();

    // Inner ring
    ctx.beginPath();
    ctx.arc(x, y, r*0.82, 0, Math.PI*2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.stroke();

    ctx.restore();
  }

  hitTest(mx,my){
    const d = distance2D(mx,my,this.rx ?? this.x, this.ry ?? this.y);
    return d <= this.r + 10;
  }
}

function drawConnections(){
  if (searchTerms.length === 0) return;

  const maxLinkDist = 360;

  for (let i=0;i<particles.length;i++){
    const a = particles[i];
    const sa = a.score();
    if (sa <= 0) continue;

    for (let j=i+1;j<particles.length;j++){
      const b = particles[j];
      const sb = b.score();
      if (sb <= 0) continue;

      const ax = a.rx ?? a.x, ay = a.ry ?? a.y;
      const bx = b.rx ?? b.x, by = b.ry ?? b.y;

      const d = distance2D(ax,ay,bx,by);
      if (d > maxLinkDist) continue;

      const relevance = Math.min(10, sa + sb);
      const alpha = Math.max(0.25, 0.84 * (1 - d/maxLinkDist));
      const w = 1 + Math.min(8, relevance * 0.35);

      ctx.strokeStyle = `rgba(147,112,219,${alpha})`;
      ctx.lineWidth = w;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }
}

function loop(){
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0,0,w,h);

  for (const p of particles) p.interactions(w,h);
  for (const p of particles) p.move(w,h);

  drawConnections();
  for (const p of particles) p.drawBubble();

  requestAnimationFrame(loop);
}

// click to select + open modal
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (let i = particles.length - 1; i >= 0; i--){
    if (particles[i].hitTest(mx,my)){
      selectedParticleId = particles[i].id;
      showMemoryModal(particles[i].data);
      return;
    }
  }
  selectedParticleId = null;
});

// Load + Save + CRUD PHP
const memoryForm = document.getElementById('memoryForm');

function normalizeMemory(m){
  if (!m._id) m._id = (Date.now() + "-" + Math.random().toString(16).slice(2));

  if (!m.emociones) {
    m.emociones = {};
    for (const e of EMO) m.emociones[e.key] = 0;
  } else {
    for (const e of EMO) {
      if (m.emociones[e.key] === undefined) m.emociones[e.key] = 0;
      m.emociones[e.key] = Number(m.emociones[e.key] || 0);
    }
  }

  if (m.lecciones === undefined || m.lecciones === null) m.lecciones = "";
  return m;
}

async function apiAction(action, payload){
  const r = await fetch("guardar_recuerdos.php", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ action, ...payload })
  });

  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("Respuesta NO JSON:", text);
    throw new Error("Servidor devolvió NO-JSON. Mira consola (probable error PHP).");
  }
}

function loadMemories(){
  return fetch("guardar_recuerdos.php")
    .then(r => r.json())
    .then(list => {
      memories = Array.isArray(list) ? list.map(normalizeMemory) : [];
      const rect = canvas.getBoundingClientRect();
      particles = memories.map(m => new Particle(
        Math.random() * (rect.width  - 80) + 40,
        Math.random() * (rect.height - 80) + 40,
        Math.random() * Math.PI * 2,
        m
      ));
    });
}

function setFormMode(editMode){
  isEdit = !!editMode;
  const btn = memoryForm?.querySelector('button[type="submit"]');
  if (btn) btn.textContent = isEdit ? "Guardar cambios" : "Guardar Recuerdo";
}

function fillFormFromMemory(m){
  document.getElementById('vista').value = m.vista || "";
  document.getElementById('momento').value = m.momento || "";
  document.getElementById('oido').value = m.oido || "";
  document.getElementById('sentimos').value = m.sentimos || "";
  document.getElementById('olemos').value = m.olemos || "";
  document.getElementById('sabor').value = m.sabor || "";
  document.getElementById('palpamos').value = m.palpamos || "";
  document.getElementById('pensamos').value = m.pensamos || "";
  document.getElementById('ubicacion').value = m.ubicacion || "";
  const lec = document.getElementById('lecciones');
  if (lec) lec.value = m.lecciones || "";
  setEmotionsToForm(m.emociones || {});
}

function exitEditMode(){
  editingId = null;
  setFormMode(false);
  memoryForm.reset();
  resetEmotions();
}

function enterEditMode(memory){
  if (!memory?._id) {
    alert("Este recuerdo no tiene _id (debería tenerlo).");
    return;
  }
  editingId = memory._id;
  setFormMode(true);
  fillFormFromMemory(memory);
  hideModal();
}

async function deleteMemory(memory){
  if (!memory?._id) return alert("No existe _id en este recuerdo.");
  if (!confirm("¿Eliminar este recuerdo?")) return;

  try {
    const data = await apiAction("delete", { id: memory._id });
    if (!data?.success) {
      alert(data?.error || "No se pudo eliminar.");
      return;
    }

    memories = memories.filter(m => m._id !== memory._id);
    particles = particles.filter(p => p.id !== memory._id);

    hideModal();
    selectedParticleId = null;

  } catch (err){
    console.error("Error al eliminar:", err);
    alert(String(err.message || err));
  }
}

memoryForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const emotions = readEmotionsFromForm();

  const memory = normalizeMemory({
    _id: (isEdit && editingId) ? editingId : undefined,
    vista: document.getElementById('vista').value,
    momento: document.getElementById('momento').value,
    oido: document.getElementById('oido').value,
    sentimos: document.getElementById('sentimos').value,
    olemos: document.getElementById('olemos').value,
    sabor: document.getElementById('sabor').value,
    palpamos: document.getElementById('palpamos').value,
    pensamos: document.getElementById('pensamos').value,
    ubicacion: document.getElementById('ubicacion').value,
    lecciones: document.getElementById('lecciones') ? document.getElementById('lecciones').value : "",
    emociones: emotions
  });

  try {
    if (isEdit) {
      const data = await apiAction('update', { memory });
      if (!data?.success) {
        alert(data?.error || "No se pudo guardar.");
        return;
      }

      const idx = memories.findIndex(m => m._id === memory._id);
      if (idx >= 0) memories[idx] = memory;

      const p = particles.find(p => p.id === memory._id);
      if (p){
        p.data = memory;
        p.tokens = memoryTokens(memory);
        p.tint = bubbleColorFromEmotions(memory.emociones || {}).rgb;

        const intensity = Object.values(memory.emociones || {}).reduce((acc,v)=>acc+(+v||0),0);
        p.z = clamp01(intensity / 70);
        p.fija = false;
        p.estableFrames = 0;
      }

      exitEditMode();
    } else {
      const data = await apiAction('create', { memory });
      if (!data?.success) {
        alert(data?.error || "No se pudo guardar.");
        return;
      }
      if (data.id) memory._id = data.id;

      memories.push(memory);

      const rect = canvas.getBoundingClientRect();
      particles.push(new Particle(
        Math.random() * (rect.width  - 80) + 40,
        Math.random() * (rect.height - 80) + 40,
        Math.random() * Math.PI * 2,
        memory
      ));

      particles.forEach(p => { p.fija = false; p.estableFrames = 0; });

      memoryForm.reset();
      resetEmotions();
    }
  } catch (err){
    console.error("Error al guardar:", err);
    alert(String(err.message || err));
  }
});

// Boot
document.addEventListener("DOMContentLoaded", () => {
  setupEmotionUI();
  resizeCanvas();
  loadMemories()
    .then(() => requestAnimationFrame(loop))
    .catch(err => console.error("Error al cargar recuerdos:", err));
});

