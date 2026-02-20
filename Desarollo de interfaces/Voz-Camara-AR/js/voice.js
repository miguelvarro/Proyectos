window.Voice = (() => {
  let rec = null;
  let voices = [];
  let ultimoTexto = ""; // para "repetir"

  function pickVoice() {
    const v = voices.find(v => /es-|Spanish/i.test(v.lang)) || voices[0];
    return v || null;
  }

  function loadVoices() {
    voices = speechSynthesis.getVoices();
  }

  function speak(text) {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = (v && v.lang) || "es-ES";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  function clean(text) {
    return (text || "")
      .trim()
      .toLowerCase()
      .replace(/[.,;:!?]/g, "");
  }

  function words(text) {
    return clean(text).split(/\s+/).filter(Boolean);
  }

  function word(text, idx) {
    const parts = words(text);
    return parts[idx] || "";
  }

  function palabraANumero(p) {
    switch (p) {
      case "cero": return 0;
      case "uno": return 1;
      case "dos": return 2;
      case "tres": return 3;
      case "cuatro": return 4;
      case "cinco": return 5;
      case "seis": return 6;
      case "siete": return 7;
      case "ocho": return 8;
      case "nueve": return 9;
      case "diez": return 10;
      default:
        if (/^\d+$/.test(p)) return parseInt(p, 10);
        return null;
    }
  }

  function colorNameToHex(name) {
    switch (name) {
      case "rojo": return "#EF2D5E";
      case "verde": return "#00C853";
      case "azul": return "#2979FF";
      case "amarillo": return "#FFC400";
      case "blanco": return "#FFFFFF";
      default: return null;
    }
  }


  function normalizarOperacion(op) {
    switch (op) {
      case "borra":
      case "borrar":
      case "quita":
      case "quitar":
        return "eliminar";

      case "mete":
      case "añade":
      case "agrega":
      case "agregar":
        return "insertar";

      case "muestra":
      case "enseña":
        return "mostrar";

      case "oculta":
        return "ocultar";

      case "inicia":
      case "encender":
      case "enciende":
        return "activar";

      case "apaga":
      case "detener":
      case "detiene":
        return "desactivar";

      case "lista":
        return "listar";

      case "busca":
        return "buscar";

      case "help":
        return "ayuda";

      default:
        return op;
    }
  }

  function ejecutarOperacion(operacionRaw, parametro, fraseCompleta) {
    const S = window.AppState;
    const operacion = normalizarOperacion(operacionRaw);

    S.setCommand(operacion, parametro);


    switch (operacion) {

      // ===== CRUD demo =====
      case "leer":
        speak("Leyendo");
        console.log("LEER:", S.state.clientes);
        break;

      case "listar":
        speak("Listando");
        S.listarClientes();
        break;

      case "insertar":
        speak("Insertando");
        S.insertarClienteDemo();
        break;
        
        case "editar": {
  // Formato:
  // "editar uno nombre miguel angel"
  // "editar dos apellidos garcia lopez"
  // "editar tres email pepe@demo.com"

  const partes = words(fraseCompleta); // ej: ["editar","uno","nombre","miguel","angel"]
  const idxWord = partes[1] || "";
  const campo = partes[2] || "";
  const valor = partes.slice(3).join(" ").trim();

  const idx = palabraANumero(idxWord);

  if (idx === null) {
    speak("Dime qué número editar");
    break;
  }
  if (!campo) {
    speak("Dime qué campo editar: nombre, apellidos o email");
    break;
  }
  if (!valor) {
    speak("Dime el nuevo valor");
    break;
  }

  const res = window.AppState.editarClienteCampo(idx, campo, valor);
  speak(res.ok ? "Cliente editado" : res.msg);
  break;
}


      case "actualizar": {
        const idx = palabraANumero(parametro);
        if (idx === null) {
          speak("Dime qué número actualizar");
        } else {
          const ok = S.actualizarClienteDemo(idx);
          speak(ok ? "Actualizado" : "No existe ese índice");
        }
        break;
      }

      case "eliminar": {
        const idx = palabraANumero(parametro);
        if (idx === null) {
          speak("Dime qué número eliminar");
        } else {
          const ok = S.eliminarClientePorIndice(idx);
          speak(ok ? "Eliminado" : "No existe ese índice");
        }
        break;
      }

      // ===== Documentos =====
      case "crear":
        // "crear clientes" / "crear documento"
        speak("Creando");
        S.crearDocumento(parametro || "clientes");
        break;

      case "abrir":
        speak("Abriendo");
        S.abrirDocumento(parametro || "clientes");
        break;

      case "cerrar":
        speak("Cerrando");
        S.cerrarDocumento();
        break;

      case "guardar":
        speak("Guardando");
        S.guardarDocumento();
        break;

      // ===== Buscar =====
      case "buscar": {
        // "buscar eric" -> busca por nombre/apellido/email
        const k = parametro || "";
        if (!k) {
          speak("Dime qué palabra buscar");
        } else {
          const res = S.buscarClientePorNombre(k);
          speak(res.length ? `Encontrados ${res.length}` : "No he encontrado nada");
        }
        break;
      }

      // ===== Control módulos =====
      case "activar":
        if (parametro === "manos") {
          speak("Activando manos");
          window.App?.enableHands(true);
        } else if (parametro === "ar") {
          speak("Activando realidad aumentada");
          window.App?.enableAR(true);
        } else if (parametro === "voz") {
          speak("Voz activada");
          S.state.voice.enabled = true;
          S.ui.sync();
        } else {
          speak("Activar qué");
        }
        break;

      case "desactivar":
        if (parametro === "manos") {
          speak("Desactivando manos");
          window.App?.enableHands(false);
        } else if (parametro === "ar") {
          speak("Desactivando realidad aumentada");
          window.App?.enableAR(false);
        } else if (parametro === "voz") {
          speak("Voz desactivada");
          S.state.voice.enabled = false;
          S.ui.sync();
        } else {
          speak("Desactivar qué");
        }
        break;

      // ===== Control AR =====
      case "mostrar":
        if (parametro === "cubo") {
          speak("Mostrando cubo");
          S.arSetVisible(true);
        } else {
          speak("Mostrar qué");
        }
        break;

      case "ocultar":
        if (parametro === "cubo") {
          speak("Ocultando cubo");
          S.arSetVisible(false);
        } else {
          speak("Ocultar qué");
        }
        break;

      case "color": {
        const hex = colorNameToHex(parametro);
        if (!hex) {
          speak("Color no reconocido");
        } else {
          speak(`Cambiando color a ${parametro}`);
          S.arSetColor(hex);
        }
        break;
      }

      // ===== Navegación / utilidades =====
      case "siguiente":
        speak("Siguiente");
        console.log("SIGUIENTE (demo)");
        break;

      case "anterior":
        speak("Anterior");
        console.log("ANTERIOR (demo)");
        break;

      case "reiniciar":
      case "reset":
        speak("Reiniciando");
        window.App?.enableHands(false);
        window.App?.enableAR(false);
        S.setCameraMode("NONE");
        S.reiniciarDemo();
        break;

      case "repetir":
        speak(ultimoTexto || "No hay nada que repetir");
        break;

      case "parar":
      case "stop":
        speak("Parando cámara");
        window.App?.enableHands(false);
        window.App?.enableAR(false);
        S.setCameraMode("NONE");
        break;

      case "ayuda":
        speak("Comandos: leer, listar, insertar, actualizar uno, eliminar cero, buscar eric, activar manos, activar ar, mostrar cubo, color rojo, parar, reiniciar.");
        break;

      default:

        speak(fraseCompleta || "No he entendido");
        console.log("Operación no reconocida:", operacion, "param:", parametro, "frase:", fraseCompleta);
        break;
    }
  }

  function init() {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition no disponible en este navegador.");
      return;
    }

    rec = new SpeechRecognition();
    rec.lang = "es-ES";
    rec.interimResults = false;

    rec.onresult = function (e) {
      const reconocido = e.results[0][0].transcript;
      ultimoTexto = reconocido;

      window.AppState.setTranscript(reconocido);


      const operacion = word(reconocido, 0);
      const parametro = word(reconocido, 1);


      if (window.AppState.state.voice.enabled === false && normalizarOperacion(operacion) !== "activar") {
        return;
      }

      ejecutarOperacion(operacion, parametro, reconocido);
    };

let retryCount = 0;
let lastStartAt = 0;

rec.onerror = (ev) => {
  console.warn("Error SpeechRecognition:", ev);

  const code = ev.error || "unknown";
  window.AppState.setCommand("ERROR", code);


  if (code === "not-allowed" || code === "service-not-allowed") {
    window.Voice.speak("Permiso de micrófono denegado.");
    return;
  }

  if (code === "no-speech") {
    return;
  }

  if (code === "audio-capture") {
    window.Voice.speak("No encuentro micrófono.");
    return;
  }

  if (code === "network") {
    const now = Date.now();
    if (now - lastStartAt < 800) return;


    if (retryCount < 2) {
      retryCount++;
      setTimeout(() => {
        try {
          lastStartAt = Date.now();
          rec.start();
        } catch (e) {}
      }, 600);
    } else {
      window.Voice.speak("Error de red en el reconocimiento. Prueba en Chrome y en localhost.");
    }
    return;
  }


  window.Voice.speak("Error en el reconocimiento.");
};

rec.onend = () => {

  retryCount = 0;
};

  }

  function start() {
    if (!rec) return;
    try { rec.start(); } catch (e) {}
  }

  return { init, start, speak };
})();

