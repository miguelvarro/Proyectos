<?php
// api/http_proxy.php
// Recibe { url, method, headers, body, timeoutMs } y ejecuta la request con cURL.
// Devuelve { ok, status, headers, data }

header("Content-Type: application/json; charset=utf-8");

$raw = file_get_contents("php://input");
$payload = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
  echo json_encode(["ok"=>false, "error"=>"JSON inválido"]);
  exit;
}

$url = $payload["url"] ?? "";
$method = strtoupper($payload["method"] ?? "GET");
$headers = $payload["headers"] ?? [];
$body = $payload["body"] ?? "";
$timeoutMs = intval($payload["timeoutMs"] ?? 8000);

if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
  echo json_encode(["ok"=>false, "error"=>"URL inválida"]);
  exit;
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_TIMEOUT_MS, $timeoutMs);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT_MS, $timeoutMs);

// headers
$headerLines = [];
if (is_array($headers)) {
  foreach ($headers as $k => $v) {
    $headerLines[] = $k . ": " . $v;
  }
}
if ($headerLines) curl_setopt($ch, CURLOPT_HTTPHEADER, $headerLines);

// body
if (!in_array($method, ["GET","HEAD"])) {
  curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

// capturar headers de respuesta
$respHeaders = [];
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($ch, $header) use (&$respHeaders) {
  $len = strlen($header);
  $header = trim($header);
  if ($header === "" || str_starts_with($header, "HTTP/")) return $len;
  $parts = explode(":", $header, 2);
  if (count($parts) === 2) {
    $respHeaders[trim($parts[0])] = trim($parts[1]);
  }
  return $len;
});

$response = curl_exec($ch);
$err = curl_error($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
  echo json_encode(["ok"=>false, "error"=>$err ?: "Error cURL"]);
  exit;
}

// intenta JSON
$data = $response;
$parsed = json_decode($response, true);
if (json_last_error() === JSON_ERROR_NONE) $data = $parsed;

echo json_encode([
  "ok" => ($status >= 200 && $status < 300),
  "status" => $status,
  "headers" => $respHeaders,
  "data" => $data
], JSON_UNESCAPED_UNICODE);

