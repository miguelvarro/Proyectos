<?php
require_once __DIR__ . "/_utils.php";

$path = data_path("workflow.json");
if (!$path) json_response(["ok"=>false, "error"=>"Ruta de datos no disponible"]);

if (!file_exists($path)) {
  json_response(["ok"=>true, "data"=>["nodes"=>new stdClass(), "edges"=>[]]]);
}

$raw = file_get_contents($path);
$data = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
  json_response(["ok"=>false, "error"=>"El JSON guardado está corrupto"]);
}

json_response(["ok"=>true, "data"=>$data]);

