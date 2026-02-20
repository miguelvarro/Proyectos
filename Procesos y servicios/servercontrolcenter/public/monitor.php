<?php
declare(strict_types=1);

$config = require __DIR__ . '/../config/config.php';

// Helpers
function h(?string $s): string {
  return htmlspecialchars($s ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function ensure_dir(string $path): void {
  if (!is_dir($path)) @mkdir($path, 0775, true);
}

function require_basic_auth(array $USERS): void {
  $user = $_SERVER['PHP_AUTH_USER'] ?? '';
  $pass = $_SERVER['PHP_AUTH_PW'] ?? '';
  if ($user === '' || !isset($USERS[$user]) || $USERS[$user] !== $pass) {
    header('WWW-Authenticate: Basic realm="Monitor API"');
    header('HTTP/1.0 401 Unauthorized');
    echo json_encode(['ok' => false, 'error' => 'Auth required.'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

function parse_iso_dt(?string $s): ?int {
  if (!$s) return null;
  $t = strtotime($s);
  return $t === false ? null : $t;
}

function read_csv_points(string $csvFile, ?int $fromTs, ?int $toTs, int $maxPoints = 800): array {
  if (!is_file($csvFile)) return [];

  $rows = [];
  $fh = fopen($csvFile, 'r');
  if (!$fh) return [];

  // header
  $header = fgetcsv($fh);
  if (!$header) { fclose($fh); return []; }

  while (($r = fgetcsv($fh)) !== false) {
    // expected: ts_iso, epoch, value
    if (count($r) < 3) continue;
    $epoch = (int)$r[1];
    if ($fromTs !== null && $epoch < $fromTs) continue;
    if ($toTs !== null && $epoch > $toTs) continue;
    $rows[] = ['ts' => $r[0], 'epoch' => $epoch, 'value' => (float)$r[2]];
  }
  fclose($fh);

  // downsample simple 
  $n = count($rows);
  if ($n > $maxPoints) {
    $stride = (int)ceil($n / $maxPoints);
    $down = [];
    for ($i = 0; $i < $n; $i += $stride) $down[] = $rows[$i];
    $rows = $down;
  }

  return $rows;
}

function latest_value(string $csvFile): ?array {
  if (!is_file($csvFile)) return null;
  $lines = @file($csvFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  if (!is_array($lines) || count($lines) < 2) return null;
  $last = str_getcsv($lines[count($lines)-1]);
  if (count($last) < 3) return null;
  return ['ts' => $last[0], 'epoch' => (int)$last[1], 'value' => (float)$last[2]];
}

function json_out($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

// API JSON
if (isset($_GET['endpoint'])) {
  require_basic_auth($config['users']);

  $endpoint = (string)$_GET['endpoint'];
  if (!in_array($endpoint, $config['endpoints'], true)) {
    json_out(['ok' => false, 'error' => 'Endpoint no permitido', 'allowed' => $config['endpoints']], 400);
  }

  $from = parse_iso_dt($_GET['from'] ?? null);
  $to   = parse_iso_dt($_GET['to'] ?? null);

  $csv = $config['data_dir'] . DIRECTORY_SEPARATOR . $endpoint . '.csv';
  $points = read_csv_points($csv, $from, $to);

  json_out([
    'ok' => true,
    'endpoint' => $endpoint,
    'from' => $from ? date('c', $from) : null,
    'to' => $to ? date('c', $to) : null,
    'count' => count($points),
    'points' => $points,
  ]);
}

// Dashboard
ensure_dir($config['data_dir']);

$cards = [];
foreach ($config['endpoints'] as $ep) {
  $csv = $config['data_dir'] . DIRECTORY_SEPARATOR . $ep . '.csv';
  $last = latest_value($csv);
  $cards[] = [
    'endpoint' => $ep,
    'csv_exists' => is_file($csv),
    'last' => $last,
  ];
}

?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Monitor — Server Control Center</title>
  <style>
    :root{
      --bg:#0b0b0b;
      --panel:#111111;
      --panel2:#161616;
      --text:#f2f2f2;
      --muted:rgba(242,242,242,.72);
      --border:rgba(255,255,255,.12);
      --accent:#ff7a18;
      --accent2:#ff9a3d;
      --danger:#ff4b4b;
      --ok:#3ddc97;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Arial,sans-serif;
      background: radial-gradient(900px 500px at 15% 10%, rgba(255,122,24,.18), transparent 60%),
                  radial-gradient(800px 450px at 85% 30%, rgba(255,154,61,.12), transparent 55%),
                  var(--bg);
      color:var(--text);
      min-height:100vh;
    }
    .wrap{max-width:1200px;margin:0 auto;padding:24px}
    .title{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:16px}
    .title h1{margin:0;font-size:22px}
    .pill{
      font-size:12px;color:rgba(17,17,17,.9);
      background:linear-gradient(180deg, rgba(255,122,24,.95), rgba(255,154,61,.90));
      padding:6px 10px;border-radius:999px;font-weight:800;
    }
    .sub{color:var(--muted);font-size:14px}
    .topbar{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 18px 0;align-items:center}
    input,select,button{
      border:1px solid var(--border);
      background:rgba(0,0,0,.28);
      color:var(--text);
      padding:10px 12px;
      border-radius:12px;
      outline:none;
    }
    button{
      cursor:pointer;
      font-weight:800;
      background:rgba(255,255,255,.06);
    }
    button:hover{border-color:rgba(255,122,24,.35);background:rgba(255,255,255,.10)}
    .primary{
      background:linear-gradient(180deg, rgba(255,122,24,.95), rgba(255,154,61,.90));
      border-color:rgba(255,255,255,.18);
      color:#111;
    }
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    @media (max-width: 920px){ .grid{grid-template-columns:1fr} }
    .card{
      background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
      border:1px solid var(--border);
      border-radius:16px;
      overflow:hidden;
      box-shadow:0 14px 34px rgba(0,0,0,.35);
    }
    .hd{
      padding:14px 16px;
      border-bottom:1px solid var(--border);
      display:flex;justify-content:space-between;align-items:center;gap:10px;
      background:rgba(0,0,0,.22);
      flex-wrap:wrap;
    }
    .bd{padding:16px}
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
    .muted{color:var(--muted)}
    .badge{font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid var(--border);background:rgba(255,255,255,.06)}
    .ok{border-color:rgba(61,220,151,.25);background:rgba(61,220,151,.08)}
    .err{border-color:rgba(255,75,75,.25);background:rgba(255,75,75,.10)}
    svg{width:100%;height:140px;display:block}
    .legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:12px}
  </style>
</head>
<body>
<div class="wrap">

  <div class="title">
    <h1>Monitor</h1>
    <span class="pill">Recursos del servidor</span>
    <span class="sub">Dashboard + API JSON (protegida)</span>
  </div>

  <div class="topbar">
    <label class="muted">Rango:</label>
    <select id="range">
      <option value="15">Últimos 15 min</option>
      <option value="60" selected>Última 1 hora</option>
      <option value="360">Últimas 6 horas</option>
      <option value="1440">Últimas 24 horas</option>
    </select>

    <label class="muted">Auto-refresh:</label>
    <select id="refresh">
      <option value="0">Off</option>
      <option value="5">5s</option>
      <option value="10" selected>10s</option>
      <option value="30">30s</option>
    </select>

    <button class="primary" id="btnReload">Recargar</button>
    <a class="badge" href="admin.php" style="text-decoration:none;color:inherit;">Ir a Admin</a>
    <span class="muted">API: <span class="mono">monitor.php?endpoint=cpu&from=...&to=...</span> (Basic Auth)</span>
  </div>

  <div class="grid" id="grid">
    <?php foreach ($cards as $c): ?>
      <div class="card" data-endpoint="<?= h($c['endpoint']); ?>">
        <div class="hd">
          <strong class="mono"><?= h($c['endpoint']); ?></strong>
          <?php if ($c['csv_exists']): ?>
            <span class="badge ok">CSV OK</span>
          <?php else: ?>
            <span class="badge err">SIN CSV</span>
          <?php endif; ?>
        </div>
        <div class="bd">
          <svg viewBox="0 0 1000 200" preserveAspectRatio="none">
            <polyline points="0,100 1000,100" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2"/>
            <polyline class="line" points="" fill="none" stroke="rgba(255,122,24,.9)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>

          <div class="legend">
            <span class="muted">Último:</span>
            <span class="mono lastVal"><?= $c['last'] ? h((string)$c['last']['value']) : 'N/D'; ?></span>
            <span class="muted">|</span>
            <span class="mono lastTs"><?= $c['last'] ? h((string)$c['last']['ts']) : 'N/D'; ?></span>
          </div>

          <div class="muted" style="margin-top:10px;font-size:12px;">
            Para ver JSON: <span class="mono">?endpoint=<?= h($c['endpoint']); ?></span> (requiere auth)
          </div>
        </div>
      </div>
    <?php endforeach; ?>
  </div>

</div>

<script>

  const endpoints = Array.from(document.querySelectorAll('[data-endpoint]')).map(el => el.getAttribute('data-endpoint'));

  function nowIso() {
    return new Date().toISOString();
  }
  function isoMinusMinutes(min) {
    return new Date(Date.now() - min * 60 * 1000).toISOString();
  }

  function pointsToPolyline(points) {
    if (!points || points.length < 2) return "";
    const vals = points.map(p => Number(p.value));
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }

    const n = points.length;
    const coords = [];
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 1000;
      const v = Number(points[i].value);
      const y = 200 - ((v - min) / (max - min)) * 180 - 10; // padding
      coords.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return coords.join(" ");
  }

  async function loadEndpoint(ep, fromIso, toIso) {
    const url = `monitor.php?endpoint=${encodeURIComponent(ep)}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function refreshAll() {
    const rangeMin = Number(document.getElementById('range').value);
    const fromIso = isoMinusMinutes(rangeMin);
    const toIso = nowIso();

    for (const ep of endpoints) {
      const card = document.querySelector(`[data-endpoint="${ep}"]`);
      const line = card.querySelector('.line');
      const lastVal = card.querySelector('.lastVal');
      const lastTs = card.querySelector('.lastTs');

      try {
        const data = await loadEndpoint(ep, fromIso, toIso);
        if (!data.ok) throw new Error(data.error || "not ok");

        const pts = data.points || [];
        line.setAttribute('points', pointsToPolyline(pts));

        if (pts.length) {
          const last = pts[pts.length - 1];
          lastVal.textContent = String(last.value);
          lastTs.textContent = String(last.ts);
        }
      } catch (e) {
        line.setAttribute('points', "");
      }
    }
  }

  let timer = null;
  function syncTimer() {
    if (timer) clearInterval(timer);
    const sec = Number(document.getElementById('refresh').value);
    if (sec > 0) timer = setInterval(refreshAll, sec * 1000);
  }

  document.getElementById('btnReload').addEventListener('click', refreshAll);
  document.getElementById('refresh').addEventListener('change', syncTimer);
  document.getElementById('range').addEventListener('change', refreshAll);

  syncTimer();
  refreshAll();
</script>
</body>
</html>

