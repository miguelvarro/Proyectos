<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ERP Miguel</title>
  <link rel="stylesheet" href="comun/estilo.css">
</head>
<body>

<div class="topbar">
  <div class="inner">
    <div class="brand">
      <span class="dot"></span>
      <span>ERP Miguel</span>
    </div>
    <div class="nav">
      <a href="iniciarsesion/index.html">Login</a>
      <a href="listadodemodulos/index.php">Módulos</a>
      <a href="kanban/index.php">Kanban</a>
    </div>
  </div>
</div>

<div class="container">
  <!-- Hero -->
  <div class="card" style="padding:22px;">
    <div class="h1" style="margin-bottom:6px;">Panel principal</div>
    <div class="p" style="max-width:70ch;">
      Accede a los módulos del ERP o entra directamente al tablero Kanban.
    </div>
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top: 12px;">
      <a class="btn" href="listadodemodulos/index.php">Ver módulos</a>
      <a class="btn ghost" href="kanban/index.php">Abrir Kanban</a>
    </div>
  </div>

  <div style="height:16px"></div>

  <!-- Listado dentro de card para que no “flote” -->
  <div class="card">
    <div class="h2" style="margin-bottom:10px;">Módulos</div>
    <?php include "listadodemodulos/index.php"; ?>
  </div>
</div>

</body>
</html>

