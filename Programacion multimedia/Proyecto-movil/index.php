<!doctype html>
<html lang="es">
<head>
  <title>Miguefy Mobile</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="static/css/estilos.css">
  <link rel="stylesheet" href="static/css/pantallas.css">
  <link rel="stylesheet" href="static/css/reproductor.css">
  <link rel="stylesheet" href="static/css/mapa.css">

  <!-- Leaflet -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
</head>

<body>
  <div id="app">
    <div id="pantallas" class="screens" data-active="inicio">
      <?php include "./componentes/pantallas/pantalla_inicio.php"; ?>
      <?php include "./componentes/pantallas/pantalla_favoritos.php"; ?>
      <?php include "./componentes/pantallas/pantalla_player.php"; ?>
      <?php include "./componentes/pantallas/pantalla_mapa.php"; ?>
    </div>

    <?php include "./componentes/reproductor/reproductor.php"; ?>
    <?php include "./componentes/footer.php"; ?>
    <?php include "./componentes/templates.php"; ?>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>

  <script src="static/js/pantallas.js"></script>
  <script src="static/js/spotify-clon.js"></script>
  <script src="static/js/player.js"></script>
  <script src="static/js/mapa-poligonos.js"></script>
  <script src="static/js/app.js"></script>
</body>
</html>

