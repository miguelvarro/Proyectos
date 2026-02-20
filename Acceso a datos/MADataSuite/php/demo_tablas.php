<?php
$config = require __DIR__ . "/config.php";
require __DIR__ . "/MADB.php";

$db = new MADB($config["host"], $config["user"], $config["password"], $config["database"]);
header("Content-Type: application/json; charset=utf-8");
echo $db->tablas();

