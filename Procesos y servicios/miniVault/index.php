<?php
declare(strict_types=1);
session_start();

/**
 * Mini Vault - Fundamentos de encriptación
 * - Base64 encode/decode
 * - Hash md5/sha1
 * - Verificación hash (md5/sha1): compara hash esperado vs calculado
 * - Encriptación básica: shift ASCII (+/-)
 * - Historial en sesión + Export JSON/CSV
 */

// Encriptación básica 
class Encriptador {
  private int $shift;

  public function __construct(int $shift = 5) {
    $this->shift = $shift;
  }

  public function encriptar(string $texto): string {
    return $this->shiftText($texto, +$this->shift);
  }

  public function desencriptar(string $texto): string {
    return $this->shiftText($texto, -$this->shift);
  }

  private function shiftText(string $texto, int $delta): string {
    $out = '';
    $len = strlen($texto);
    for ($i = 0; $i < $len; $i++) {
      $code = ord($texto[$i]);
      $out .= chr(($code + $delta) & 0xFF);
    }
    return $out;
  }
}

// Helpers
function h(?string $s): string {
  return htmlspecialchars($s ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function add_history(string $tipo, string $entrada, string $salida, array $extra = []): void {
  if (!isset($_SESSION['history']) || !is_array($_SESSION['history'])) {
    $_SESSION['history'] = [];
  }
  $_SESSION['history'][] = [
    'ts' => date('Y-m-d H:i:s'),
    'tipo' => $tipo,
    'entrada' => $entrada,
    'salida' => $salida,
    'extra' => $extra,
  ];
  if (count($_SESSION['history']) > 50) {
    $_SESSION['history'] = array_slice($_SESSION['history'], -50);
  }
}

function post_str(string $key): string {
  return isset($_POST[$key]) ? (string)$_POST[$key] : '';
}

function post_int(string $key, int $default): int {
  if (!isset($_POST[$key])) return $default;
  $v = filter_var($_POST[$key], FILTER_VALIDATE_INT);
  return ($v === false) ? $default : (int)$v;
}

function get_str(string $key): string {
  return isset($_GET[$key]) ? (string)$_GET[$key] : '';
}

function normalize_hash(string $hash): string {
  return strtolower(trim($hash));
}

function hash_equals_safe(string $a, string $b): bool {
  if (function_exists('hash_equals')) return hash_equals($a, $b);
  if (strlen($a) !== strlen($b)) return false;
  $res = 0;
  for ($i = 0; $i < strlen($a); $i++) $res |= ord($a[$i]) ^ ord($b[$i]);
  return $res === 0;
}

// Export historial (JSON / CSV)
$history = $_SESSION['history'] ?? [];
if (!is_array($history)) $history = [];

$export = strtolower(get_str('export'));
if ($export === 'json') {
  header('Content-Type: application/json; charset=utf-8');
  header('Content-Disposition: attachment; filename="historial_mini_vault.json"');
  echo json_encode($history, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  exit;
}
if ($export === 'csv') {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="historial_mini_vault.csv"');

  $out = fopen('php://output', 'w');
  fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));

  fputcsv($out, ['ts', 'tipo', 'entrada', 'salida', 'extra']);
  foreach ($history as $item) {
    $extra = isset($item['extra']) ? json_encode($item['extra'], JSON_UNESCAPED_UNICODE) : '';
    fputcsv($out, [
      $item['ts'] ?? '',
      $item['tipo'] ?? '',
      $item['entrada'] ?? '',
      $item['salida'] ?? '',
      $extra
    ]);
  }
  fclose($out);
  exit;
}

// Acciones
$resultado = '';
$error = '';
$info = '';
$modo = 'base64_encode';

if (isset($_POST['clear_history'])) {
  $_SESSION['history'] = [];
  $history = [];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['modo'])) {
  $modo = post_str('modo');
  $texto = post_str('texto');
  $shift = post_int('shift', 5);
  $hash_esperado = post_str('hash_esperado');

  try {
    switch ($modo) {
      // Base64
      case 'base64_encode':
        if ($texto === '') { $error = "Introduce un texto para codificar."; break; }
        $resultado = base64_encode($texto);
        add_history('Base64 Encode', $texto, $resultado);
        break;

      case 'base64_decode':
        if ($texto === '') { $error = "Introduce un Base64 para descodificar."; break; }
        $decoded = base64_decode($texto, true);
        if ($decoded === false) {
          $error = "Base64 inválido (no se puede descodificar en modo estricto).";
        } else {
          $resultado = $decoded;
          add_history('Base64 Decode', $texto, $resultado);
        }
        break;

      // Hash
      case 'hash_md5':

        $resultado = md5($texto);
        add_history('Hash MD5', $texto, $resultado);
        break;

      case 'hash_sha1':
        $resultado = sha1($texto);
        add_history('Hash SHA1', $texto, $resultado);
        break;

      // Verificación hash
      case 'verify_md5':
        if ($texto === '') { $error = "Introduce un texto para verificar."; break; }
        if (trim($hash_esperado) === '') { $error = "Introduce el hash esperado (MD5)."; break; }
        $calc = md5($texto);
        $expected = normalize_hash($hash_esperado);
        $ok = hash_equals_safe($calc, $expected);
        $resultado = $calc;
        $info = $ok ? "✅ COINCIDE: el hash esperado y el calculado son iguales." : "❌ NO COINCIDE: el texto no produce ese hash.";
        add_history('Verificar MD5', $texto, $calc, ['hash_esperado' => $expected, 'coincide' => $ok]);
        break;

      case 'verify_sha1':
        if ($texto === '') { $error = "Introduce un texto para verificar."; break; }
        if (trim($hash_esperado) === '') { $error = "Introduce el hash esperado (SHA1)."; break; }
        $calc = sha1($texto);
        $expected = normalize_hash($hash_esperado);
        $ok = hash_equals_safe($calc, $expected);
        $resultado = $calc;
        $info = $ok ? "✅ COINCIDE: el hash esperado y el calculado son iguales." : "❌ NO COINCIDE: el texto no produce ese hash.";
        add_history('Verificar SHA1', $texto, $calc, ['hash_esperado' => $expected, 'coincide' => $ok]);
        break;

      // Encriptación básica
      case 'cipher_encrypt':
        if ($texto === '') { $error = "Introduce un texto para encriptar."; break; }
        $enc = new Encriptador($shift);
        $resultado = $enc->encriptar($texto);
        add_history('Cifrado básico (Shift) - Encriptar', $texto, $resultado, ['shift' => $shift]);
        break;

      case 'cipher_decrypt':
        if ($texto === '') { $error = "Introduce un texto para desencriptar."; break; }
        $enc = new Encriptador($shift);
        $resultado = $enc->desencriptar($texto);
        add_history('Cifrado básico (Shift) - Desencriptar', $texto, $resultado, ['shift' => $shift]);
        break;

      default:
        $error = "Modo no reconocido.";
    }
  } catch (Throwable $e) {
    $error = "Error procesando: " . $e->getMessage();
  }
}

// refrescar historial 
$history = $_SESSION['history'] ?? [];
if (!is_array($history)) $history = [];

?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mini Vault — Fundamentos de Encriptación</title>
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
    .wrap{max-width:1100px;margin:0 auto;padding:24px}
    .title{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:16px}
    .title h1{margin:0;font-size:22px}
    .title .sub{color:var(--muted);font-size:14px}
    .grid{display:grid;grid-template-columns: 1.1fr .9fr;gap:16px}
    @media (max-width: 900px){ .grid{grid-template-columns:1fr} }

    .card{
      background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
      border:1px solid var(--border);
      border-radius:16px;
      overflow:hidden;
      box-shadow: 0 14px 34px rgba(0,0,0,.35);
    }
    .card .hd{
      padding:14px 16px;
      border-bottom:1px solid var(--border);
      display:flex;justify-content:space-between;align-items:center;gap:10px;
      background:rgba(0,0,0,.22);
      flex-wrap:wrap;
    }
    .card .hd strong{font-size:14px}
    .card .bd{padding:16px}

    label{display:block;font-size:12px;color:var(--muted);margin-bottom:6px}
    textarea, input[type="text"]{
      width:100%;
      padding:12px;
      border-radius:12px;
      border:1px solid var(--border);
      background:rgba(0,0,0,.28);
      color:var(--text);
      outline:none;
    }
    textarea{min-height:140px;resize:vertical}
    textarea:focus, input[type="text"]:focus{
      border-color:rgba(255,122,24,.5);
      box-shadow:0 0 0 3px rgba(255,122,24,.18)
    }
    select,input[type="number"]{
      width:100%;
      padding:10px 12px;
      border-radius:12px;
      border:1px solid var(--border);
      background:rgba(0,0,0,.28);
      color:var(--text);
      outline:none;
    }
    .row{display:grid;grid-template-columns: 1fr 150px;gap:10px;align-items:end}
    @media (max-width: 520px){ .row{grid-template-columns:1fr} }

    .btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
    button,a.btnlink{
      border:1px solid var(--border);
      background:rgba(255,255,255,.06);
      color:var(--text);
      padding:10px 14px;
      border-radius:12px;
      cursor:pointer;
      transition: transform .06s ease, background .15s ease, border-color .15s ease;
      font-weight:700;
      text-decoration:none;
      display:inline-flex;
      align-items:center;
      gap:8px;
    }
    button:hover,a.btnlink:hover{background:rgba(255,255,255,.10);border-color:rgba(255,122,24,.35)}
    button:active,a.btnlink:active{transform:translateY(1px)}
    .primary{
      background:linear-gradient(180deg, rgba(255,122,24,.95), rgba(255,154,61,.90));
      border-color:rgba(255,255,255,.18);
      color:#111;
    }
    .danger{
      border-color:rgba(255,75,75,.35);
      background:rgba(255,75,75,.12);
    }
    .pill{
      font-size:12px;color:rgba(17,17,17,.9);
      background:linear-gradient(180deg, rgba(255,122,24,.95), rgba(255,154,61,.90));
      padding:6px 10px;border-radius:999px;font-weight:800;
    }

    .msg{margin:10px 0 0 0;font-size:13px}
    .msg.err{color:var(--danger)}
    .msg.ok{color:var(--ok)}
    .msg.info{color:var(--accent2)}

    pre{
      margin:0;
      white-space:pre-wrap;
      word-break:break-word;
      padding:12px;
      border-radius:12px;
      border:1px solid var(--border);
      background:rgba(0,0,0,.28);
      color:var(--text);
      min-height:140px;
    }
    .small{font-size:12px;color:var(--muted)}
    table{width:100%;border-collapse:collapse}
    th,td{padding:10px;border-bottom:1px solid var(--border);vertical-align:top}
    th{font-size:12px;color:var(--muted);text-align:left}
    td{font-size:13px}
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
    .hashBox{margin-top:12px}
  </style>
</head>
<body>
<div class="wrap">

  <div class="title">
    <h1>Mini Vault</h1>
    <span class="pill">Base64 · Hash · Verificación · Export</span>
    <span class="sub">Proyecto: Fundamentos de encriptación</span>
  </div>

  <div class="grid">

    <div class="card">
      <div class="hd">
        <strong>Entrada y operación</strong>
        <span class="small">Funcionalidades añadidas: verificación + exportar historial</span>
      </div>
      <div class="bd">
        <form method="post" autocomplete="off">
          <div class="row">
            <div>
              <label for="modo">Modo</label>
              <select id="modo" name="modo">
                <optgroup label="Base64">
                  <option value="base64_encode" <?= $modo==='base64_encode'?'selected':''; ?>>Base64 · Codificar (encode)</option>
                  <option value="base64_decode" <?= $modo==='base64_decode'?'selected':''; ?>>Base64 · Descodificar (decode)</option>
                </optgroup>

                <optgroup label="Hash (huella)">
                  <option value="hash_md5" <?= $modo==='hash_md5'?'selected':''; ?>>Hash · MD5</option>
                  <option value="hash_sha1" <?= $modo==='hash_sha1'?'selected':''; ?>>Hash · SHA1</option>
                </optgroup>

                <optgroup label="Verificación (integridad)">
                  <option value="verify_md5" <?= $modo==='verify_md5'?'selected':''; ?>>Verificar · MD5 (texto vs hash)</option>
                  <option value="verify_sha1" <?= $modo==='verify_sha1'?'selected':''; ?>>Verificar · SHA1 (texto vs hash)</option>
                </optgroup>

                <optgroup label="Cifrado básico">
                  <option value="cipher_encrypt" <?= $modo==='cipher_encrypt'?'selected':''; ?>>Cifrado · Encriptar (Shift)</option>
                  <option value="cipher_decrypt" <?= $modo==='cipher_decrypt'?'selected':''; ?>>Cifrado · Desencriptar (Shift)</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label for="shift">Shift (cifrado)</label>
              <input id="shift" name="shift" type="number" value="<?= h((string)post_int('shift', 5)); ?>" min="-50" max="50">
            </div>
          </div>

          <div style="margin-top:12px;">
            <label for="texto">Texto de entrada</label>
            <textarea id="texto" name="texto" placeholder="Escribe aquí tu texto..."><?= h(post_str('texto')); ?></textarea>
            <div class="small">
              Base64 = codificación · Hash = huella unidireccional · Verificación = integridad · Cifrado (Shift) = reversible con clave (shift).
            </div>
          </div>

          <div class="hashBox" id="hashBox">
            <label for="hash_esperado">Hash esperado (para verificación)</label>
            <input id="hash_esperado" name="hash_esperado" type="text"
                   placeholder="Pega aquí el MD5 o SHA1 esperado..."
                   value="<?= h(post_str('hash_esperado')); ?>">
            <div class="small">Se compara con el hash calculado del texto (ignorando mayúsculas y espacios).</div>
          </div>

          <div class="btns">
            <button class="primary" type="submit">Procesar</button>
            <button class="danger" type="submit" name="clear_history" value="1">Borrar historial</button>
          </div>

          <?php if ($error): ?>
            <p class="msg err"><?= h($error); ?></p>
          <?php elseif ($info): ?>
            <p class="msg info"><?= h($info); ?></p>
          <?php elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['modo'])): ?>
            <p class="msg ok">Operación realizada.</p>
          <?php endif; ?>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="hd">
        <strong>Salida</strong>
        <span class="small mono"><?= h($modo); ?></span>
      </div>
      <div class="bd">
        <label>Resultado</label>
        <pre class="mono"><?= h($resultado); ?></pre>
        <div class="small" style="margin-top:10px;">
          En verificación, la “Salida” muestra el hash calculado. El mensaje indica si coincide con el esperado.
        </div>
      </div>
    </div>

    <div class="card" style="grid-column: 1 / -1;">
      <div class="hd">
        <strong>Historial (sesión)</strong>
        <div class="btns" style="margin:0;">
          <a class="btnlink" href="?export=json">⬇ Exportar JSON</a>
          <a class="btnlink" href="?export=csv">⬇ Exportar CSV</a>
        </div>
      </div>
      <div class="bd">
        <?php if (!$history): ?>
          <div class="small">Todavía no hay operaciones guardadas.</div>
        <?php else: ?>
          <table>
            <thead>
              <tr>
                <th style="width:170px;">Fecha</th>
                <th style="width:260px;">Tipo</th>
                <th>Entrada</th>
                <th>Salida</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach (array_reverse($history) as $item): ?>
                <tr>
                  <td class="mono"><?= h($item['ts'] ?? ''); ?></td>
                  <td>
                    <?= h($item['tipo'] ?? ''); ?>
                    <?php if (!empty($item['extra'])): ?>
                      <div class="small mono"><?= h(json_encode($item['extra'], JSON_UNESCAPED_UNICODE)); ?></div>
                    <?php endif; ?>
                  </td>
                  <td class="mono"><?= h($item['entrada'] ?? ''); ?></td>
                  <td class="mono"><?= h($item['salida'] ?? ''); ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        <?php endif; ?>
      </div>
    </div>

  </div>
</div>

<script>
  const modo = document.getElementById('modo');
  const shift = document.getElementById('shift');
  const hashBox = document.getElementById('hashBox');

  function syncUI() {
    const v = modo.value;
    const isCipher = (v === 'cipher_encrypt' || v === 'cipher_decrypt');
    const isVerify = (v === 'verify_md5' || v === 'verify_sha1');

    shift.disabled = !isCipher;
    shift.style.opacity = isCipher ? "1" : ".5";

    hashBox.style.display = isVerify ? "block" : "none";
  }

  modo.addEventListener('change', syncUI);
  syncUI();
</script>
</body>
</html>

