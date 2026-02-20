<?php
$config = require __DIR__ . "/config.php";
require __DIR__ . "/MADB.php";

$q = $_GET["q"] ?? "";
$db = new MADB($config["host"], $config["user"], $config["password"], $config["database"]);
header("Content-Type: application/json; charset=utf-8");
echo $db->buscar("clientes_simple", "nombre", $q);

