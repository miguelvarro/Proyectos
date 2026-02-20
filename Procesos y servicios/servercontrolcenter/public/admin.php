<?php
declare(strict_types=1);
session_start();


$CONFIG = require __DIR__ . '/../config/config.php';
$USERS = $CONFIG['users'] ?? ['miguel' => '1234'];

const ALLOW_DANGEROUS_ACTIONS = false;

// Rutas
$ROOT_DIR       = $CONFIG['root_dir'];
$SCRIPTS_DIR    = $CONFIG['scripts_dir'];
$DATA_DIR       = $CONFIG['data_dir'];
$LOG_DIR        = $CONFIG['log_dir'];
$ADMIN_LOG_FILE = $LOG_DIR . DIRECTORY_SEPARATOR . 'admin.log';

$MONITOR_SCRIPT = $CONFIG['monitor_script'];
$RUNNER_SCRIPT  = $CONFIG['runner_script'];  
$PID_FILE       = $CONFIG['pid_file'];
$DEFAULT_INTERVAL_SECONDS = (int)($CONFIG['interval_seconds'] ?? 2);

// Helpers
function h(?string $s): string {
  return htmlspecialchars($s ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function ensure_dir(string $path): void {
  if (!is_dir($path)) @mkdir($path, 0775, true);
}
function log_admin(string $file, string $msg): void {
  ensure_dir(dirname($file));
  $line = sprintf("[%s] %s\n", date('Y-m-d H:i:s'), $msg);
  @file_put_contents($file, $line, FILE_APPEND);
}
function require_basic_auth(array $USERS): void {
  $user = $_SERVER['PHP_AUTH_USER'] ?? '';
  $pass = $_SERVER['PHP_AUTH_PW'] ?? '';
  if ($user === '' || !isset($USERS[$user]) || $USERS[$user] !== $pass) {
    header('WWW-Authenticate: Basic realm="Server Control Center"');
    header('HTTP/1.0 401 Unauthorized');
    echo "Auth required.";
    exit;
  }
}
function os_family(): string {
  return defined('PHP_OS_FAMILY') ? PHP_OS_FAMILY : 'Unknown';
}
function run_cmd(string $cmd): array {
  $out = [];
  $code = 0;
  @exec($cmd . ' 2>&1', $out, $code);
  if (count($out) > 2000) $out = array_slice($out, 0, 2000);
  return [$code, implode("\n", $out)];
}
function disk_summary(string $path): array {
  $total = @disk_total_space($path);
  $free  = @disk_free_space($path);
  if ($total === false || $free === false) return ['total' => 'N/D', 'free' => 'N/D', 'used' => 'N/D'];
  $used = $total - $free;
  $fmt = fn($b) => number_format($b / (1024**3), 2) . " GB";
  return ['total' => $fmt($total), 'free' => $fmt($free), 'used' => $fmt($used)];
}
function get_uptime_string(): string {
  $os = os_family();
  if ($os === 'Windows') return "Uptime: N/D (Windows: desactivado para evitar bloqueo)";
  if (is_file('/proc/uptime')) {
    $raw = trim((string)@file_get_contents('/proc/uptime'));
    $sec = (int)floor((float)explode(' ', $raw)[0]);
    $d = intdiv($sec, 86400); $sec %= 86400;
    $h = intdiv($sec, 3600);  $sec %= 3600;
    $m = intdiv($sec, 60);
    return "Uptime: {$d}d {$h}h {$m}m";
  }
  return "Uptime no disponible";
}

function is_monitor_running(string $pidFile): bool {
  if (!is_file($pidFile)) return false;
  $pid = trim((string)@file_get_contents($pidFile));
  if ($pid === '' || !ctype_digit($pid)) return false;
  $pidInt = (int)$pid;

  $os = os_family();
  if ($os === 'Windows') {
    [$code, $out] = run_cmd('tasklist /FI "PID eq ' . $pidInt . '"');
    return $code === 0 && stripos($out, (string)$pidInt) !== false;
  }
  [$code, $out] = run_cmd('kill -0 ' . $pidInt);
  return $code === 0;
}

function launch_runner_background(string $runnerScript, string $cmd, string $logDir): array {
  ensure_dir($logDir);

  if (!is_file($runnerScript)) {
    return [false, "No se encuentra monitor_runner.py en: $runnerScript"];
  }

  $runner = escapeshellarg($runnerScript);
  $os = os_family();
  $ts = date('Ymd_His');
  $outLog = $logDir . DIRECTORY_SEPARATOR . "runner_$cmd" . "_$ts.log";

  $base = "python $runner $cmd";

  if ($os === 'Windows') {
    // start "" /B cmd /c "python runner start > log 2>&1"
    $full = 'cmd /c start "" /B cmd /c ' . escapeshellarg($base . ' > "' . $outLog . '" 2>&1');
    run_cmd($full);
    return [true, "Orden enviada: $cmd (ver log: $outLog)"];
  }

  $full = "nohup $base > " . escapeshellarg($outLog) . " 2>&1 &";
  run_cmd($full);
  return [true, "Orden enviada: $cmd (ver log: $outLog)"];
}

function list_processes(): array {
  $os = os_family();
  if ($os === 'Windows') {
    [$code, $out] = run_cmd('tasklist /FO CSV');
    if ($code !== 0) return [];
    $lines = array_filter(array_map('trim', explode("\n", $out)));
    $rows = [];
    foreach ($lines as $i => $line) {
      if ($i === 0) continue;
      $cols = str_getcsv($line);
      if (count($cols) < 2) continue;
      $rows[] = [
        'name' => $cols[0] ?? '',
        'pid'  => $cols[1] ?? '',
        'mem'  => $cols[4] ?? '',
      ];
      if (count($rows) >= 40) break;
    }
    return $rows;
  } else {
    [$code, $out] = run_cmd('ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 25');
    if ($code !== 0) return [];
    $lines = array_filter(array_map('trim', explode("\n", $out)));
    $rows = [];
    foreach ($lines as $i => $line) {
      if ($i === 0) continue;
      $parts = preg_split('/\s+/', $line);
      if (count($parts) < 4) continue;
      $rows[] = [
        'pid' => $parts[0],
        'name' => $parts[1],
        'cpu' => $parts[2],
        'mem' => $parts[3],
      ];
    }
    return $rows;
  }
}

function kill_process(int $pid): array {
  if (!ALLOW_DANGEROUS_ACTIONS) {
    return [false, "Acción desactivada por seguridad. Activa ALLOW_DANGEROUS_ACTIONS=true si la necesitas."];
  }
  if ($pid <= 0) return [false, "PID inválido."];

  $os = os_family();
  if ($os === 'Windows') {
    [$code, $out] = run_cmd("taskkill /PID $pid /F");
    return [$code === 0, $code === 0 ? "Proceso PID=$pid terminado." : "Error: $out"];
  }
  [$code, $out] = run_cmd("kill -9 $pid");
  return [$code === 0, $code === 0 ? "Proceso PID=$pid terminado." : "Error: $out"];
}

// AUTH
require_basic_auth($USERS);
ensure_dir($LOG_DIR);

// Actions
$flash = '';
$flashType = 'ok';

$action = $_POST['action'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action !== '') {
  if ($action === 'start_monitor') {
    [$ok, $msg] = launch_runner_background($RUNNER_SCRIPT, "start", $LOG_DIR);
    log_admin($ADMIN_LOG_FILE, "RUNNER start ok=" . ($ok ? '1' : '0') . " msg=" . $msg);
    $flash = $msg;
    $flashType = $ok ? 'ok' : 'err';
  }
  if ($action === 'stop_monitor') {
    [$ok, $msg] = launch_runner_background($RUNNER_SCRIPT, "stop", $LOG_DIR);
    log_admin($ADMIN_LOG_FILE, "RUNNER stop ok=" . ($ok ? '1' : '0') . " msg=" . $msg);
    $flash = $msg;
    $flashType = $ok ? 'ok' : 'err';
  }
  if ($action === 'kill_pid') {
    $pid = (int)($_POST['pid'] ?? 0);
    [$ok, $msg] = kill_process($pid);
    log_admin($ADMIN_LOG_FILE, "KILL pid=$pid ok=" . ($ok ? '1' : '0') . " msg=" . $msg);
    $flash = $msg;
    $flashType = $ok ? 'ok' : 'err';
  }
}

// View data
$os = os_family();
$uptime = get_uptime_string();
$disk = disk_summary($ROOT_DIR);
$monitorRunning = is_monitor_running($PID_FILE);

$showProcs = (($_GET['procs'] ?? '') === '1');
$procList = $showProcs ? list_processes() : [];

// Tail admin log
$adminLogTail = '';
if (is_file($ADMIN_LOG_FILE)) {
  $lines = @file($ADMIN_LOG_FILE, FILE_IGNORE_NEW_LINES);
  if (is_array($lines)) $adminLogTail = implode("\n", array_slice($lines, -30));
}

?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Administrador — Server Control Center</title>
  <style>
    :root{
      --bg:#0b0b0b; --text:#f2f2f2; --muted:rgba(242,242,242,.72);
      --border:rgba(255,255,255,.12); --accent:#ff7a18; --accent2:#ff9a3d;
      --danger:#ff4b4b; --ok:#3ddc97;
    }
    *{box-sizing:border-box}
    body{
      margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Arial,sans-serif;
      background: radial-gradient(900px 500px at 15% 10%, rgba(255,122,24,.18), transparent 60%),
                  radial-gradient(800px 450px at 85% 30%, rgba(255,154,61,.12), transparent 55%),
                  var(--bg);
      color:var(--text); min-height:100vh;
    }
    .wrap{max-width:1100px;margin:0 auto;padding:24px}
    .title{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:16px}
    .title h1{margin:0;font-size:22px}
    .sub{color:var(--muted);font-size:14px}
    .pill{font-size:12px;color:rgba(17,17,17,.9);background:linear-gradient(180deg, rgba(255,122,24,.95), rgba(255,154,61,.90));padding:6px 10px;border-radius:999px;font-weight:800;}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    @media (max-width: 900px){ .grid{grid-template-columns:1fr} }
    .card{background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,.35);}
    .hd{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;background:rgba(0,0,0,.22);flex-wrap:wrap;}
    .bd{padding:16px}
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
    .kvs{display:grid;grid-template-columns:160px 1fr;gap:8px 12px;font-size:13px}
    .kvs div{padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)}
    .muted{color:var(--muted)}
    .btns{display:flex;gap:10px;flex-wrap:wrap}
    button,a.btnlink{
      border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);
      padding:10px 14px;border-radius:12px;cursor:pointer;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:8px;
    }
    button:hover,a.btnlink:hover{background:rgba(255,255,255,.10);border-color:rgba(255,122,24,.35)}
    .primary{background:linear-gradient(180deg, rgba(255,122,24,.95), rgba(255,154,61,.90));border-color:rgba(255,255,255,.18);color:#111;}
    .danger{border-color:rgba(255,75,75,.35);background:rgba(255,75,75,.12);}
    .tag-ok{color:var(--ok);font-weight:800}
    .tag-err{color:var(--danger);font-weight:800}
    .flash{margin:0 0 14px 0;padding:10px 12px;border-radius:12px;border:1px solid var(--border)}
    .flash.ok{background:rgba(61,220,151,.08);border-color:rgba(61,220,151,.25)}
    .flash.err{background:rgba(255,75,75,.10);border-color:rgba(255,75,75,.25)}
    table{width:100%;border-collapse:collapse}
    th,td{padding:10px;border-bottom:1px solid var(--border);vertical-align:top;font-size:13px}
    th{color:var(--muted);text-align:left;font-size:12px}
    input[type="number"]{width:130px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,.28);color:var(--text);outline:none;}
    pre{margin:0;white-space:pre-wrap;word-break:break-word;padding:12px;border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,.28);color:var(--text);}
    a{color:var(--accent2);text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
<div class="wrap">

  <div class="title">
    <h1>Administrador</h1>
    <span class="pill">Server Control Center</span>
    <span class="sub">Gestión básica + control del monitor (runner) + procesos (bajo demanda)</span>
  </div>

  <?php if ($flash !== ''): ?>
    <div class="flash <?= $flashType === 'ok' ? 'ok' : 'err'; ?>">
      <?= h($flash); ?>
    </div>
  <?php endif; ?>

  <div class="grid">

    <div class="card">
      <div class="hd">
        <strong>Estado del servidor</strong>
        <span class="muted mono"><?= h($os); ?></span>
      </div>
      <div class="bd">
        <div class="kvs">
          <div class="muted">PHP</div>         <div class="mono"><?= h(PHP_VERSION); ?></div>
          <div class="muted">Uptime</div>      <div><?= h($uptime); ?></div>
          <div class="muted">Proyecto</div>    <div class="mono"><?= h((string)$ROOT_DIR); ?></div>
          <div class="muted">Datos monitor</div><div class="mono"><?= h((string)$DATA_DIR); ?></div>
          <div class="muted">Disco total</div> <div><?= h($disk['total']); ?></div>
          <div class="muted">Disco usado</div> <div><?= h($disk['used']); ?></div>
          <div class="muted">Disco libre</div> <div><?= h($disk['free']); ?></div>
        </div>
        <p class="muted" style="margin:12px 0 0 0;">
          Abre tu <a href="monitor.php">monitor.php</a> para ver gráficas y métricas.
        </p>
      </div>
    </div>

    <div class="card">
      <div class="hd">
        <strong>Control del monitor</strong>
        <span class="<?= $monitorRunning ? 'tag-ok' : 'tag-err'; ?>">
          <?= $monitorRunning ? 'EN EJECUCIÓN' : 'DETENIDO'; ?>
        </span>
      </div>
      <div class="bd">
        <div class="kvs">
          <div class="muted">Runner</div> <div class="mono"><?= h((string)$RUNNER_SCRIPT); ?></div>
          <div class="muted">Script</div> <div class="mono"><?= h((string)$MONITOR_SCRIPT); ?></div>
          <div class="muted">PID file</div><div class="mono"><?= h((string)$PID_FILE); ?></div>
          <div class="muted">Intervalo</div><div><?= (int)$DEFAULT_INTERVAL_SECONDS; ?>s</div>
        </div>

        <div class="btns" style="margin-top:14px;">
          <form method="post" style="margin:0;">
            <input type="hidden" name="action" value="start_monitor">
            <button class="primary" type="submit">Arrancar monitor</button>
          </form>
          <form method="post" style="margin:0;">
            <input type="hidden" name="action" value="stop_monitor">
            <button class="danger" type="submit">Parar monitor</button>
          </form>
        </div>

        <p class="muted" style="margin:12px 0 0 0;">
          Se ejecuta en segundo plano; mira <span class="mono">public/logs/runner_*.log</span> si algo falla.
        </p>
      </div>
    </div>

    <div class="card" style="grid-column:1 / -1;">
      <div class="hd">
        <strong>Procesos (top)</strong>
        <div class="btns" style="margin:0;">
          <?php if (!$showProcs): ?>
            <a class="btnlink" href="?procs=1">Cargar procesos</a>
          <?php else: ?>
            <a class="btnlink" href="admin.php">Ocultar procesos</a>
          <?php endif; ?>
        </div>
      </div>
      <div class="bd">
        <?php if (!$showProcs): ?>
          <div class="muted">Para evitar bloqueos, los procesos se cargan bajo demanda.</div>
        <?php else: ?>
          <?php if (!$procList): ?>
            <div class="muted">No se pudieron obtener procesos.</div>
          <?php else: ?>
            <table>
              <thead>
                <tr>
                  <th style="width:220px;">Nombre</th>
                  <th style="width:120px;">PID</th>
                  <th style="width:160px;">Memoria</th>
                  <?php if (ALLOW_DANGEROUS_ACTIONS): ?>
                    <th style="width:200px;">Acción</th>
                  <?php endif; ?>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($procList as $p): ?>
                  <tr>
                    <td class="mono"><?= h($p['name'] ?? ''); ?></td>
                    <td class="mono"><?= h((string)($p['pid'] ?? '')); ?></td>
                    <td class="mono"><?= h($p['mem'] ?? ''); ?></td>
                    <?php if (ALLOW_DANGEROUS_ACTIONS): ?>
                      <td>
                        <form method="post" style="margin:0; display:flex; gap:10px; align-items:center;">
                          <input type="hidden" name="action" value="kill_pid">
                          <input type="number" name="pid" value="<?= h((string)($p['pid'] ?? '')); ?>" min="1">
                          <button class="danger" type="submit">Kill</button>
                        </form>
                      </td>
                    <?php endif; ?>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
            <?php if (!ALLOW_DANGEROUS_ACTIONS): ?>
              <p class="muted" style="margin:12px 0 0 0;">
                “Matar proceso” está desactivado por seguridad. Si tu profe lo pide, activa
                <span class="mono">ALLOW_DANGEROUS_ACTIONS=true</span>.
              </p>
            <?php endif; ?>
          <?php endif; ?>
        <?php endif; ?>
      </div>
    </div>

    <div class="card" style="grid-column:1 / -1;">
      <div class="hd">
        <strong>Log del administrador</strong>
        <span class="muted mono"><?= h($ADMIN_LOG_FILE); ?></span>
      </div>
      <div class="bd">
        <pre class="mono"><?= h($adminLogTail !== '' ? $adminLogTail : "Sin logs todavía."); ?></pre>
      </div>
    </div>

  </div>
</div>
</body>
</html>

