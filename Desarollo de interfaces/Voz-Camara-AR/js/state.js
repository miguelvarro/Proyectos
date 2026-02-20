// Estado global y acciones (pegamento)
window.AppState = (() => {
  const state = {
    voice: {
      lastTranscript: "",
      lastCommand: "",
      lastParam: "",
      enabled: true,
    },
    hands: {
      enabled: false,
      lastGesture: "—",
    },
    ar: {
      enabled: false,
      objectVisible: true,
      color: "#4CC3D9",
    },
    cameraMode: "NONE", // NONE | HANDS | AR

    // Demo tipo tu ejemplo original
    clientes: [
      { nombre: "Miguel Angel", apellidos: "Vargas Rodriguez", email: "migue@varro.com" },
      { nombre: "Eric", apellidos: "Campos", email: "eric@camp.com" },
      { nombre: "Betlem", apellidos: "Codina", email: "bet@comar.com" }
    ],

    // “Documento abierto” (demo para comandos abrir/cerrar/guardar)
    doc: {
      abierto: false,
      nombre: "clientes",
      cambiosPendientes: false
    }
  };

  // UI helpers
  const ui = {
    setText(id, value) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    },

    renderClientes() {
      const box = document.getElementById("clientesBox");
      if (!box) return;

      let html = `<table class="tbl">
        <tr><th>#</th><th>Nombre</th><th>Apellidos</th><th>Email</th></tr>`;

      state.clientes.forEach((c, i) => {
        html += `<tr>
          <td>${i}</td>
          <td>${c.nombre}</td>
          <td>${c.apellidos}</td>
          <td>${c.email}</td>
        </tr>`;
      });

      html += `</table>`;
      box.innerHTML = html;
    },

    sync() {
      ui.setText("uiLastTranscript", state.voice.lastTranscript || "—");
      ui.setText("uiLastCommand", state.voice.lastCommand || "—");
      ui.setText("uiLastParam", state.voice.lastParam || "—");
      ui.setText("uiLastGesture", state.hands.lastGesture || "—");

      const mode =
        state.cameraMode === "HANDS" ? "MANOS (MediaPipe)" :
        state.cameraMode === "AR" ? "AR (AR.js)" :
        "NINGUNO";
      ui.setText("uiCameraMode", mode);

      const btnHands = document.getElementById("btnHands");
      const btnAR = document.getElementById("btnAR");
      if (btnHands) btnHands.textContent = `🖐️ Manos: ${state.hands.enabled ? "ON" : "OFF"}`;
      if (btnAR) btnAR.textContent = `🥽 AR: ${state.ar.enabled ? "ON" : "OFF"}`;

      ui.renderClientes();
    }
  };

  function safeIndex(i) {
    return Number.isInteger(i) && i >= 0 && i < state.clientes.length;
  }

  function markDirty() {
    state.doc.cambiosPendientes = true;
    ui.sync();
  }

  return {
    state,
    ui,

    setTranscript(text) {
      state.voice.lastTranscript = text;
      ui.sync();
    },

    setCommand(cmd, param = "") {
      state.voice.lastCommand = cmd;
      state.voice.lastParam = param;
      ui.sync();
    },

    setGesture(gesture) {
      state.hands.lastGesture = gesture;
      ui.sync();
    },

    // ===== CRUD demo (como tu ejemplo) =====
    eliminarClientePorIndice(i) {
      if (!safeIndex(i)) return false;
      state.clientes.splice(i, 1);
      markDirty();
      return true;
    },
    
    editarClienteCampo(i, campo, valor) {
	  const camposValidos = ["nombre", "apellidos", "email"];
	  if (!camposValidos.includes(campo)) return { ok: false, msg: "Campo inválido" };

	  if (!(Number.isInteger(i) && i >= 0 && i < state.clientes.length)) {
	    return { ok: false, msg: "Índice inválido" };
	  }

  state.clientes[i][campo] = valor;
  state.doc.cambiosPendientes = true;
  ui.sync();
  return { ok: true, msg: "Editado" };
},


    insertarClienteDemo() {
      const n = state.clientes.length + 1;
      state.clientes.push({
        nombre: `Nuevo ${n}`,
        apellidos: `Apellido ${n}`,
        email: `nuevo${n}@demo.com`
      });
      markDirty();
    },

    actualizarClienteDemo(i) {
      if (!safeIndex(i)) return false;
      state.clientes[i].nombre = state.clientes[i].nombre + " (OK)";
      markDirty();
      return true;
    },

    listarClientes() {
      // En UI ya se muestra siempre; esto es para coherencia con comando "listar"
      console.log("LISTAR clientes:", state.clientes);
      return state.clientes;
    },

    buscarClientePorNombre(keyword) {
      const k = (keyword || "").toLowerCase();
      const res = state.clientes.filter(c =>
        c.nombre.toLowerCase().includes(k) ||
        c.apellidos.toLowerCase().includes(k) ||
        c.email.toLowerCase().includes(k)
      );
      console.log("BUSCAR:", keyword, res);
      return res;
    },

    crearDocumento(nombre) {
      state.doc.abierto = true;
      state.doc.nombre = nombre || "clientes";
      state.doc.cambiosPendientes = false;
      ui.sync();
    },

    abrirDocumento(nombre) {
      state.doc.abierto = true;
      state.doc.nombre = nombre || "clientes";
      ui.sync();
    },

    cerrarDocumento() {
      state.doc.abierto = false;
      ui.sync();
    },

    guardarDocumento() {
      // Demo: marcar cambios como guardados
      state.doc.cambiosPendientes = false;
      ui.sync();
    },

    reiniciarDemo() {
      state.clientes = [
        { nombre: "Miguel Angel", apellidos: "Vargas Rodriguez", email: "migue@varro.com" },
        { nombre: "Eric", apellidos: "Campos", email: "eric@camp.com" },
        { nombre: "Betlem", apellidos: "Codina", email: "bet@comar.com" }
      ];
      state.doc.cambiosPendientes = false;
      ui.sync();
    },

    // ===== Acciones sobre AR =====
    arSetVisible(visible) {
      state.ar.objectVisible = !!visible;
      ui.sync();
      if (window.ARScene) window.ARScene.setObjectVisible(state.ar.objectVisible);
    },

    arSetColor(color) {
      state.ar.color = color;
      ui.sync();
      if (window.ARScene) window.ARScene.setObjectColor(state.ar.color);
    },

    // ===== Modo cámara (exclusivo) =====
    setCameraMode(mode) {
      state.cameraMode = mode;
      ui.sync();
    }
  };
})();

