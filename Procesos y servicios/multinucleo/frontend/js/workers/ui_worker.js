// Worker para no bloquear la UI con parseo pesado o formateo.
self.onmessage = (e) => {
  const { type, payload } = e.data || {};
  if (type === "formatLog") {
    let s = "";
    const items = payload.items || [];
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      s += `[${m.ts}] ${m.text}\n`;
    }
    self.postMessage({ type:"logText", text: s });
  }
};

