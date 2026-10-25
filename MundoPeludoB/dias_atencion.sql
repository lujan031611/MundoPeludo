-- Estructura y datos iniciales para la tabla dias_atencion
CREATE TABLE IF NOT EXISTS dias_atencion (
  id_horario INT AUTO_INCREMENT PRIMARY KEY,
  dia_semana ENUM('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo') NOT NULL UNIQUE,
  hora_apertura TIME NOT NULL,
  hora_cierre TIME NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1
);

-- Datos semilla: Lunes a Viernes de corrido 09:00 a 20:00, Sábados 09:00 a 13:00, Domingos inactivo
INSERT INTO dias_atencion (id_horario, dia_semana, hora_apertura, hora_cierre, activo)
VALUES
  (1, 'Lunes',     '09:00:00', '20:00:00', 1),
  (2, 'Martes',    '09:00:00', '20:00:00', 1),
  (3, 'Miércoles', '09:00:00', '20:00:00', 1),
  (4, 'Jueves',    '09:00:00', '20:00:00', 1),
  (5, 'Viernes',   '09:00:00', '20:00:00', 1),
  (6, 'Sábado',    '09:00:00', '13:00:00', 1),
  (7, 'Domingo',   '00:00:00', '00:00:00', 0)
ON DUPLICATE KEY UPDATE
  hora_apertura = VALUES(hora_apertura),
  hora_cierre = VALUES(hora_cierre),
  activo = VALUES(activo);

