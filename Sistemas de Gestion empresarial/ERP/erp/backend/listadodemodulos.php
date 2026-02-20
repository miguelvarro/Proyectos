<?php
header('Content-Type: application/json');

if (isset($_GET['ruta']) && $_GET['ruta'] == "categorias") {
    require "config.php";

    $stmt = $pdo->prepare("SELECT * FROM categorias_aplicaciones");
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}

if (isset($_GET['ruta']) && $_GET['ruta'] == "aplicaciones") {
    require "config.php";

    $stmt = $pdo->prepare("SELECT * FROM aplicaciones");
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
?>

