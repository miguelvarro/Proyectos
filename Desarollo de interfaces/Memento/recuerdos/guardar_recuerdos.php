<?php
.

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

$file = __DIR__ . '/recuerdos.json';

function out($arr, $code = 200){
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  exit;
}

function read_json_file($path) {
  if (!file_exists($path)) return [];
  $raw = file_get_contents($path);
  if ($raw === false || trim($raw) === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function write_json_file($path, $data) {
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  return file_put_contents($path, $json, LOCK_EX) !== false;
}

function ensure_id(&$m) {
  if (!isset($m['_id']) || trim((string)$m['_id']) === '') {
    $m['_id'] = uniqid('m_', true);
  }
}

function ensure_schema(&$m){
  $fields = ['vista','momento','oido','sentimos','olemos','sabor','palpamos','pensamos','ubicacion','lecciones'];
  foreach($fields as $f){
    if (!isset($m[$f])) $m[$f] = '';
    if ($m[$f] === null) $m[$f] = '';
  }

  if (!isset($m['emociones']) || !is_array($m['emociones'])) $m['emociones'] = [];
  $emoKeys = ['alegria','tristeza','miedo','ira','asco','sorpresa'];
  foreach($emoKeys as $k){
    if (!isset($m['emociones'][$k])) $m['emociones'][$k] = 0;
    $m['emociones'][$k] = (int)($m['emociones'][$k] ?? 0);
  }
}

try {
  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

  // ========= GET: leer + auto-generar ids si faltan =========
  if ($method === 'GET') {
    $memories = read_json_file($file);

    $changed = false;
    foreach ($memories as &$m) {
      if (!is_array($m)) continue;
      $before = $m['_id'] ?? '';
      ensure_id($m);
      ensure_schema($m);
      if (($before ?? '') !== ($m['_id'] ?? '')) $changed = true;
    }
    unset($m);

    if ($changed) {
      if (!write_json_file($file, $memories)) out(['success'=>false,'error'=>'No se pudo escribir recuerdos.json (permisos)'], 500);
    }

    out($memories);
  }

  // ========= leer body =========
  $raw = file_get_contents('php://input');
  $body = json_decode($raw, true);

  if (!is_array($body)) {
    out(['success'=>false,'error'=>'JSON inválido'], 400);
  }

  $action = (string)($body['action'] ?? '');

  // ========= POST: acciones =========
  if ($method === 'POST') {

    // ----- CREATE -----
    if ($action === '' || $action === 'create') {
      $m = $body;
      unset($m['action']);

      ensure_id($m);
      ensure_schema($m);

      $memories = read_json_file($file);
      $memories[] = $m;

      if (!write_json_file($file, $memories)) out(['success'=>false,'error'=>'No se pudo escribir recuerdos.json (permisos)'], 500);

      out(['success'=>true, 'id'=>$m['_id']]);
    }

    // ----- UPDATE -----
    if ($action === 'update') {
      $m = $body['memory'] ?? null;
      if (!is_array($m)) out(['success'=>false,'error'=>'Falta memory'], 400);

      ensure_id($m);
      ensure_schema($m);
      $id = (string)$m['_id'];

      $memories = read_json_file($file);
      $found = false;

      for ($i=0; $i<count($memories); $i++){
        if (!is_array($memories[$i])) continue;
        if (($memories[$i]['_id'] ?? '') === $id) {
          $memories[$i] = $m;
          $found = true;
          break;
        }
      }

      if (!$found) out(['success'=>false,'error'=>'no existe ese _id'], 404);
      if (!write_json_file($file, $memories)) out(['success'=>false,'error'=>'No se pudo escribir recuerdos.json (permisos)'], 500);

      out(['success'=>true]);
    }

    // ----- DELETE -----
    if ($action === 'delete') {
      $id = (string)($body['id'] ?? '');
      if ($id === '') out(['success'=>false,'error'=>'Falta id'], 400);

      $memories = read_json_file($file);
      $before = count($memories);

      $memories = array_values(array_filter($memories, function($m) use ($id){
        return is_array($m) ? (($m['_id'] ?? '') !== $id) : true;
      }));

      if (count($memories) === $before) out(['success'=>false,'error'=>'no existe ese _id'], 404);
      if (!write_json_file($file, $memories)) out(['success'=>false,'error'=>'No se pudo escribir recuerdos.json (permisos)'], 500);

      out(['success'=>true]);
    }

    // ----- IMPORT -----
    if ($action === 'import') {
      $items = $body['items'] ?? null;
      if (!is_array($items)) out(['success'=>false,'error'=>'Falta items (array)'], 400);

      $memories = read_json_file($file);


      $byId = [];
      foreach ($memories as $m){
        if (!is_array($m)) continue;
        ensure_id($m);
        ensure_schema($m);
        $byId[$m['_id']] = $m;
      }

      $inserted = 0;
      $updated  = 0;

      foreach ($items as $m){
        if (!is_array($m)) continue;
        ensure_id($m);
        ensure_schema($m);

        if (isset($byId[$m['_id']])) $updated++;
        else $inserted++;

        $byId[$m['_id']] = $m;
      }

      $outArr = array_values($byId);

      if (!write_json_file($file, $outArr)) out(['success'=>false,'error'=>'No se pudo escribir recuerdos.json (permisos)'], 500);

      out(['success'=>true,'inserted'=>$inserted,'updated'=>$updated]);
    }

    out(['success'=>false,'error'=>'Acción no soportada'], 400);
  }

  out(['success'=>false,'error'=>'Método no soportado'], 405);

} catch (Throwable $e) {
  out(['success'=>false,'error'=>'Excepción en servidor: '.$e->getMessage()], 500);
}

