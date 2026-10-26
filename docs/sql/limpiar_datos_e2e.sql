-- =====================================================================================================================
-- Limpieza de los datos que escribe la suite C de Maestro (docs/e2e.md § Suite C, ADR-0013).
-- NO SE EJECUTA SOLO. Se pega en el SQL Editor de Supabase (proyecto de DESARROLLO) y se ejecuta bloque por bloque.
--
--   1) EJECUTA PRIMERO EL BLOQUE 1 (SELECT, solo lectura) y revisa que las filas son SOLO las de la prueba.
--   2) Si todo es correcto, ejecuta el BLOQUE 2 (DELETE) con los MISMOS parámetros.
--   3) El BLOQUE 3 (auditoría) es OPCIONAL y está comentado.
--
-- Parámetros (reemplaza los marcadores en AMBOS bloques; ninguna cuenta real va en este archivo):
--   <ID_PACIENTE>   id_paciente del paciente de prueba (el mismo E2E_PACIENTE_ID de .maestro/.env.e2e.local)
--   <ID_MEDICO>     id_medico del médico de prueba
--   <DESDE>/<HASTA> ventana de fechas de la ejecución, formato AAAA-MM-DD (p. ej. el día de la prueba y el siguiente)
-- La suite escribe estas glucosas identificables: 93 (C1, por el médico), 57 (C2, por el médico) y 97 (C3, del paciente).
-- Tablas y orden por claves foráneas: retroalimentacion -> alertas -> registro_glucosa.
-- =====================================================================================================================


-- ============================== BLOQUE 1: VISTA PREVIA (solo SELECT, no borra nada) ==================================
WITH p AS (
  SELECT <ID_PACIENTE>::int AS id_paciente, <ID_MEDICO>::int AS id_medico,
         DATE '<DESDE>' AS desde, DATE '<HASTA>' AS hasta
),
reg AS (
  SELECT r.*
  FROM registro_glucosa r, p
  WHERE r.id_paciente = p.id_paciente
    AND r.fecha BETWEEN p.desde AND p.hasta
    AND r.nivel_glucosa IN (93, 57, 97)
    AND (r.id_medico = p.id_medico OR r.id_medico IS NULL)
)
SELECT 'registro_glucosa' AS tabla, count(*) AS filas FROM reg
UNION ALL
SELECT 'alertas', count(*) FROM alertas a WHERE a.id_registro IN (SELECT id_registro FROM reg)
UNION ALL
SELECT 'retroalimentacion', count(*) FROM retroalimentacion t
 WHERE t.alertas_id_alerta IN (SELECT id_alerta FROM alertas a WHERE a.id_registro IN (SELECT id_registro FROM reg));

-- Detalle de las lecturas que se borrarían (revisa id, fecha, hora y nivel):
WITH p AS (
  SELECT <ID_PACIENTE>::int AS id_paciente, <ID_MEDICO>::int AS id_medico,
         DATE '<DESDE>' AS desde, DATE '<HASTA>' AS hasta
)
SELECT r.id_registro, r.id_paciente, r.id_medico, r.id_momento, r.fecha, r.hora, r.nivel_glucosa
FROM registro_glucosa r, p
WHERE r.id_paciente = p.id_paciente
  AND r.fecha BETWEEN p.desde AND p.hasta
  AND r.nivel_glucosa IN (93, 57, 97)
  AND (r.id_medico = p.id_medico OR r.id_medico IS NULL)
ORDER BY r.fecha, r.hora;


-- ============================== BLOQUE 2: BORRADO (ejecútalo SOLO tras revisar el BLOQUE 1) ==========================
-- Una transacción: si algo no cuadra, cambia COMMIT por ROLLBACK. Los parámetros deben ser IGUALES a los del BLOQUE 1.
BEGIN;

CREATE TEMP TABLE p ON COMMIT DROP AS
  SELECT <ID_PACIENTE>::int AS id_paciente, <ID_MEDICO>::int AS id_medico,
         DATE '<DESDE>' AS desde, DATE '<HASTA>' AS hasta;

CREATE TEMP TABLE reg_e2e ON COMMIT DROP AS
  SELECT r.id_registro
  FROM registro_glucosa r, p
  WHERE r.id_paciente = p.id_paciente
    AND r.fecha BETWEEN p.desde AND p.hasta
    AND r.nivel_glucosa IN (93, 57, 97)
    AND (r.id_medico = p.id_medico OR r.id_medico IS NULL);

-- 1.º lo que depende de las alertas
DELETE FROM retroalimentacion
 WHERE alertas_id_alerta IN (SELECT id_alerta FROM alertas WHERE id_registro IN (SELECT id_registro FROM reg_e2e));
-- 2.º las alertas de esas lecturas
DELETE FROM alertas WHERE id_registro IN (SELECT id_registro FROM reg_e2e);
-- 3.º las lecturas
DELETE FROM registro_glucosa WHERE id_registro IN (SELECT id_registro FROM reg_e2e);

COMMIT;


-- ============================== BLOQUE 3 (OPCIONAL): auditoría de los inicios de sesión y llamadas de la prueba ======
-- Descomenta solo si quieres borrar también las filas de auditoría de las cuentas de prueba en la ventana. Ejecuta primero
-- el SELECT. <ID_USUARIO_PACIENTE> y <ID_USUARIO_MEDICO> son los id_usuario de las dos cuentas de prueba. Ajusta el nombre
-- de la columna de fecha si en tu esquema no se llama `fecha`.
--
-- SELECT count(*) FROM auditoria_endpoints
--  WHERE id_usuario IN (<ID_USUARIO_PACIENTE>, <ID_USUARIO_MEDICO>)
--    AND fecha >= DATE '<DESDE>' AND fecha < DATE '<HASTA>' + 1;
--
-- DELETE FROM auditoria_endpoints
--  WHERE id_usuario IN (<ID_USUARIO_PACIENTE>, <ID_USUARIO_MEDICO>)
--    AND fecha >= DATE '<DESDE>' AND fecha < DATE '<HASTA>' + 1;
