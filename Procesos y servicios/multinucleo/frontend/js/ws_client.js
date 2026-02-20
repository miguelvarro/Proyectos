export class WSClient {
  constructor(url, onEvent){
    this.url = url;
    this.onEvent = onEvent;
    this.ws = null;
  }

  connect(){
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(e);

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          this.onEvent?.(msg);
        } catch {
          this.onEvent?.({ type:"error", error:"invalid_json_from_server", raw: ev.data });
        }
      };

      ws.onclose = () => {
        this.onEvent?.({ type:"close" });
      };
    });
  }

  send(obj){
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(obj));
  }
}

