<?php
header('Content-Type: application/json; charset=utf-8');

function respond($arr, int $code = 200) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  exit;
}

try {
  $raw = file_get_contents('php://input');
  if ($raw === false) throw new RuntimeException("No se pudo leer el body.");

  $payload = json_decode($raw, true);
  if (!is_array($payload)) throw new RuntimeException("JSON inválido.");

  if (!isset($payload['data']) || !is_array($payload['data'])) {
    throw new InvalidArgumentException("Falta 'data' o no es un objeto/array JSON.");
  }

  $dir = __DIR__ . '/data';
  if (!is_dir($dir)) mkdir($dir, 0775, true);

  $file = $dir . '/kanban.json';
  $json = json_encode($payload['data'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) throw new RuntimeException("No se pudo serializar el Kanban.");

  if (file_put_contents($file, $json) === false) {
    throw new RuntimeException("No se pudo escribir el archivo kanban.json.");
  }

  respond([
    'ok' => true,
    'message' => 'Kanban guardado en JSON correctamente.',
    'file' => 'data/kanban.json',
    'bytes' => strlen($json)
  ]);
} catch (Throwable $e) {
  respond(['ok' => false, 'error' => $e->getMessage()], 400);
}

