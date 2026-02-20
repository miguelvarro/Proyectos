<?php
?><!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Editor de nodos (tipo n8n) - MVP+</title>
  <link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">Node Editor</div>

    <div class="actions">
      <button id="btnAdd" class="btn">+ Nodo</button>
      <button id="btnRun" class="btn btn--accent">Run</button>
      <button id="btnSave" class="btn">Guardar</button>
      <button id="btnLoad" class="btn">Cargar</button>
      <span id="status" class="status"></span>
    </div>
  </header>

  <div class="layout">
    <main class="workspace" id="workspace">
      <!-- Capa de conexiones -->
      <svg class="wires" id="wires" aria-hidden="true"></svg>

      <!-- Capa de nodos  -->
      <div class="canvas" id="canvas"></div>

      <div class="hint">
        <div><b>Zoom</b>: rueda | <b>Pan</b>: mantener <b>Space</b> + arrastrar</div>
        <div><b>Conectar</b>: click output → click input | <b>Borrar cable</b>: click en el cable</div>
      </div>
    </main>

    <aside class="sidebar" id="sidebar">
      <div class="sidebar__head">
        <div class="sidebar__title">Propiedades</div>
        <button id="btnDeleteNode" class="btn btn--danger" disabled>Eliminar nodo</button>
      </div>

      <div class="sidebar__body">
        <div class="field">
          <label>ID</label>
          <input id="propId" type="text" disabled value="(ninguno)" />
        </div>

        <div class="field">
          <label>Nombre</label>
          <input id="propName" type="text" placeholder="Nombre del nodo" disabled />
        </div>

        <div class="field">
          <label>Tipo</label>
          <select id="propType" disabled>
            <option value="trigger">trigger</option>
            <option value="http">http</option>
            <option value="transform">transform</option>
            <option value="log">log</option>
            <option value="generic">generic</option>
          </select>
        </div>

        <div class="field">
          <label>Config (JSON)</label>
          <textarea id="propConfig" rows="8" placeholder='{"url":"https://..."}' disabled></textarea>
          <div class="small" id="propConfigHelp"></div>
        </div>

        <div class="divider"></div>

        <div class="sidebar__title">Ejecución</div>
        <div class="small">Salida del motor (logs):</div>
        <pre class="log" id="runLog">(sin ejecutar)</pre>
      </div>
    </aside>
  </div>

  <script type="module" src="assets/js/app.js"></script>
</body>
</html>

