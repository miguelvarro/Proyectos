export const NodeTypes = {
  trigger: {
    label: "trigger",
    inputs: [],
    outputs: [{ id: "out1", label: "out1" }],
    defaults: { payload: { hello: "world" } }
  },
  http: {
    label: "http",
    inputs: [{ id: "in1", label: "in1" }],
    outputs: [{ id: "out1", label: "out1" }],
    defaults: { url: "https://example.com", method: "GET", headers: {}, body: "" }
  },
  transform: {
    label: "transform",
    inputs: [{ id: "in1", label: "in1" }],
    outputs: [{ id: "out1", label: "out1" }],
    defaults: { add: {}, pick: [] }
  },
  log: {
    label: "log",
    inputs: [{ id: "in1", label: "in1" }],
    outputs: [{ id: "out1", label: "out1" }],
    defaults: { prefix: "" }
  },
  merge: {
    label: "merge",
    inputs: [{ id: "in1", label: "in1" }, { id: "in2", label: "in2" }],
    outputs: [{ id: "out1", label: "out1" }],
    defaults: {}
  },
  generic: {
    label: "generic",
    inputs: [{ id: "in1", label: "in1" }],
    outputs: [{ id: "out1", label: "out1" }],
    defaults: {}
  }
};

function typeDef(type){
  return NodeTypes[type] ?? NodeTypes.generic;
}

export const Store = {
  state: {
    nodes: {}, // id -> {id,type,name,x,y,config,ports:{inputs,outputs}}
    edges: [], // {id, from:{nodeId,port}, to:{nodeId,port}}
  },

  newId(prefix="id"){
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  },

  normalizeNode(node){
    const def = typeDef(node.type);
    node.ports = {
      inputs: def.inputs,
      outputs: def.outputs
    };
    node.config = node.config ?? {};
    const d = def.defaults ?? {};
    for (const k of Object.keys(d)){
      if (node.config[k] === undefined) node.config[k] = d[k];
    }
    return node;
  },

  addNode(partial){
    const id = this.newId("node");
    const node = {
      id,
      type: partial?.type ?? "generic",
      name: partial?.name ?? "Nodo",
      x: partial?.x ?? 80,
      y: partial?.y ?? 80,
      config: partial?.config ?? {}
    };
    this.state.nodes[id] = this.normalizeNode(node);
    return this.state.nodes[id];
  },

  updateNode(id, patch){
    const n = this.state.nodes[id];
    if (!n) return;
    Object.assign(n, patch);

    if (patch?.type){
      this.normalizeNode(n);

      const inIds = new Set(n.ports.inputs.map(p => p.id));
      const outIds = new Set(n.ports.outputs.map(p => p.id));
      this.state.edges = this.state.edges.filter(e => {
        if (e.from.nodeId === id && !outIds.has(e.from.port)) return false;
        if (e.to.nodeId === id && !inIds.has(e.to.port)) return false;
        return true;
      });
    }
  },

  deleteNode(id){
    if (!this.state.nodes[id]) return;
    delete this.state.nodes[id];
    this.state.edges = this.state.edges.filter(e => e.from.nodeId !== id && e.to.nodeId !== id);
  },

  canConnect({ from, to }){
    const occupied = this.state.edges.some(e => e.to.nodeId === to.nodeId && e.to.port === to.port);
    if (occupied) return { ok:false, reason:"Ese input ya tiene un cable." };
    if (from.nodeId === to.nodeId) return { ok:false, reason:"No puedes conectar un nodo a sí mismo." };
    return { ok:true };
  },

  addEdge(edge){
    const check = this.canConnect(edge);
    if (!check.ok) return { ok:false, reason: check.reason };

    const id = this.newId("edge");
    const newEdge = { id, ...edge };

    const exists = this.state.edges.some(e =>
      e.from.nodeId === newEdge.from.nodeId &&
      e.from.port === newEdge.from.port &&
      e.to.nodeId === newEdge.to.nodeId &&
      e.to.port === newEdge.to.port
    );
    if (!exists) this.state.edges.push(newEdge);
    return { ok:true, edge: newEdge };
  },

  deleteEdge(edgeId){
    this.state.edges = this.state.edges.filter(e => e.id !== edgeId);
  },

  serialize(){
    return JSON.parse(JSON.stringify(this.state));
  },

  hydrate(data){
    this.state.nodes = data?.nodes ?? {};
    this.state.edges = data?.edges ?? [];

    for (const id of Object.keys(this.state.nodes)){
      this.normalizeNode(this.state.nodes[id]);
    }
  }
};

