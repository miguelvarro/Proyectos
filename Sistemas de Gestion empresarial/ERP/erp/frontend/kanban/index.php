<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kanban</title>

  <link rel="stylesheet" href="../comun/estilo.css">
  <style><?php include "estilo.css"; ?></style>
</head>
<body>

<div class="topbar">
  <div class="inner">
    <div class="brand">
      <span class="dot"></span>
      <span>Kanban</span>
    </div>

    <div class="nav" style="gap:10px;">
      <a href="../index.php">Inicio</a>

      <input id="searchKanban" class="input" placeholder="Buscar tarjetas..." style="width:260px; padding:10px 12px;">

      <button class="btn ghost" id="btnExport" type="button">Exportar</button>
      <button class="btn ghost" id="btnImport" type="button">Importar</button>

      <button class="btn" id="btnGuardar" type="button">Guardar</button>
      <span id="estadoGuardar" style="color:var(--muted); font-weight:800;"></span>
    </div>
  </div>
</div>

<div class="container">
  <div class="card">
    <div class="p">Arrastra tarjetas entre columnas. Puedes buscar, exportar/importar y se auto-guarda.</div>
    <div id="kanban"></div>
  </div>
</div>

<!-- input oculto para import -->
<input id="fileImport" type="file" accept="application/json" style="display:none" />

<script><?php include "comportamiento.js"; ?></script>
</body>
</html>

