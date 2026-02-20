export function enableNodeDrag(nodeEl, { getPos, setPos, getScale, onDragEnd }){
  const header = nodeEl.querySelector(".node__header");
  if (!header) return;

  let dragging = false;
  let startMouse = { x: 0, y: 0 };
  let startPos = { x: 0, y: 0 };

  function onDown(ev){
    dragging = true;
    header.style.cursor = "grabbing";
    startMouse = { x: ev.clientX, y: ev.clientY };
    const p = getPos?.();
    startPos = { x: p?.x ?? 0, y: p?.y ?? 0 };
    ev.preventDefault();
    ev.stopPropagation();
  }

  function onMove(ev){
    if (!dragging) return;

    const scale = Number(getScale?.() ?? 1) || 1;
    const dxScreen = ev.clientX - startMouse.x;
    const dyScreen = ev.clientY - startMouse.y;

    const dx = dxScreen / scale;
    const dy = dyScreen / scale;

    setPos?.({ x: startPos.x + dx, y: startPos.y + dy });
  }

  function onUp(){
    if (!dragging) return;
    dragging = false;
    header.style.cursor = "grab";
    onDragEnd?.();
  }

  header.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

