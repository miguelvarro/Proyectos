<?php
/**
 * JsonSqliteBridge (mini)
 * - Guarda/recupera el kanban como JSON en una SQLite.
 * - Mantiene la API que usa savekanban.php:
 *    - loadFromArray($data, $dbPath)
 *    - dumpToArray($dbPath)
 */

class JsonSqliteBridge
{
    private function connect(string $dbPath): SQLite3
    {
        $db = new SQLite3($dbPath);
        $db->exec('PRAGMA foreign_keys = ON;');
        $db->exec('PRAGMA journal_mode = WAL;');
        return $db;
    }

    public function loadFromArray(array $data, string $dbPath): void
    {
        // Crea BD nueva siempre
        if (file_exists($dbPath)) {
            @unlink($dbPath);
        }

        $db = $this->connect($dbPath);

        $db->exec("
            CREATE TABLE IF NOT EXISTS kanban_store (
                Identificador INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                json TEXT NOT NULL
            )
        ");

        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($json === false) {
            throw new RuntimeException("No se pudo serializar el JSON.");
        }

        $stmt = $db->prepare("INSERT INTO kanban_store (created_at, json) VALUES (:created_at, :json)");
        $stmt->bindValue(":created_at", date('c'), SQLITE3_TEXT);
        $stmt->bindValue(":json", $json, SQLITE3_TEXT);

        $ok = $stmt->execute();
        if (!$ok) {
            throw new RuntimeException("No se pudo insertar en SQLite.");
        }

        $db->close();
    }

    public function dumpToArray(string $dbPath): array
    {
        if (!file_exists($dbPath)) {
            return [];
        }

        $db = $this->connect($dbPath);

        $res = $db->query("SELECT json FROM kanban_store ORDER BY Identificador DESC LIMIT 1");
        $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : null;

        $db->close();

        if (!$row || !isset($row['json'])) {
            return [];
        }

        $arr = json_decode($row['json'], true);
        return is_array($arr) ? $arr : [];
    }
}

