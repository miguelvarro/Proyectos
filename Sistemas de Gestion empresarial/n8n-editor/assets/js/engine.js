// assets/js/engine.js
// - validateWorkflow
// - runWorkflow({ store, log })
// Incluye: puertos múltiples, validación básica, ejecución + HTTP via proxy PHP.

export function validateWorkflow(store){
  const nodes = store.state.nodes;
  const edges = store.state.edges;

  const errors = [];
  const ids = Object.keys(nodes);

  if (ids.length === 0) errors.push("No hay nodos.");

  const triggers = ids.filter(id => nodes[id].type === "trigger");
  if (triggers.length === 0) errors.push("Debe existir al menos un nodo trigger.");

  // index de puertos
  const inPorts = new Map();
  const outPorts = new Map();
  for (const id of ids){
    inPorts.set(id, new Set((nodes[id].ports?.inputs ?? []).map(p => p.id)));
    outPorts.set(id, new Set((nodes[id].ports?.outputs ?? []).map(p => p.id)));
  }

  // adjacency + indeg
  const adj = new Map(ids.map(id => [id, []]));
  const indeg = new Map(ids.map(id => [id, 0]));

  // inputs connected count
  const inputCount = new Map();
  for (const id of ids){
    const m = new Map();
    for (const p of (nodes[id].ports?.inputs ?? [])) m.set(p.id, 0);
    inputCount.set(id, m);
  }

  for (const e of edges){
    if (!nodes[e.from.nodeId]) { errors.push(`Edge desde nodo inexistente: ${e.from.nodeId}`); continue; }
    if (!nodes[e.to.nodeId])   { errors.push(`Edge hacia nodo inexistente: ${e.to.nodeId}`); continue; }

    if (!outPorts.get(e.from.nodeId)?.has(e.from.port))
      errors.push(`Output inválido: ${e.from.nodeId}.${e.from.port}`);

    if (!inPorts.get(e.to.nodeId)?.has(e.to.port))
      errors.push(`Input inválido: ${e.to.nodeId}.${e.to.port}`);


    const m = inputCount.get(e.to.nodeId);
    if (m?.has(e.to.port)) m.set(e.to.port, (m.get(e.to.port) ?? 0) + 1);

    adj.get(e.from.nodeId).push(e.to.nodeId);
    indeg.set(e.to.nodeId, (indeg.get(e.to.nodeId) ?? 0) + 1);

    if (e.from.nodeId === e.to.nodeId) errors.push("No se permite conectar un nodo a sí mismo.");
  }

  for (const id of ids){
    const n = nodes[id];
    if (n.type === "trigger") continue;
    for (const p of (n.ports?.inputs ?? [])){
      const c = inputCount.get(id)?.get(p.id) ?? 0;
      if (c === 0) errors.push(`Input sin conectar: ${n.name} (${id}).${p.id}`);
      if (c > 1) errors.push(`Input con múltiples cables: ${n.name} (${id}).${p.id}`);
    }
  }

  // ciclo
  const color = new Map(ids.map(id => [id, 0]));
  const dfs = (u) => {
    color.set(u, 1);
    for (const v of adj.get(u) || []){
      if (color.get(v) === 1) return true;
      if (color.get(v) === 0 && dfs(v)) return true;
    }
    color.set(u, 2);
    return false;
  };

  for (const t of triggers){
    if (color.get(t) === 0 && dfs(t)){
      errors.push("El grafo tiene un ciclo (bucle).");
      break;
    }
  }

  // alcanzabilidad desde triggers
  const reachable = new Set();
  const stack = [...triggers];
  while (stack.length){
    const u = stack.pop();
    if (reachable.has(u)) continue;
    reachable.add(u);
    for (const v of adj.get(u) || []) stack.push(v);
  }
  for (const id of ids){
    if (!reachable.has(id)) errors.push(`Nodo no alcanzable desde trigger: ${nodes[id].name} (${id})`);
  }

  return { ok: errors.length === 0, errors };
}

export async function runWorkflow({ store, log }){
  const v = validateWorkflow(store);
  if (!v.ok){
    log("❌ Validación fallida:");
    v.errors.forEach(e => log(`- ${e}`));
    throw new Error("Workflow inválido");
  }

  const nodes = store.state.nodes;
  const edges = store.state.edges;
  const ids = Object.keys(nodes);

  // incoming: nodeId -> portId -> [{fromId, fromPort}]
  const incoming = new Map();
  const outgoing = new Map();
  for (const id of ids){
    const inMap = new Map();
    for (const p of (nodes[id].ports?.inputs ?? [])) inMap.set(p.id, []);
    incoming.set(id, inMap);
    outgoing.set(id, []);
  }

  for (const e of edges){
    incoming.get(e.to.nodeId).get(e.to.port).push({ fromId: e.from.nodeId, fromPort: e.from.port });
    outgoing.get(e.from.nodeId).push({ toId: e.to.nodeId, toPort: e.to.port, fromPort: e.from.port });
  }

  // indeg 
  const indeg = new Map(ids.map(id => [id, 0]));
  for (const e of edges) indeg.set(e.to.nodeId, indeg.get(e.to.nodeId) + 1);

  const q = [];
  for (const id of ids){
    if (nodes[id].type === "trigger" || indeg.get(id) === 0) q.push(id);
  }

  // outputs por nodo/puerto
  const outData = {}; // nodeId -> { outPortId: value }

  function buildInputs(nodeId){
    const m = incoming.get(nodeId);
    const obj = {};
    for (const [inPort, arr] of m.entries()){
      const src = arr[0]; 
      obj[inPort] = src ? (outData[src.fromId]?.[src.fromPort] ?? null) : null;
    }
    return obj;
  }

  async function execNode(node){
    const inputs = buildInputs(node.id);
    log(`▶ ${node.name} (${node.type}) inputs=${safe(inputs)}`);

    let result;
    switch(node.type){
      case "trigger":
        result = node.config?.payload ?? { startedAt: new Date().toISOString() };
        break;
      case "http":
        result = await execHttpProxy(node, inputs, log);
        break;
      case "transform":
        result = execTransform(node, inputs);
        break;
      case "merge":
        result = execMerge(node, inputs);
        break;
      case "log":
        result = execLog(node, inputs, log);
        break;
      default:
        result = inputs?.in1 ?? inputs;
        break;
    }

    const outs = {};
    for (const p of (node.ports?.outputs ?? [])){
      outs[p.id] = result;
    }
    outData[node.id] = outs;

    log(`✅ ${node.name} out=${safe(outs)}`);
  }

  const executed = new Set();
  let safety = 0;

  while (q.length){
    const id = q.shift();
    const node = nodes[id];
    if (!node || executed.has(id)) continue;

    if (node.type !== "trigger" && (node.ports?.inputs?.length ?? 0) > 0){
      const inputs = buildInputs(id);
      const ready = node.ports.inputs.every(p => inputs[p.id] !== null);
      if (!ready){
        q.push(id);
        safety++;
        if (safety > ids.length * 10){
          throw new Error("Ejecución bloqueada (dependencias no resueltas).");
        }
        continue;
      }
    }

    await execNode(node);
    executed.add(id);

    for (const o of outgoing.get(id) || []){
      indeg.set(o.toId, indeg.get(o.toId) - 1);
      q.push(o.toId);
    }
  }

  log(`🏁 Fin. Ejecutados: ${executed.size}/${ids.length}`);
  return { outData, executed: [...executed] };
}

// -------------------- executors --------------------
function template(str, ctx){
  return String(str).replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const path = expr.trim().split(".");
    let cur = ctx;
    for (const k of path) cur = (cur && typeof cur === "object") ? cur[k] : undefined;
    return cur === undefined ? "" : String(cur);
  });
}

async function execHttpProxy(node, inputs, log){
  const url = template(node.config?.url ?? "", inputs);
  const method = (node.config?.method ?? "GET").toUpperCase();
  const timeoutMs = Number(node.config?.timeoutMs ?? 8000);

  let headers = node.config?.headers ?? {};
  if (typeof headers === "string"){
    try { headers = JSON.parse(headers); } catch { headers = {}; }
  }

  let body = node.config?.body ?? "";
  body = template(body, inputs);

  try{
    const res = await fetch("api/http_proxy.php", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ url, method, headers, body, timeoutMs })
    });

    const data = await res.json();
    if (!data?.ok) log(`❌ HTTP proxy: ${data?.error ?? "request failed"}`);

    return {
      ok: !!data?.ok,
      status: data?.status ?? 0,
      url,
      headers: data?.headers ?? {},
      data: data?.data
    };
  }catch(e){
    log(`❌ HTTP error: ${String(e?.message ?? e)}`);
    return { ok:false, url, error: String(e?.message ?? e) };
  }
}

function execTransform(node, inputs){
  const base = inputs?.in1 ?? {};
  const add = node.config?.add ?? {};
  const pick = Array.isArray(node.config?.pick) ? node.config.pick : [];

  let out = (base && typeof base === "object") ? deepClone(base) : { value: base };
  if (add && typeof add === "object") out = { ...out, ...add };

  if (pick.length){
    const only = {};
    for (const k of pick){
      if (out[k] !== undefined) only[k] = out[k];
    }
    out = only;
  }
  out._transformed = true;
  return out;
}

function execMerge(node, inputs){
  return {
    in1: inputs.in1 ?? null,
    in2: inputs.in2 ?? null,
    mergedAt: new Date().toISOString()
  };
}

function execLog(node, inputs, log){
  const prefix = node.config?.prefix ?? "";
  log(`📝 ${prefix}${safe(inputs.in1)}`);
  return inputs.in1;
}

function safe(v){
  try { return JSON.stringify(v); } catch { return String(v); }
}
function deepClone(v){
  try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); }
}

