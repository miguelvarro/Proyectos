<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../erp/backend/config.php';

function respond($arr, int $code=200){
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  exit;
}

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);
$q = trim(($data['question'] ?? ''));

if ($q === '') respond(['ok'=>false,'error'=>'Falta question'], 400);

$qLower = mb_strtolower($q);

$sql = null;

if (preg_match('/usuario|usuarios|login|sesión|sesion/u', $qLower)) {
  $sql = "SELECT Identificador, usuario, nombrecompleto FROM usuarios LIMIT 50";
}
else if (preg_match('/aplicacion|aplicaciones|m[oó]dulos|modulos/u', $qLower)) {

  $sql = "SELECT * FROM aplicaciones LIMIT 50";
}
else if (preg_match('/categor[ií]a|categorias|categorías/u', $qLower)) {

  $sql = "SELECT * FROM categorias_aplicaciones LIMIT 50";
}
else if (preg_match('/select\s+/u', $qLower)) {

  $sql = $q;
}
else {
  respond([
    'ok' => false,
    'error' => "No entendí la pregunta. Prueba: 'usuarios', 'aplicaciones', 'categorías' o pega un SELECT."
  ], 400);
}


if (!preg_match('/^\s*select\s+/i', $sql)) {
  respond(['ok'=>false,'error'=>'Solo se permiten consultas SELECT'], 400);
}

try {
  $stmt = $pdo->prepare($sql);
  $stmt->execute();
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  respond([
    'ok' => true,
    'question' => $q,
    'sql' => $sql,
    'rows' => $rows
  ]);
} catch (Throwable $e) {
  respond(['ok'=>false,'error'=>$e->getMessage(), 'sql'=>$sql], 500);
}

