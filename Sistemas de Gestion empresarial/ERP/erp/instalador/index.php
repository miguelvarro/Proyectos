<?php
/*  -----------------------------------------------------------
    Instalador MySQL - Español
    - Pide host, puerto, base de datos, usuario y contraseña.
    - Verificar conexión y acceso a la BD ).
    - Importa el SQL desde ../basededatos/instalacion.sql
    - Manejo básico de DELIMITER para dumps con procedimientos.
    -----------------------------------------------------------  */

declare(strict_types=1);
ini_set('display_errors', '1');
error_reporting(E_ALL);
@set_time_limit(0);
@ini_set('memory_limit', '1024M');

function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function bytes_human(int $bytes): string {
    $u = ['B','KB','MB','GB','TB'];
    $i = 0;
    while ($bytes >= 1024 && $i < count($u)-1) { $bytes = (int)($bytes / 1024); $i++; }
    return number_format($bytes, 0, ',', '.') . ' ' . $u[$i];
}

function normalize_sql(string $sql): string {
    // Manejo ligero de DELIMITER 
    $lines = preg_split("/(\r\n|\r|\n)/", $sql);
    $out = [];
    foreach ($lines as $line) {
        if (preg_match('/^\s*DELIMITER\s+(.+)\s*$/i', $line)) {
            continue;
        }
        $out[] = $line;
    }
    $sql2 = implode("\n", $out);

    foreach (['//', '$$'] as $d) {
        $sql2 = preg_replace('/\s*'.preg_quote($d,'/').'\s*(\r?\n)/', ";\n", $sql2);
        $sql2 = preg_replace('/'.preg_quote($d,'/').'\s*$/', ';', $sql2);
    }
    return $sql2;
}

function import_sql(mysqli $db, string $sql): array {
    $errores = [];
    $ok = 0;

    if (!$db->multi_query($sql)) {
        $errores[] = "Fallo al ejecutar multi_query: " . $db->error;
        return [$ok, $errores];
    }

    do {
        if ($result = $db->store_result()) { $result->free(); }
        $ok++;
        if (!$db->more_results()) { break; }
        if (!$db->next_result()) {
            $errores[] = $db->error ?: 'Error MySQL desconocido';
            break;
        }
    } while (true);

    return [$ok, $errores];
}

$RUTA_SQL_RELATIVA = '../basededatos/instalacion.sql';
$RUTA_SQL = realpath($RUTA_SQL_RELATIVA);
$existeSQL = ($RUTA_SQL !== false && is_file($RUTA_SQL) && is_readable($RUTA_SQL));
$tamanoSQL = $existeSQL ? (int)filesize($RUTA_SQL) : 0;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$isPost = ($method === 'POST');
?>
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Instalador · MySQL</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
        margin: 0; padding: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
        background:
            radial-gradient(1200px 600px at 10% -10%, #7aa7ff22, transparent 60%),
            radial-gradient(1000px 500px at 120% 10%, #00c2ff22, transparent 60%),
            linear-gradient(180deg, #f7f7fb, #eef1f7);
        min-height: 100vh;
        color: #1e1f22;
    }
    .wrap { max-width: 880px; margin: 4rem auto; padding: 0 1rem; }
    .card {
        background: rgba(255,255,255,.8);
        backdrop-filter: blur(6px);
        border: 1px solid rgba(0,0,0,.08);
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,.08);
        overflow: hidden;
    }
    .header {
        padding: 1.25rem 1.5rem;
        background: linear-gradient(135deg, #0d6efd, #5b9dff);
        color: #fff;
    }
    .header h1 { margin: 0; font-size: 1.4rem; letter-spacing: .3px; }
    .content { padding: 1.5rem; }
    .desc { color: #444; margin: .25rem 0 1rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    label { font-weight: 600; font-size: .95rem; display: block; margin-bottom: .35rem; color: #2b2d31; }
    input[type=text], input[type=password] {
        width: 100%; padding: .75rem .9rem; border-radius: 12px;
        border: 1px solid #cfd6e4; outline: none; background: #fff;
        transition: box-shadow .2s, border-color .2s, transform .05s;
    }
    input:focus { border-color: #6aa7ff; box-shadow: 0 0 0 4px #6aa7ff33; }
    .btn {
        display: inline-flex; align-items: center; gap: .5rem;
        margin-top: 1rem; padding: .85rem 1.1rem; border: 0; border-radius: 12px;
        background: linear-gradient(135deg,#0d6efd,#3a86ff); color: #fff; font-weight: 700;
        cursor: pointer; box-shadow: 0 6px 16px rgba(13,110,253,.35);
        transition: transform .05s ease-in-out, box-shadow .2s;
    }
    .btn:hover { box-shadow: 0 10px 24px rgba(13,110,253,.45); }
    .btn:active { transform: translateY(1px); }
    .muted { color: #5b5e66; }
    .badge {
        display: inline-block; padding: .25rem .6rem; border-radius: 999px;
        font-size: .8rem; background: #eef4ff; color: #0d6efd; border: 1px solid #d8e6ff;
    }
    .sql-info { margin: .5rem 0 1rem; font-size: .95rem; }
    .log {
        margin-top: 1rem; padding: 1rem; border-radius: 12px;
        background: #0b12201a; border: 1px solid #cfd6e4; white-space: pre-wrap;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: .92rem;
    }
    .ok { color: #1e7e34; font-weight: 700; }
    .err { color: #b22222; font-weight: 700; }
    .note { font-size: .9rem; color: #3c3f44; }
    .footer { padding: 1rem 1.5rem; border-top: 1px solid rgba(0,0,0,.06); background: #fafbfe; color: #555; font-size: .92rem; }
    .steps { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .step { padding: .35rem .6rem; border-radius: 8px; background: #f1f5ff; color: #21427a; border: 1px solid #d9e5ff; font-size: .85rem; }
    @media (max-width: 640px){ .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="header">
      <h1>Instalador de Base de Datos</h1>
    </div>
    <div class="content">
      <p class="desc">Este asistente importará el archivo SQL de instalación en una base de datos MySQL existente usando un usuario con permisos suficientes.</p>

      <div class="steps">
        <span class="step">1) Introduce credenciales</span>
        <span class="step">2) Verificación de conexión</span>
        <span class="step">3) Importación del esquema/datos</span>
        <span class="step">4) Resultado</span>
      </div>

      <div class="sql-info">
        <strong>Archivo SQL:</strong>
        <span class="badge"><?= $existeSQL ? 'Encontrado' : 'No encontrado' ?></span><br>
        Ruta: <code><?= e($RUTA_SQL_RELATIVA) ?></code>
        <?php if ($existeSQL): ?>
            <span class="muted"> · Tamaño: <?= e(bytes_human($tamanoSQL)) ?></span>
        <?php endif; ?>
      </div>

      <?php if (!$isPost): ?>
        <form method="post" autocomplete="off">
          <div class="grid">
            <div>
              <label for="host">Host MySQL</label>
              <input id="host" name="host" type="text" value="localhost" required>
            </div>
            <div>
              <label for="port">Puerto (opcional)</label>
              <input id="port" name="port" type="text" inputmode="numeric" pattern="\d*" placeholder="3306">
            </div>
          </div>

          <div class="grid" style="margin-top:.5rem">
            <div>
              <label for="dbname">Nombre de la base de datos</label>
              <input id="dbname" name="dbname" type="text" required>
            </div>
            <div>
              <label for="user">Usuario</label>
              <input id="user" name="user" type="text" required>
            </div>
          </div>

          <div style="margin-top:.5rem">
            <label for="pass">Contraseña</label>
            <input id="pass" name="pass" type="password">
          </div>

          <p class="note">La base de datos y el usuario deben existir previamente, y el usuario debe tener permisos para crear tablas, índices y, si procede, triggers/procedimientos.</p>

          <button class="btn" type="submit" <?php if (!$existeSQL) echo 'disabled'; ?>>
            <span>🚀 Ejecutar instalación</span>
          </button>
          <?php if (!$existeSQL): ?>
            <p class="err" style="margin-top:.5rem;">No se puede continuar: el archivo SQL no está disponible o no es legible.</p>
          <?php endif; ?>
        </form>
      <?php else: ?>
        <div class="log"><?php
          // --- Procesar POST ---
          $host   = trim($_POST['host'] ?? 'localhost');
          $port   = trim($_POST['port'] ?? '');
          $dbname = trim($_POST['dbname'] ?? '');
          $user   = trim($_POST['user'] ?? '');
          $pass   = $_POST['pass'] ?? '';

          $errores = [];
          if ($host === '')   $errores[] = "El host es obligatorio.";
          if ($dbname === '') $errores[] = "El nombre de la base de datos es obligatorio.";
          if ($user === '')   $errores[] = "El usuario es obligatorio.";
          if (!$existeSQL)    $errores[] = "No se encuentra el archivo SQL en '". $RUTA_SQL_RELATIVA ."'.";
          if ($errores) {
              foreach ($errores as $err) echo "• <span class=\"err\">".e($err)."</span>\n";
              echo "</div>\n<p><a href=\"".e($_SERVER['PHP_SELF'])."\">Volver</a></p>";
          } else {
              $sqlRaw = @file_get_contents($RUTA_SQL);
              if ($sqlRaw === false || $sqlRaw === '') {
                  echo "• <span class=\"err\">No se pudo leer el archivo SQL o está vacío.</span>\n";
                  echo "</div>\n<p><a href=\"".e($_SERVER['PHP_SELF'])."\">Volver</a></p>";
              } else {
                  echo "• Conectando a MySQL…\n";
                  $portNum = ($port !== '' && ctype_digit($port)) ? (int)$port : (int)(ini_get("mysqli.default_port") ?: 3306);
                  mysqli_report(MYSQLI_REPORT_OFF);
                  $mysqli = @new mysqli($host, $user, $pass, '', $portNum);

                  if ($mysqli->connect_errno) {
                      echo "• <span class=\"err\">Conexión fallida:</span> ".e($mysqli->connect_error)."\n";
                      echo "</div>\n<p><a href=\"".e($_SERVER['PHP_SELF'])."\">Volver</a></p>";
                  } else {
                      echo "• <span class=\"ok\">Conectado</span> a ".e($host).":".e((string)$portNum)."\n";

                      if (!$mysqli->select_db($dbname)) {
                          echo "• <span class=\"err\">No se puede acceder a la base de datos \"".e($dbname)."\":</span> ".e($mysqli->error)."\n";
                          echo "</div>\n<p><a href=\"".e($_SERVER['PHP_SELF'])."\">Volver</a></p>";
                          $mysqli->close();
                      } else {
                          echo "• Base de datos seleccionada: <strong>".e($dbname)."</strong>\n";
                          $mysqli->set_charset('utf8mb4');

                          echo "• Leyendo y normalizando SQL (".e(bytes_human((int)strlen($sqlRaw))).")…\n";
                          $sqlNorm = normalize_sql($sqlRaw);

                          echo "• Ejecutando importación…\n";
                          [$count, $errs] = import_sql($mysqli, $sqlNorm);

                          if ($errs) {
                              echo "• <span class=\"err\">Importación con errores</span>\n";
                              foreach ($errs as $er) echo "  - <span class=\"err\">".e($er)."</span>\n";
                          } else {
                              echo "• <span class=\"ok\">Importación completada</span> (bloques procesados: ".e((string)$count).")\n";
                          }

                          $mysqli->close();
                          echo "• Finalizado.\n";
                          echo "</div>\n<p><a href=\"".e($_SERVER['PHP_SELF'])."\">Volver</a></p>";
                      }
                  }
              }
          }
        ?></div>
      <?php endif; ?>
    </div>
    <div class="footer">
      <span class="muted">Consejo: crea primero la BD y el usuario (con permisos) y luego ejecuta este instalador.</span>
    </div>
  </div>
</div>
</body>
</html>

