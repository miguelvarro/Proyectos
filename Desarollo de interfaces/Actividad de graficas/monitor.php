<?php
/**
 * monitor.php  (TODO EN UNO)
 * - JSON API (Basic Auth): monitor.php?endpoint=cpu|ram|disk_usage|disk_io|bandwidth|processes|apache_request_rate&from=...&to=...
 * - Dashboard/Informe: monitor.php (sin endpoint) + rango/selección/export
 *
 * Requisitos:
 * - Carpeta ./monitor_data con CSVs generados por server_monitor.py
 */

// --------------------------
// CONFIG
// --------------------------
$USERS = [
  'miguel' => '1234',
];

$CSV_DIR = __DIR__ . '/monitor_data';

// --------------------------
// AUTH (para endpoints JSON)
// --------------------------
function require_basic_auth(array $users): void {
  $user = $_SERVER['PHP_AUTH_USER'] ?? null;
  $pass = $_SERVER['PHP_AUTH_PW'] ?? null;

  if (!$user || !$pass) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION']
      ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
      ?? null;

    if ($authHeader && stripos($authHeader, 'Basic ') === 0) {
      $decoded = base64_decode(substr($authHeader, 6));
      if ($decoded !== false && strpos($decoded, ':') !== false) {
        [$user, $pass] = explode(':', $decoded, 2);
      }
    }
  }

  if (!isset($users[$user]) || $users[$user] !== $pass) {
    header('WWW-Authenticate: Basic realm="Monitor API"');
    header('HTTP/1.0 401 Unauthorized');
    exit('Authentication required.');
  }
}

// --------------------------
// Helpers
// --------------------------
function safe_filename_php(string $name): string {
  $name = preg_replace('/[\\\\\/:*?"<>|]/', '_', $name);
  $name = trim($name);
  $name = trim($name, '.');
  if ($name === '') $name = 'unnamed';
  return $name;
}

function parse_date_flexible(string $s): ?int {
  $s = trim($s);
  if ($s === '') return null;

  $dt = DateTime::createFromFormat('Y-m-d H:i:s', $s);
  if ($dt instanceof DateTime) return $dt->getTimestamp();

  $dt = DateTime::createFromFormat('Y-m-d H:i', $s);
  if ($dt instanceof DateTime) return $dt->getTimestamp();

  return null;
}

/**
 * Filtra por rango SOLO si existe columna 'date' y se puede parsear.
 * - Si NO existe 'date' => devuelve rows tal cual (para snapshots como processes.csv)
 * - Si una fila tiene date pero no parsea => NO la descartamos (para no quedarnos en blanco por una fila “rara”)
 */
function filter_rows_by_range(array $rows, ?int $fromTs, ?int $toTs): array {
  if (!$fromTs && !$toTs) return $rows;
  if (!$rows) return $rows;

  // Si el dataset no tiene 'date', NO se filtra
  $hasDate = is_array($rows[0] ?? null) && array_key_exists('date', $rows[0]);
  if (!$hasDate) return $rows;

  $out = [];
  foreach ($rows as $r) {
    if (!is_array($r) || !isset($r['date'])) { $out[] = $r; continue; }

    $ts = parse_date_flexible((string)$r['date']);
    if ($ts === null) { $out[] = $r; continue; }

    if ($fromTs && $ts < $fromTs) continue;
    if ($toTs && $ts > $toTs) continue;

    $out[] = $r;
  }
  return $out;
}

// --------------------------
// CSV -> array of assoc
// --------------------------
function readCsvAsJson(string $csvFile): array {
  if (!is_file($csvFile)) return ['error' => 'No data available.'];
  if (($fh = fopen($csvFile, 'r')) === false) return ['error' => 'Cannot open file.'];

  $header = fgetcsv($fh);
  if (!$header) { fclose($fh); return ['error' => 'Empty CSV.']; }

  // (opcional) por si hay BOM en el primer header
  if (isset($header[0])) $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);

  $data = [];
  while (($row = fgetcsv($fh)) !== false) {
    if (count($row) !== count($header)) continue;
    $data[] = array_combine($header, $row);
  }
  fclose($fh);
  return $data;
}

function csv_endpoint(string $path, ?int $fromTs, ?int $toTs): void {
  $rows = readCsvAsJson($path);
  if (isset($rows['error'])) { echo json_encode($rows); return; }
  $rows = filter_rows_by_range($rows, $fromTs, $toTs);
  echo json_encode($rows);
}

// --------------------------
// ENDPOINT MODE
// --------------------------
$endpoint = $_GET['endpoint'] ?? '';
if ($endpoint !== '') {
  require_basic_auth($USERS);
  header('Content-Type: application/json; charset=utf-8');

  $from = $_GET['from'] ?? '';
  $to   = $_GET['to'] ?? '';
  $fromTs = $from ? parse_date_flexible($from) : null;
  $toTs   = $to   ? parse_date_flexible($to)   : null;

  switch ($endpoint) {
    case 'cpu':
      csv_endpoint($GLOBALS['CSV_DIR'] . "/cpu_usage.csv", $fromTs, $toTs);
      break;

    case 'ram':
      csv_endpoint($GLOBALS['CSV_DIR'] . "/ram_usage.csv", $fromTs, $toTs);
      break;

    case 'disk_usage':
      csv_endpoint($GLOBALS['CSV_DIR'] . "/disk_usage.csv", $fromTs, $toTs);
      break;

    case 'processes':
      // Snapshot: SIN filtrar por date (aunque igualmente filter_rows_by_range ya lo deja pasar)
      echo json_encode(readCsvAsJson($GLOBALS['CSV_DIR'] . "/processes.csv"));
      break;

    case 'apache_request_rate':
      csv_endpoint($GLOBALS['CSV_DIR'] . "/apache_request_rate.csv", $fromTs, $toTs);
      break;

    case 'disk_io': {
      $disk = $_GET['disk'] ?? '';
      $file = '';

      if ($disk) {
        $disk = safe_filename_php($disk);
        $candidate = $GLOBALS['CSV_DIR'] . "/disk_io_$disk.csv";
        if (is_file($candidate)) $file = $candidate;
      }
      if (!$file) {
        $matches = glob($GLOBALS['CSV_DIR'] . "/disk_io_*.csv");
        if ($matches) $file = $matches[0];
      }
      if (!$file) { http_response_code(404); echo json_encode(['error' => 'No data available.']); exit; }

      csv_endpoint($file, $fromTs, $toTs);
      break;
    }

    case 'bandwidth': {
      $iface = $_GET['iface'] ?? '';
      $file  = '';

      if ($iface) {
        $iface = safe_filename_php($iface);
        $candidate = $GLOBALS['CSV_DIR'] . "/bandwidth_$iface.csv";
        if (is_file($candidate)) $file = $candidate;
      }
      if (!$file) {
        $matches = glob($GLOBALS['CSV_DIR'] . "/bandwidth_*.csv");
        if ($matches) $file = $matches[0];
      }
      if (!$file) { http_response_code(404); echo json_encode(['error' => 'No data available.']); exit; }

      csv_endpoint($file, $fromTs, $toTs);
      break;
    }

    default:
      http_response_code(400);
      echo json_encode([
        'error' => 'Invalid endpoint.',
        'valid' => ['cpu','ram','disk_usage','disk_io','bandwidth','processes','apache_request_rate']
      ]);
  }
  exit;
}

// --------------------------
// DASHBOARD / INFORME MODE
// --------------------------
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
$selfEndpointBase = $base . '/monitor.php?endpoint=';

// Auth para que el JS pueda llamar a endpoints
$username = 'miguel';
$password = '1234';
$auth = base64_encode("$username:$password");

// Rango (15m / 1h / 24h)
$range = $_GET['range'] ?? '15m';
$nowTs = time();
$fromTs = $nowTs - 900;
if ($range === '1h')  $fromTs = $nowTs - 3600;
if ($range === '24h') $fromTs = $nowTs - 86400;

$fromStr = date('Y-m-d H:i:s', $fromTs);
$toStr   = date('Y-m-d H:i:s', $nowTs);

// Auto-refresh (ms)
$refreshMs = (int)($_GET['refresh'] ?? 5000);
if ($refreshMs < 0) $refreshMs = 0;
if ($refreshMs > 60000) $refreshMs = 60000;

// Descubre interfaces y discos disponibles desde los CSV
$ifaceFiles = glob($CSV_DIR . '/bandwidth_*.csv') ?: [];
$ifaces = array_values(array_filter(array_map(function($p){
  $b = basename($p, '.csv'); // bandwidth_X
  return substr($b, strlen('bandwidth_'));
}, $ifaceFiles)));

$diskFiles = glob($CSV_DIR . '/disk_io_*.csv') ?: [];
$disks = array_values(array_filter(array_map(function($p){
  $b = basename($p, '.csv'); // disk_io_X
  return substr($b, strlen('disk_io_'));
}, $diskFiles)));

$selectedIface = safe_filename_php($_GET['iface'] ?? ($ifaces[0] ?? ''));
$selectedDisk  = safe_filename_php($_GET['disk']  ?? ($disks[0]  ?? ''));

// Definición de tarjetas
$endpoints = [
  ['endpoint' => 'cpu',                 'type' => 'line', 'label' => 'CPU',           'showLegend' => false],
  ['endpoint' => 'ram',                 'type' => 'bar',  'label' => 'RAM',           'showLegend' => false],
  ['endpoint' => 'disk_usage',          'type' => 'pie',  'label' => 'DISK',          'showLegend' => true ],
  ['endpoint' => 'disk_io',             'type' => 'line', 'label' => 'DISK I/O',      'disk' => $selectedDisk,   'showLegend' => false],
  ['endpoint' => 'bandwidth',           'type' => 'bar',  'label' => 'BANDWIDTH',     'iface' => $selectedIface, 'showLegend' => false],
  ['endpoint' => 'processes',           'type' => 'bar',  'label' => 'PROCESSES',     'valueKey' => 'mem_mb', 'labelKey' => 'name', 'showLegend' => true],
  ['endpoint' => 'apache_request_rate', 'type' => 'line', 'label' => 'REQUEST RATE', 'valueKey' => 'requests_per_minute', 'labelKey' => 'date', 'showLegend' => false],
];

// --------------------------
// CHART RENDERER (SVG + JS)
// --------------------------
function render_svg_chart(array $opts): void {
  static $cssPrinted = false;

  $baseId     = $opts['id'] ?? uniqid('chart_');
  $width      = isset($opts['width']) ? (int)$opts['width'] : 220;
  $showLegend = array_key_exists('showLegend', $opts) ? (bool)$opts['showLegend'] : true;
  $chartType  = $opts['type'] ?? 'pie';
  $dataUrl    = $opts['dataUrl'] ?? null;
  $auth       = $opts['auth'] ?? null;

  $valueKey   = $opts['valueKey'] ?? null;
  $labelKey   = $opts['labelKey'] ?? null;

  $kpiId      = $opts['kpiId'] ?? null;
  $metric     = $opts['metric'] ?? null;
  $refreshMs  = (int)($opts['refreshMs'] ?? 0);

  $svgId       = $baseId . '_svg';
  $legendId    = $baseId . '_legend';
  $tooltipId   = $baseId . '_tooltip';
  $containerId = $baseId . '_container';

  if (!$cssPrinted) {
    $cssPrinted = true;
    ?>
    <style>
      .svg-pie-chart-container{display:inline-flex;flex-direction:row;align-items:center;justify-content:center;width:100%;height:100%;padding:8px 10px;gap:10px}
      .svg-pie-chart-container svg{flex:0 0 auto;height:100%;filter:drop-shadow(0 0 14px rgba(255,120,0,.55)) brightness(1.6)}
      .svg-pie-slice,.svg-bar-rect,.svg-line-point{cursor:pointer;transition:transform .2s ease,opacity .2s ease,filter .2s ease;transform-box:fill-box;transform-origin:50% 50%}
      .svg-pie-slice:hover,.svg-bar-rect:hover,.svg-line-point:hover{transform:scale(1.05);opacity:.92;filter:brightness(1.15)}
      .svg-pie-legend{flex:1 1 auto;font-size:.7rem;color:#f5f5f5;max-height:100%;overflow:hidden}
      .svg-pie-legend-item{display:flex;align-items:center;margin-bottom:.18rem;gap:.45rem;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
      .svg-pie-legend-color{width:12px;height:12px;border-radius:3px;border:1px solid rgba(255,180,90,.7);box-shadow:0 0 10px rgba(255,120,0,.55)}
      .svg-pie-tooltip{position:fixed;pointer-events:none;padding:.3rem .5rem;background:radial-gradient(circle at 0 0,#ffb347 0,#0b0b0b 55%);color:#fff;border-radius:6px;font-size:.75rem;transform:translate(-50%,-120%);white-space:nowrap;display:none;z-index:9999;border:1px solid rgba(255,140,0,.6);box-shadow:0 0 18px rgba(255,120,0,.55),0 10px 25px rgba(0,0,0,.75)}
      .svg-grid-lines line{stroke:rgba(255,180,90,.14);stroke-width:.8}
      .svg-axis line{stroke:rgba(255,180,90,.6);stroke-width:1.2}
      .svg-axis-label{fill:#ffb347;font-size:9px}
    </style>
    <?php
  }
  ?>

  <div id="<?php echo htmlspecialchars($containerId, ENT_QUOTES); ?>" class="svg-pie-chart-container">
    <svg id="<?php echo htmlspecialchars($svgId, ENT_QUOTES); ?>"
         viewBox="0 0 300 300"
         width="<?php echo $width; ?>"
         height="<?php echo $width; ?>"
         aria-label="Chart"></svg>

    <?php if ($showLegend): ?>
      <div id="<?php echo htmlspecialchars($legendId, ENT_QUOTES); ?>" class="svg-pie-legend" aria-label="Legend"></div>
    <?php endif; ?>

    <div id="<?php echo htmlspecialchars($tooltipId, ENT_QUOTES); ?>" class="svg-pie-tooltip"></div>
  </div>

  <script>
  (function(){
    const svgId       = <?php echo json_encode($svgId); ?>;
    const legendId    = <?php echo json_encode($legendId); ?>;
    const tooltipId   = <?php echo json_encode($tooltipId); ?>;
    const showLegend  = <?php echo $showLegend ? 'true' : 'false'; ?>;
    const chartType   = <?php echo json_encode($chartType); ?>;
    const dataUrl     = <?php echo json_encode($dataUrl); ?>;
    const auth        = <?php echo json_encode($auth); ?>;
    const valueKeyOpt = <?php echo json_encode($valueKey); ?>;
    const labelKeyOpt = <?php echo json_encode($labelKey); ?>;

    const kpiId       = <?php echo json_encode($kpiId); ?>;
    const metric      = <?php echo json_encode($metric); ?>;
    const refreshMs   = <?php echo json_encode($refreshMs); ?>;

    const svg     = document.getElementById(svgId);
    const legend  = showLegend ? document.getElementById(legendId) : null;
    const tooltip = document.getElementById(tooltipId);
    if (!svg || !tooltip) return;

    const cardEl = svg.closest('.tarjeta');
    const kpiEl  = kpiId ? document.getElementById(kpiId) : null;

    const fallbackColors = [
      "#ff8c00", "#ff4500", "#ffae00", "#ff2e00",
      "#ffa500", "#ff6a00", "#cc5500", "#ffb347",
      "#db2777", "#7c3aed"
    ];

    function clearChart(){
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (legend) while (legend.firstChild) legend.removeChild(legend.firstChild);
    }
    function showTooltip(text,x,y){
      tooltip.textContent = text;
      tooltip.style.left = x+"px";
      tooltip.style.top  = y+"px";
      tooltip.style.display="block";
    }
    function hideTooltip(){ tooltip.style.display="none"; }

    function attachTooltip(el,label,value,percentage){
      el.addEventListener("mouseenter", function(evt){
        const txt = (label || "(no label)") + ": " + value + (percentage!=null ? (" ("+percentage.toFixed(1)+"%)") : "");
        showTooltip(txt, evt.clientX, evt.clientY - 10);
      });
      el.addEventListener("mousemove", function(evt){
        tooltip.style.left = evt.clientX+"px";
        tooltip.style.top  = (evt.clientY - 10)+"px";
      });
      el.addEventListener("mouseleave", hideTooltip);
    }

    function normalizeData(items){
      return items.map(function(item, idx){
        return {
          label: item.label ?? "",
          value: Number(item.value) || 0,
          color: item.color || fallbackColors[idx % fallbackColors.length]
        };
      });
    }

    function buildLegend(items,total){
      if (!legend) return;
      items.forEach(function(item){
        const row = document.createElement("div");
        row.className = "svg-pie-legend-item";

        const box = document.createElement("div");
        box.className = "svg-pie-legend-color";
        box.style.background = item.color;

        const txt = document.createElement("span");
        const pct = total > 0 ? (item.value / total * 100) : 0;
        txt.textContent = (item.label || "(no label)") + " — " + item.value + " (" + pct.toFixed(1) + "%)";

        row.appendChild(box);
        row.appendChild(txt);
        legend.appendChild(row);
      });
    }

    function polarToCartesian(cx, cy, r, angle){
      const rad = (angle - 90) * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function arcPath(cx, cy, r, startAngle, endAngle){
      const start = polarToCartesian(cx, cy, r, endAngle);
      const end   = polarToCartesian(cx, cy, r, startAngle);
      const largeArc = (endAngle - startAngle) <= 180 ? "0" : "1";
      return ["M", cx, cy, "L", start.x, start.y, "A", r, r, 0, largeArc, 0, end.x, end.y, "Z"].join(" ");
    }

    function renderPie(items,total){
      const cx=150, cy=150, r=110;
      let start=0;
      items.forEach(function(item){
        const pct = total>0 ? (item.value/total*100) : 0;
        const end = start + (item.value/total)*360;

        const path = document.createElementNS("http://www.w3.org/2000/svg","path");
        path.setAttribute("d", arcPath(cx,cy,r,start,end));
        path.setAttribute("fill", item.color);
        path.classList.add("svg-pie-slice");
        attachTooltip(path, item.label, item.value, pct);

        svg.appendChild(path);
        start = end;
      });
    }

    function renderBar(items,total){
      const chartLeft=40, chartTop=30, chartWidth=230, chartHeight=220;
      const maxValue = Math.max.apply(null, items.map(i=>i.value).concat([1]));
      const n = items.length;
      const gap = 10;
      const barW = n>0 ? Math.max(8, (chartWidth - gap*(n-1)) / n) : 0;

      const axis = document.createElementNS("http://www.w3.org/2000/svg","g");
      axis.classList.add("svg-axis");
      const xAxis = document.createElementNS("http://www.w3.org/2000/svg","line");
      xAxis.setAttribute("x1", chartLeft);
      xAxis.setAttribute("y1", chartTop+chartHeight);
      xAxis.setAttribute("x2", chartLeft+chartWidth);
      xAxis.setAttribute("y2", chartTop+chartHeight);
      axis.appendChild(xAxis);
      svg.appendChild(axis);

      items.forEach(function(item, idx){
        let h = (item.value / maxValue) * chartHeight;
        if (h > 0 && h < 2) h = 2;

        const x = chartLeft + idx*(barW+gap);
        const y = chartTop + (chartHeight - h);

        const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", barW);
        rect.setAttribute("height", h);
        rect.setAttribute("rx", 4);
        rect.setAttribute("fill", item.color);
        rect.classList.add("svg-bar-rect");

        const pct = total>0 ? (item.value/total*100) : 0;
        attachTooltip(rect, item.label, item.value, pct);

        svg.appendChild(rect);
      });
    }

    function renderLine(items,total){
      const chartLeft=40, chartTop=30, chartRight=270, chartBottom=250;
      const chartWidth=chartRight-chartLeft, chartHeight=chartBottom-chartTop;

      const values = items.map(i=>i.value);
      const maxValue = Math.max.apply(null, values.concat([1]));
      const n = items.length;
      const spacing = n>1 ? chartWidth/(n-1) : 0;

      const grid = document.createElementNS("http://www.w3.org/2000/svg","g");
      grid.classList.add("svg-grid-lines");
      for(let i=0;i<=4;i++){
        const y = chartTop + (chartHeight/4)*i;
        const line = document.createElementNS("http://www.w3.org/2000/svg","line");
        line.setAttribute("x1", chartLeft);
        line.setAttribute("y1", y);
        line.setAttribute("x2", chartRight);
        line.setAttribute("y2", y);
        grid.appendChild(line);
      }
      svg.appendChild(grid);

      const axis = document.createElementNS("http://www.w3.org/2000/svg","g");
      axis.classList.add("svg-axis");
      const xAxis = document.createElementNS("http://www.w3.org/2000/svg","line");
      xAxis.setAttribute("x1", chartLeft);
      xAxis.setAttribute("y1", chartBottom);
      xAxis.setAttribute("x2", chartRight);
      xAxis.setAttribute("y2", chartBottom);
      axis.appendChild(xAxis);
      svg.appendChild(axis);

      let pointsStr = "";
      items.forEach(function(item, idx){
        const x = chartLeft + spacing*idx;
        const y = chartTop + (1 - (item.value/maxValue)) * chartHeight;
        pointsStr += x + "," + y + " ";

        const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", 6);
        circle.setAttribute("fill", item.color);
        circle.classList.add("svg-line-point");

        const pct = total>0 ? (item.value/total*100) : null;
        attachTooltip(circle, item.label, item.value, pct==null?0:pct);

        svg.appendChild(circle);
      });

      const poly = document.createElementNS("http://www.w3.org/2000/svg","polyline");
      poly.setAttribute("points", pointsStr.trim());
      poly.setAttribute("fill","none");
      poly.setAttribute("stroke", items[0] ? items[0].color : "#ff8c00");
      poly.setAttribute("stroke-width", 2);
      poly.setAttribute("stroke-linejoin","round");
      poly.setAttribute("stroke-linecap","round");
      svg.insertBefore(poly, svg.firstChild);
    }

    function chooseNumericKey(obj){
      for (const k in obj){
        if (!Object.prototype.hasOwnProperty.call(obj,k)) continue;
        if (k.toLowerCase() === "date") continue;
        const v = Number(obj[k]);
        if (!Number.isNaN(v)) return k;
      }
      return null;
    }

    function toChartItems(raw){
      if (!Array.isArray(raw) || raw.length === 0) return [];

      // SPECIAL: BANDWIDTH
	// 1) Intentamos mostrar "tráfico" como delta (KB por muestra)
	// 2) Si el delta es TODO 0 (sin tráfico), fallback a acumulado (MB) para que SIEMPRE se vea algo.
	if (raw[0] && raw[0].bytes_recv !== undefined && raw[0].bytes_sent !== undefined) {
	  const hasDate = raw[0].date !== undefined;
	  const N = 20;
	  const sliced = hasDate ? raw.slice(-N) : raw;

	  // Si hay <2 puntos, no podemos hacer delta -> acumulado
	  if (sliced.length < 2) {
	    return sliced.map((row, idx) => {
	      const label = String(row.date ?? ("t" + idx));
	      const totalBytes = (Number(row.bytes_recv) || 0) + (Number(row.bytes_sent) || 0);
	      const mb = totalBytes / (1024 * 1024);
	      return { label, value: mb };
	    });
	  }

	  // Delta KB por muestra
	  const deltas = [];
	  for (let i = 1; i < sliced.length; i++) {
	    const prev = sliced[i - 1];
	    const cur  = sliced[i];

	    const prevR = Number(prev.bytes_recv) || 0;
	    const curR  = Number(cur.bytes_recv) || 0;
	    const prevS = Number(prev.bytes_sent) || 0;
	    const curS  = Number(cur.bytes_sent) || 0;

	    const dR = Math.max(0, curR - prevR);
	    const dS = Math.max(0, curS - prevS);

	    // total del intervalo (recv+sent) en KB
	    const kb = (dR + dS) / 1024;

	    const label = String(cur.date ?? ("t" + i));
	    deltas.push({ label, value: kb });
	  }

	  // Si TODO el delta es 0 => no hay tráfico. Fallback a acumulado (MB) para “ver algo”.
	  const maxDelta = deltas.reduce((m, it) => Math.max(m, it.value), 0);
	  if (maxDelta <= 0) {
	    return sliced.map((row, idx) => {
	      const label = String(row.date ?? ("t" + idx));
	      const totalBytes = (Number(row.bytes_recv) || 0) + (Number(row.bytes_sent) || 0);
	      const mb = totalBytes / (1024 * 1024);
	      return { label, value: mb };
	    });
	  }

	  return deltas;
	}


      // DISK pie => usado vs libre (última fila)
      if (chartType === "pie" && raw[0].disk_usage_percent !== undefined && raw[0].disk_free_gb !== undefined && raw[0].disk_total_gb !== undefined) {
        const last = raw[raw.length - 1];
        const total = Number(last.disk_total_gb) || 0;
        const free  = Number(last.disk_free_gb) || 0;
        const used  = Math.max(0, total - free);
        return [
          { label: "Used (GB)", value: used },
          { label: "Free (GB)", value: free }
        ];
      }

      const hasDate = raw[0].date !== undefined;
      const N = 20;
      const sliced = hasDate ? raw.slice(-N) : raw;

      const vKey = valueKeyOpt || chooseNumericKey(sliced[0]);
      const lKey = labelKeyOpt || (hasDate ? "date" : null);

      if (!vKey) return [];

      return sliced.map(function(row, idx){
        const label = lKey && row[lKey] !== undefined ? String(row[lKey]) : ("Item " + (idx+1));
        return { label: label, value: Number(row[vKey]) || 0 };
      });
    }

    async function load(){
      if (!dataUrl) return [];
      const headers = { "Cache-Control": "no-cache" };
      if (auth) headers["Authorization"] = "Basic " + auth;

      // Cache-busting para evitar que el navegador te dé una respuesta “vieja”
      const url = dataUrl + (dataUrl.includes('?') ? '&' : '?') + '_ts=' + Date.now();

      const res = await fetch(url, { headers, cache: "no-store" });
      const json = await res.json();
      return json;
    }

    function updateKpiAndAlerts(items){
      const values = items.map(i => Number(i.value) || 0);
      const last = values.length ? values[values.length-1] : 0;
      const max  = values.length ? Math.max(...values) : 0;
      const avg  = values.length ? (values.reduce((a,b)=>a+b,0) / values.length) : 0;

      if (kpiEl){
        kpiEl.textContent = `last ${last.toFixed(1)} | avg ${avg.toFixed(1)} | max ${max.toFixed(1)}`;
      }

      if (cardEl){
        cardEl.classList.remove('alert','high-load');

        if (metric === 'cpu' && last > 85) cardEl.classList.add('alert');
        if (metric === 'ram' && last > 90) cardEl.classList.add('alert');

        if (metric === 'apache_request_rate' && last > 120) cardEl.classList.add('high-load');
      }
    }

    function render(raw){
      clearChart();
      hideTooltip();

      const items = normalizeData(toChartItems(raw));
      const total = items.reduce((s,i)=>s+i.value,0);

      if (items.length === 0) {
        if (!legend) {
          const t = document.createElementNS("http://www.w3.org/2000/svg","text");
          t.setAttribute("x", 150);
          t.setAttribute("y", 160);
          t.setAttribute("text-anchor", "middle");
          t.setAttribute("fill", "#ffb347");
          t.setAttribute("font-size", "14");
          t.textContent = "No data in range";
          svg.appendChild(t);
        } else {
          const msg = document.createElement("div");
          msg.textContent = "No data in range.";
          legend.appendChild(msg);
        }
        if (kpiEl) kpiEl.textContent = "—";
        return;
      }

      if (chartType === "pie" && total === 0) {
        if (legend) {
          const msg = document.createElement("div");
          msg.textContent = "No data (total = 0).";
          legend.appendChild(msg);
        }
        if (kpiEl) kpiEl.textContent = "—";
        return;
      }

      if (chartType === "bar") renderBar(items,total);
      else if (chartType === "line") renderLine(items,total);
      else renderPie(items,total);

      buildLegend(items,total);
      updateKpiAndAlerts(items);
    }

    async function refresh(){
      try{
        const raw = await load();
        render(raw);
      }catch(e){
        clearChart();
        if (!legend) {
          const t = document.createElementNS("http://www.w3.org/2000/svg","text");
          t.setAttribute("x", 150);
          t.setAttribute("y", 160);
          t.setAttribute("text-anchor", "middle");
          t.setAttribute("fill", "#ffb347");
          t.setAttribute("font-size", "14");
          t.textContent = "Error loading";
          svg.appendChild(t);
        }
      }
    }

    // Primera carga
    refresh();

    // Auto-refresh
    if (refreshMs && refreshMs >= 2000){
      setInterval(refresh, refreshMs);
    }
  })();
  </script>
  <?php
}

?><!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Server Monitor</title>

  <style>
    *{box-sizing:border-box}
    body{
      margin:0;
      min-height:100vh;
      display:grid;
      grid-template-columns:repeat(3,1fr);
      grid-auto-rows:260px;
      gap:14px;
      padding:14px;
      background:
        radial-gradient(circle at 20% 20%, rgba(255,140,0,0.35) 0%, transparent 45%),
        radial-gradient(circle at 80% 30%, rgba(255,69,0,0.25) 0%, transparent 50%),
        radial-gradient(circle at 50% 90%, rgba(255,120,0,0.2) 0%, transparent 50%),
        #0b0b0b;
      color:#f5f5f5;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Arial;
    }

    .toolbar{
      grid-column:1/-1;
      display:flex;
      gap:10px;
      align-items:center;
      padding:6px 4px;
      border:1px solid rgba(255,140,0,0.18);
      border-radius:14px;
      background:rgba(0,0,0,0.35);
      backdrop-filter: blur(6px);
    }
    .toolbar label{ font-size:12px; color:#ffe3c2; display:flex; gap:6px; align-items:center; }
    .toolbar select,.toolbar button,.toolbar a{
      font-size:12px;
      color:#fff;
      background:rgba(0,0,0,0.55);
      border:1px solid rgba(255,140,0,0.35);
      border-radius:10px;
      padding:6px 8px;
      text-decoration:none;
    }
    .toolbar button{ cursor:pointer; }
    .toolbar .spacer{ margin-left:auto; }

    .tarjeta{
      position:relative;
      border-radius:18px;
      border:1px solid rgba(255,140,0,0.25);
      background:rgba(10,10,10,0.85);
      box-shadow:0 0 30px rgba(255,100,0,0.25);
      overflow:hidden;
      isolation:isolate;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .tarjeta::before{
      content:"";
      position:absolute;
      inset:-40%;
      background:
        radial-gradient(circle at 0 0, rgba(255,140,0,0.25) 0, transparent 60%),
        radial-gradient(circle at 100% 100%, rgba(255,69,0,0.25) 0, transparent 60%);
      opacity:0.4;
      mix-blend-mode:screen;
      pointer-events:none;
    }
    .tarjeta::after{
      content:"";
      position:absolute;
      inset:0;
      background:repeating-linear-gradient(
        135deg,
        rgba(255,140,0,0.04) 0 2px,
        transparent 2px 4px
      );
      opacity:0.2;
      pointer-events:none;
    }
    .tarjeta-inner{
      position:relative;
      z-index:1;
      width:100%;
      height:100%;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .chart-label{
      position:absolute;
      top:6px;
      right:10px;
      font-size:10px;
      text-transform:uppercase;
      letter-spacing:0.12em;
      color:#ffb347;
      background:rgba(0,0,0,0.8);
      border-radius:999px;
      padding:2px 8px;
      border:1px solid rgba(255,140,0,0.5);
      backdrop-filter:blur(4px);
      z-index:3;
    }
    .kpi{
      position:absolute;
      top:8px;
      left:10px;
      font-size:12px;
      color:#ffe3c2;
      background:rgba(0,0,0,0.55);
      border:1px solid rgba(255,140,0,0.35);
      padding:4px 8px;
      border-radius:10px;
      z-index:3;
      max-width: calc(100% - 140px);
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .badge-load{
      position:absolute;
      bottom:10px;
      right:10px;
      font-size:11px;
      padding:3px 8px;
      border-radius:999px;
      border:1px solid rgba(220,38,38,0.65);
      background: rgba(220,38,38,0.18);
      color:#ffd1d1;
      z-index:3;
      display:none;
    }
    .tarjeta.high-load .badge-load{ display:inline-block; }

    .tarjeta.alert{
      border-color: rgba(220,38,38,0.9);
      box-shadow: 0 0 30px rgba(220,38,38,0.35);
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse{
      0%,100%{ transform: scale(1); }
      50%{ transform: scale(1.01); }
    }

    @media(max-width:900px){ body{grid-template-columns:repeat(2,1fr)} }
    @media(max-width:600px){ body{grid-template-columns:1fr} }

    @media print{
      body{
        background:#fff !important;
        color:#000 !important;
        grid-auto-rows: auto !important;
      }
      .toolbar{ display:none !important; }
      .tarjeta{
        break-inside:avoid;
        page-break-inside:avoid;
        box-shadow:none !important;
        background:#fff !important;
        border:1px solid #ddd !important;
      }
      .chart-label,.kpi{
        color:#000 !important;
        border-color:#ddd !important;
        background:transparent !important;
      }
      .badge-load{ display:none !important; }
    }
  </style>

  <script>
    (function(){
      const p = new URLSearchParams(location.search);
      if (p.get('export') === 'print'){
        window.addEventListener('load', () => window.print());
      }
    })();
  </script>
</head>

<body>

  <form class="toolbar" method="GET">
    <label>Rango
      <select name="range">
        <option value="15m" <?php echo ($range==='15m'?'selected':''); ?>>15 min</option>
        <option value="1h"  <?php echo ($range==='1h'?'selected':''); ?>>1 h</option>
        <option value="24h" <?php echo ($range==='24h'?'selected':''); ?>>24 h</option>
      </select>
    </label>

    <label>Interface
      <select name="iface">
        <?php if (!$ifaces): ?>
          <option value="">(sin CSV)</option>
        <?php else: ?>
          <?php foreach($ifaces as $i): ?>
            <option value="<?php echo htmlspecialchars($i); ?>" <?php echo ($selectedIface===$i?'selected':''); ?>>
              <?php echo htmlspecialchars($i); ?>
            </option>
          <?php endforeach; ?>
        <?php endif; ?>
      </select>
    </label>

    <label>Disk
      <select name="disk">
        <?php if (!$disks): ?>
          <option value="">(sin CSV)</option>
        <?php else: ?>
          <?php foreach($disks as $d): ?>
            <option value="<?php echo htmlspecialchars($d); ?>" <?php echo ($selectedDisk===$d?'selected':''); ?>>
              <?php echo htmlspecialchars($d); ?>
            </option>
          <?php endforeach; ?>
        <?php endif; ?>
      </select>
    </label>

    <label>Refresh
      <select name="refresh">
        <option value="0"    <?php echo ($refreshMs===0?'selected':''); ?>>off</option>
        <option value="2000" <?php echo ($refreshMs===2000?'selected':''); ?>>2s</option>
        <option value="5000" <?php echo ($refreshMs===5000?'selected':''); ?>>5s</option>
        <option value="10000"<?php echo ($refreshMs===10000?'selected':''); ?>>10s</option>
      </select>
    </label>

    <button type="submit">Aplicar</button>

    <span class="spacer"></span>

    <a href="?<?php
      $q = $_GET;
      $q['export'] = 'print';
      echo htmlspecialchars(http_build_query($q));
    ?>">Exportar (imprimir)</a>
  </form>

<?php
foreach ($endpoints as $i => $ep) {
  $url = $selfEndpointBase . urlencode($ep['endpoint']);

  if (isset($ep['iface']) && $ep['iface'] !== '') {
    $url .= '&iface=' . urlencode($ep['iface']);
  }
  if (isset($ep['disk']) && $ep['disk'] !== '') {
    $url .= '&disk=' . urlencode($ep['disk']);
  }

  // Para processes (snapshot), NO mandamos rango (no aporta y puede confundir)
  if ($ep['endpoint'] !== 'processes') {
    $url .= '&from=' . urlencode($fromStr) . '&to=' . urlencode($toStr);
  }

  $opts = [
    'id'         => 'chart_' . $i,
    'width'      => 220,
    'showLegend' => true,
    'type'       => $ep['type'],
    'dataUrl'    => $url,
    'auth'       => $auth,
    'kpiId'      => 'kpi_' . $i,
    'metric'     => $ep['endpoint'],
    'refreshMs'  => $refreshMs,
  ];

  if (isset($ep['showLegend'])) $opts['showLegend'] = (bool)$ep['showLegend'];
  if (isset($ep['valueKey'])) $opts['valueKey'] = $ep['valueKey'];
  if (isset($ep['labelKey'])) $opts['labelKey'] = $ep['labelKey'];

  $spanCol = ($ep['endpoint'] === 'disk_usage') ? 2 : 1;
  $spanRow = ($ep['endpoint'] === 'disk_usage') ? 2 : 1;

  echo '<div class="tarjeta" style="grid-column: span '.$spanCol.'; grid-row: span '.$spanRow.';">
          <div class="chart-label">'.htmlspecialchars($ep['label']).'</div>
          <div class="kpi" id="kpi_'.$i.'">—</div>
          <span class="badge-load">ALTA CARGA</span>
          <div class="tarjeta-inner">';
  render_svg_chart($opts);
  echo '  </div></div>';
}
?>

</body>
</html>

