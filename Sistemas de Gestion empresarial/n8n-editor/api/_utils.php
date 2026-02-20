<?php
function read_json_body() {
  $raw = file_get_contents("php://input");
  $data = json_decode($raw, true);
  if (json_last_error() !== JSON_ERROR_NONE) return [false, "JSON inválido"];
  return [true, $data];
}

function data_path($file) {
  $base = realpath(__DIR__ . "/../data");
  if ($base === false) return null;
  return $base . DIRECTORY_SEPARATOR . $file;
}

function json_response($arr) {
  header("Content-Type: application/json; charset=utf-8");
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

