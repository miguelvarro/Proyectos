-- Crea tablas para MADB (raw) y MAORM (JSON) en la BD ya existente.

CREATE TABLE IF NOT EXISTS clientes_simple (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255),
  apellidos VARCHAR(255),
  email VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255),
  apellidos VARCHAR(255),
  emails JSON
);

