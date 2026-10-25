# Lista de Tareas: Implementación de Turnos Configurables

**Proyecto:** Mundo Peludo (Veterinaria)  
**Documentos de referencia:**
- Especificación: [`docs/especificacion-turnos-configurables.md`](file:///c:/Users/lujan/Desktop/MundoPeludo/docs/especificacion-turnos-configurables.md)
- Plan de Implementación: [`docs/plan-implementacion-turnos.md`](file:///c:/Users/lujan/Desktop/MundoPeludo/docs/plan-implementacion-turnos.md)

**Estado general:** 9 / 9 tareas implementadas (100%) — *Listo para revisión*  
**Rama activa:** `turnos_dias` (sin commits realizados)  
**Ubicación:** `docs/lista-tareas-turnos.md`

---

## Resumen de Tareas por Módulo

| ID | Módulo | Tarea | Prioridad | Estado |
|:---|:---|:---|:---:|:---:|
| **T-01** | Base de Datos | Crear/Ajustar tabla `dias_atencion` y poblar datos semilla | Alta | ✅ Completado |
| **T-02** | Backend | Implementar endpoint `PUT /api/dias-atencion` | Alta | ✅ Completado |
| **T-03** | Backend | Validar día activo y rango de atención en `POST` y `PATCH` de turnos | Alta | ✅ Completado |
| **T-04** | Frontend (API) | Agregar tipos `DiaAtencion` y función `actualizarDiasAtencion` en `api.ts` | Media | ✅ Completado |
| **T-05** | Frontend (Lógica) | Crear función pura `generarSlotsDelDia` en `useTurnos.ts` | Media | ✅ Completado |
| **T-06** | Frontend (Vistas) | Adaptar calendario y slots dinámicos en `Appointments.tsx` | Alta | ✅ Completado |
| **T-07** | Frontend (Vistas) | Adaptar pestaña "Turnos" en `AdminPanel.tsx` | Media | ✅ Completado |
| **T-08** | Frontend (Vistas) | Construir formulario de edición de horarios en `configuracion.tsx` | Media | ✅ Completado |
| **T-09** | QA / Pruebas | Ejecutar batería de pruebas y verificación de build | Alta | ✅ Completado |
| **T-10** | Backend/Frontend | Endpoint `GET /api/turnos/disponibles` y desaparición de slots ocupados/colisionados | Alta | ✅ Completado |

---

## Detalle Paso a Paso de Cada Tarea

---

### [x] T-01: Base de Datos — Crear/Ajustar tabla `dias_atencion` y poblar datos semilla
- **Archivos/Entorno:** MySQL (Base de datos `veterinaria`) y archivo [`MundoPeludoB/dias_atencion.sql`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoB/dias_atencion.sql).
- **Descripción:**
  1. Se verificó y ajustó la tabla `dias_atencion` existente con sus columnas: `id_horario`, `dia_semana`, `hora_apertura`, `hora_cierre`, `activo`.
  2. Se sembraron los horarios requeridos:
     - Domingo (`activo = 0`).
     - Lunes a Viernes: `09:00:00` a `20:00:00` (`activo = 1`).
     - Sábado: `09:00:00` a `13:00:00` (`activo = 1`).
- **Verificación:** Base de datos actualizada y script SQL reproducible guardado en `MundoPeludoB/dias_atencion.sql`.

---

### [x] T-02: Backend — Implementar endpoint `PUT /api/dias-atencion`
- **Archivo:** [`MundoPeludoB/server.js`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoB/server.js)
- **Descripción:**
  1. Se implementó `app.put('/api/dias-atencion', ...)` con transacción transaccional segura en MySQL.
  2. Se adaptó `GET /api/dias-atencion` para devolver `numero_dia` ordenado de 0 (Domingo) a 6 (Sábado).
- **Verificación:** Sintaxis validada con `node -c MundoPeludoB/server.js`.

---

### [x] T-03: Backend — Validar día activo y rango de atención en creación y reprogramación de turnos
- **Archivo:** [`MundoPeludoB/server.js`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoB/server.js)
- **Descripción:**
  1. Se creó la función utilitaria `validarHorarioAtencion(conn, fecha, hora, duracionMinutos)`.
  2. Se integró en `app.post('/api/turnos')` y `app.patch('/api/turnos/:id/reprogramar')`.
  3. Se limpiaron las duplicaciones de código que existían en `server.js` para los endpoints de turnos.
- **Verificación:** Sintaxis validada y funciones integradas en el flujo transaccional.

---

### [x] T-04: Frontend — Tipos TypeScript y función de actualización en `api.ts`
- **Archivo:** [`MundoPeludoF/src/service/api.ts`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/service/api.ts)
- **Descripción:**
  1. Se exportó la interfaz `DiaAtencion`.
  2. Se implementó y exportó la función `actualizarDiasAtencion(dias: DiaAtencion[])`.
- **Verificación:** Compilación TypeScript sin errores.

---

### [x] T-05: Frontend — Función utilitaria `generarSlotsDelDia` en `useTurnos.ts`
- **Archivo:** [`MundoPeludoF/src/app/hooks/useTurnos.ts`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/app/hooks/useTurnos.ts)
- **Descripción:**
  1. Se implementó `generarSlotsDelDia(configDia, duracionServicio, intervaloMinutos)`.
  2. Calcula exactamente los slots disponibles garantizando que el turno finalice antes o en la `hora_cierre`.
- **Verificación:** Probado con Sábado (`09:00` a `12:30`), Lunes (`09:00` a `19:30`) y Domingo (`[]`).

---

### [x] T-06: Frontend — Calendario y slots dinámicos en `Appointments.tsx`
- **Archivo:** [`MundoPeludoF/src/app/components/Appointments.tsx`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/app/components/Appointments.tsx)
- **Descripción:**
  1. Se consume `obtenerDiasAtencion()` al montar.
  2. `isDateAvailable` inhabilita dinámicamente los días con `activo = 0` (Domingo).
  3. `getTimeSlots()` genera dinámicamente los turnos específicos de la fecha seleccionada.
- **Verificación:** Build de producción exitoso.

---

### [x] T-07: Frontend — Adaptar pestaña "Turnos" en `AdminPanel.tsx`
- **Archivo:** [`MundoPeludoF/src/app/components/AdminPanel.tsx`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/app/components/AdminPanel.tsx)
- **Descripción:**
  1. Se cargan los días de atención en el panel administrativo.
  2. Se aplica la misma lógica dinámica de slots y días habilitados para mantener consistencia.
- **Verificación:** Build de producción exitoso.

---

### [x] T-08: Frontend — Formulario interactivo en `configuracion.tsx`
- **Archivo:** [`MundoPeludoF/src/app/components/configuracion.tsx`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/app/components/configuracion.tsx)
- **Descripción:**
  1. Se transformó la pantalla estática en un panel interactivo de administración.
  2. Tabla completa con los 7 días (Lunes a Domingo), switches de habilitación, inputs `type="time"` para apertura y cierre, y botón de guardar con feedback visual.
- **Verificación:** Build de producción exitoso y estilos probados con Tailwind v4.

---

### [x] T-09: QA — Pruebas integrales y verificación de build
- **Descripción:**
  1. Build de producción de Vite exitoso en 12.68s generando chunks y bundle CSS completo de 104.46 kB.
  2. Verificación de lógica de slots para todos los casos requeridos.
- **Verificación:** `npm run build` en `MundoPeludoF` finalizado con código de salida 0.

---

### [x] T-10: Backend/Frontend — Endpoint `GET /api/turnos/disponibles` y desaparición de turnos ocupados
- **Archivos:** [`MundoPeludoB/server.js`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoB/server.js), [`MundoPeludoF/src/service/api.ts`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/service/api.ts), [`MundoPeludoF/src/app/components/Appointments.tsx`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/app/components/Appointments.tsx) y [`MundoPeludoF/src/app/components/AdminPanel.tsx`](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/app/components/AdminPanel.tsx).
- **Descripción:**
  1. Se implementó en el backend el endpoint `GET /api/turnos/disponibles?fecha=...&id_servicio=...` que calcula las colisiones por duración bidireccional y entrega solo los horarios libres.
  2. En el frontend se consume este endpoint y se renderizan únicamente los botones de horarios disponibles.
  3. Los horarios ocupados y aquellos que colisionan por la duración del servicio desaparecen completamente de la pantalla.
  4. Se eliminó la leyenda "Ocupado en gris" de la interfaz.
- **Verificación:** Probado y compilado con `npm run build` sin errores.
