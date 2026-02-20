<?php
// Si se abre directamente, $standalone = true.
// Si se incluye desde otro PHP, $standalone = false.
$standalone = (basename($_SERVER['SCRIPT_NAME']) === 'index.php')
  && (strpos($_SERVER['SCRIPT_NAME'], '/listadodemodulos/') !== false);
?>

<?php if ($standalone): ?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Módulos</title>
  <link rel="stylesheet" href="../comun/estilo.css">
  <style><?php include "estilo.css"; ?></style>
</head>
<body>

<div class="topbar">
  <div class="inner">
    <div class="brand">
      <span class="dot"></span>
      <span>Módulos</span>
    </div>
    <div class="nav">
      <a href="../index.php">Inicio</a>
      <a href="../kanban/index.php">Kanban</a>
    </div>
  </div>
</div>

<div class="container">
  <div class="card">
  <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">
  <div>
    <div class="h2" style="margin:0;">Módulos</div>
    <div class="p" style="margin:0;">Filtra por categoría o busca por nombre/descripcion.</div>
  </div>

  <input id="modSearch" class="input" placeholder="Buscar módulos..." style="width:280px;">
</div>

<div id="listadodemodulos">
  <nav><ul></ul></nav>
  <section></section>
</div>

<script>
  <?php include "comportamiento.js"; ?>
</script>

<?php else: ?>
<style><?php include "estilo.css"; ?></style>
<?php endif; ?>

<div id="listadodemodulos">
  <nav><ul></ul></nav>
  <section></section>
</div>

<script>
  <?php include "comportamiento.js"; ?>
</script>

<?php if ($standalone): ?>
  </div>
</div>
</body>
</html>
<?php endif; ?>

