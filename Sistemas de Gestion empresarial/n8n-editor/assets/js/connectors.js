let pending = null; 
let ghostPath = null;

const PORT_RADIUS = 7;     
const PORT_BORDER = 2;     
const SNAP_PAD = 1;        

function svgRect(svg){
  return svg.getBoundingClientRect();
}

function portCenterSvg(portEl, wiresSvg){
  const r = portEl.getBoundingClientRect();
  const s = svgRect(wiresSvg);
  return {
    x: (r.left + r.width / 2) - s.left,
    y: (r.top  + r.height / 2) - s.top,
  };
}

function mouseSvg(ev, wiresSvg){
  const s = svgRect(wiresSvg);
  return { x: ev.clientX - s.left, y: ev.clientY - s.top };
}

function snapToPortEdge(center, toward){
  const vx = toward.x - center.x;
  const vy = toward.y - center.y;
  const len = Math.hypot(vx, vy) || 1;

  const offset = PORT_RADIUS + PORT_BORDER + SNAP_PAD;
  return {
    x: center.x + (vx / len) * offset,
    y: center.y + (vy / len) * offset,
  };
}

function cubicPath(a, b){
  const dx = Math.max(60, Math.abs(b.x - a.x) * 0.5);
  const c1 = { x: a.x + dx, y: a.y };
  const c2 = { x: b.x - dx, y: b.y };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

export function initConnectors({ wiresSvg, canvasEl, store, renderWires }){
  function clearPending(){
    if (pending?.fromPortEl) pending.fromPortEl.classList.remove("port--active");
    pending = null;
    removeGhost();
  }

  function ensureGhost(){
    if (ghostPath) return ghostPath;
    ghostPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    ghostPath.classList.add("wire", "wire--ghost");
    wiresSvg.appendChild(ghostPath);
    return ghostPath;
  }

  function removeGhost(){
    if (ghostPath && ghostPath.parentNode) ghostPath.parentNode.removeChild(ghostPath);
    ghostPath = null;
  }

  function onPortPointerDown(ev){
    ev.preventDefault();
    ev.stopPropagation();

    const portEl = ev.currentTarget;
    const nodeEl = portEl.closest(".node");
    if (!nodeEl) return;

    const nodeId = nodeEl.dataset.nodeId;
    const kind = portEl.dataset.kind; 
    const portName = portEl.dataset.port;

    if (kind === "out"){
      clearPending();
      pending = { fromNodeId: nodeId, fromPort: portName, fromPortEl: portEl };
      portEl.classList.add("port--active");
      return;
    }

    if (kind === "in" && pending){
      const res = store.addEdge({
	  from: { nodeId: pending.fromNodeId, port: pending.fromPort },
	  to:   { nodeId, port: portName }
	});
	if (!res.ok){
	  console.warn(res.reason);
	}

      clearPending();
      renderWires();
    }
  }

  function onMouseMove(ev){
    if (!pending) return;

    const fromC = portCenterSvg(pending.fromPortEl, wiresSvg);
    const m = mouseSvg(ev, wiresSvg);

    const from = snapToPortEdge(fromC, m);

    const path = ensureGhost();
    path.setAttribute("d", cubicPath(from, m));
  }

  function onCanvasPointerDown(ev){
    if (ev.target === canvasEl) clearPending();
  }

  document.addEventListener("mousemove", onMouseMove);
  canvasEl.addEventListener("pointerdown", onCanvasPointerDown);

  return {
    bindNodePorts(nodeEl){
      nodeEl.querySelectorAll(".port").forEach(p =>
        p.addEventListener("pointerdown", onPortPointerDown)
      );
    },
    clearPending
  };
}

export function drawAllWires({ wiresSvg, store, onWireClick }){
  wiresSvg.querySelectorAll("path.wire:not(.wire--ghost)").forEach(p => p.remove());

  for (const e of store.state.edges){
    const fromNode = document.querySelector(`.node[data-node-id="${e.from.nodeId}"]`);
    const toNode   = document.querySelector(`.node[data-node-id="${e.to.nodeId}"]`);
    if (!fromNode || !toNode) continue;

    const fromPort = fromNode.querySelector(`.port[data-kind="out"][data-port="${e.from.port}"]`);
    const toPort   = toNode.querySelector(`.port[data-kind="in"][data-port="${e.to.port}"]`);
    if (!fromPort || !toPort) continue;

    const aC = portCenterSvg(fromPort, wiresSvg);
    const bC = portCenterSvg(toPort, wiresSvg);

    const a = snapToPortEdge(aC, bC);
    const b = snapToPortEdge(bC, aC);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("wire");
    path.setAttribute("d", cubicPath(a, b));
    path.dataset.edgeId = e.id;

    path.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onWireClick?.(e.id);
    });

    wiresSvg.appendChild(path);
  }
}

