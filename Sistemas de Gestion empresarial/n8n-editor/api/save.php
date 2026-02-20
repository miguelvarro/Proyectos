<?php
require_once __DIR__ . "/_utils.php";

[$ok, $payload] = read_json_body();
if (!$ok) json_response(["ok"=>false, "error"=>$payload]);

$path = data_path("workflow.json");
if (!$path) json_response(["ok"=>false, "error"=>"Ruta de datos no disponible"]);

$encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
if ($encoded === false) json_response(["ok"=>false, "error"=>"No se pudo serializar JSON"]);

if (file_put_contents($path, $encoded) === false) {
  json_response(["ok"=>false, "error"=>"No se pudo guardar el archivo"]);
}

json_response(["ok"=>true]);

