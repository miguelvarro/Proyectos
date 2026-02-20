SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Limpieza 
DROP TABLE IF EXISTS `aplicaciones`;
DROP TABLE IF EXISTS `categorias_aplicaciones`;
DROP TABLE IF EXISTS `usuarios`;

-- Tabla: usuarios
CREATE TABLE `usuarios` (
  `Identificador` INT NOT NULL AUTO_INCREMENT,
  `usuario` VARCHAR(50) NOT NULL,
  `contrasena` VARCHAR(50) NOT NULL,
  `nombrecompleto` VARCHAR(200) NOT NULL,
  PRIMARY KEY (`Identificador`),
  UNIQUE KEY `uk_usuario` (`usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `usuarios` (`Identificador`, `usuario`, `contrasena`, `nombrecompleto`)
VALUES (NULL, 'miguel', 'miguel', 'Miguel Angel Vargas');

-- Tabla: categorias_aplicaciones
CREATE TABLE `categorias_aplicaciones` (
  `Identificador` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`Identificador`),
  UNIQUE KEY `uk_categoria_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: aplicaciones
CREATE TABLE `aplicaciones` (
  `Identificador` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(120) NOT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `icono` VARCHAR(20) NOT NULL,
  `categoria_id` INT NULL,
  PRIMARY KEY (`Identificador`),
  UNIQUE KEY `uk_app_nombre` (`nombre`),
  KEY `idx_categoria_id` (`categoria_id`),
  CONSTRAINT `fk_aplicaciones_categoria`
    FOREIGN KEY (`categoria_id`) REFERENCES `categorias_aplicaciones` (`Identificador`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- inserts mínimos 
INSERT INTO `categorias_aplicaciones` (`Identificador`, `nombre`)
VALUES (NULL, 'Productividad');

INSERT INTO `categorias_aplicaciones` (`Identificador`, `nombre`)
VALUES (NULL, 'Gestión');

INSERT INTO `aplicaciones` (`Identificador`, `nombre`, `descripcion`, `icono`, `categoria_id`)
VALUES (NULL, 'Kanban', 'Tablero Kanban básico para tareas', 'KANBAN', 2);

SET FOREIGN_KEY_CHECKS = 1;

