<?php
require "config.php";

$json = file_get_contents("php://input");
$data = json_decode($json, true);

if (!$data || !isset($data["usuario"]) || !isset($data["contrasena"])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid input"]);
    exit;
}

$usuario = $data["usuario"];
$contrasena = $data["contrasena"];

$stmt = $pdo->prepare("SELECT * FROM usuarios WHERE usuario = :usuario AND contrasena = :contrasena");
$stmt->execute([
    ":usuario" => $usuario,
    ":contrasena" => $contrasena
]);

$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user) {
    echo json_encode(["success" => true, "nombrecompleto" => $user["nombrecompleto"]]);
} else {
    echo json_encode(["success" => false]);
}

