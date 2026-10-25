# Análisis y Propuesta: Obtención Dinámica de Disponibilidad de Turnos

**Proyecto:** Mundo Peludo (Veterinaria)  
**Fecha:** 25 de Octubre de 2026  
**Ubicación:** `docs/propuesta-disponibilidad-turnos.md`  
**Estado:** Propuesta Técnica / En revisión  

---

## 1. Planteamiento del Problema

El usuario plantea:
> *"Necesito modificar la forma en que se obtienen los turnos. Porque si ya se obtuvo un turno en un horario específico y, dependiendo de la duración del servicio, debería desaparecer la posibilidad de sacar un turno en dicho horario."*

Actualmente, el sistema presenta tres limitaciones importantes:

1. **La forma en que se obtienen los turnos:**  
   El frontend consulta `GET /api/turnos`, que devuelve **todos los turnos ocupados** de la base de datos (con nombres de clientes, mascotas, servicios y motivos). La interfaz es la que intenta calcular la disponibilidad en el navegador. Esto expone datos privados de clientes y sobrecarga al cliente con lógica de negocio.
2. **Los horarios ocupados no desaparecen:**  
   En [Appointments.tsx](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/app/components/Appointments.tsx), cuando un horario está ocupado, se sigue mostrando en la grilla pintado de gris con la leyenda `Ocupado`. El requerimiento solicita explícitamente que los horarios no disponibles **desaparezcan** de la vista, mostrando únicamente las opciones reales en las que se puede reservar.
3. **Colisión bidireccional por duración de servicio:**  
   Si un servicio dura 60 minutos (ej. un Baño o cirugía menor) y se reserva a las `10:00`, ocupa la franja de `10:00` a `11:00`:
   - No solo debe desaparecer el slot de las `10:00`.
   - También debe desaparecer el slot de las `10:30` (porque cae dentro del turno tomado).
   - Y si otro cliente desea reservar un servicio de 60 minutos, el slot de las `09:30` **también debe desaparecer**, porque un turno de 09:30 a 10:30 colisionaría con el turno que comienza a las 10:00.

---

## 2. Análisis del Algoritmo de Solapamiento

Para determinar si un horario candidato `[inicio_candidato, fin_candidato]` está libre, debe compararse contra cada turno ya reservado `[inicio_existente, fin_existente]`:

$$\text{Hay Solapamiento} \iff (\text{inicio\_candidato} < \text{fin\_existente}) \land (\text{inicio\_existente} < \text{fin\_candidato})$$

Donde:
- $\text{fin\_candidato} = \text{inicio\_candidato} + \text{duración del servicio solicitado}$
- $\text{fin\_existente} = \text{inicio\_existente} + \text{duración del servicio ya reservado}$

### Ejemplo Gráfico:
Supongamos que el horario de atención es de `09:00` a `13:00` con intervalos de 30 minutos, y **existe un turno reservado a las 10:00 de 60 minutos de duración** (ocupa de 10:00 a 11:00):

#### Caso A: Un cliente quiere reservar una "Consulta" (Duración: 30 min)
- `09:00 a 09:30` ➔ ✅ **Disponible** (Aparece)
- `09:30 a 10:00` ➔ ✅ **Disponible** (Aparece)
- `10:00 a 10:30` ➔ ❌ **Ocupado** (Desaparece)
- `10:30 a 11:00` ➔ ❌ **Ocupado** (Desaparece)
- `11:00 a 11:30` ➔ ✅ **Disponible** (Aparece)
- `11:30 a 12:00` ➔ ✅ **Disponible** (Aparece)

#### Caso B: Un cliente quiere reservar un "Baño" (Duración: 60 min)
- `09:00 a 10:00` ➔ ✅ **Disponible** (Aparece)
- `09:30 a 10:30` ➔ ❌ **Colisiona con 10:00-11:00** ➔ **DESAPARECE**
- `10:00 a 11:00` ➔ ❌ **Ocupado** ➔ **DESAPARECE**
- `10:30 a 11:30` ➔ ❌ **Colisiona con 10:00-11:00** ➔ **DESAPARECE**
- `11:00 a 12:00` ➔ ✅ **Disponible** (Aparece)

> [!IMPORTANT]  
> **Conclusión técnica:** Para saber qué turnos deben desaparecer, **es imprescindible conocer la duración del servicio que se quiere reservar**. Por ello, el servicio debe elegirse antes o seleccionarse uno por defecto.

---

## 3. Propuesta de Solución (Sin sobre-ingeniería)

### 3.1 Nuevo Endpoint en Backend: `GET /api/turnos/disponibles`

En lugar de que el frontend descargue todos los turnos ocupados y haga cálculos pesados, creamos un endpoint dedicado en Express:

```text
GET /api/turnos/disponibles?fecha=2026-10-27&id_servicio=2
```

#### Flujo del Endpoint:
1. Recibe `fecha` (`YYYY-MM-DD`) y `id_servicio` (número).
2. Consulta la duración y tipo del servicio solicitado (`duracion_minutos`, `es_bano`).
3. Consulta la configuración del día en `dias_atencion` (`activo`, `hora_apertura`, `hora_cierre`).
   - Si el día está inactivo (`activo = 0`), devuelve lista vacía `[]`.
4. Genera todos los slots posibles del día (ej. `09:00`, `09:30`, ..., hasta `hora_cierre - duracion`).
5. Consulta en la tabla `turnos` los turnos activos de esa fecha (filtrando por la agenda correspondiente: baño o clínica).
6. **Filtra y descarta** cualquier horario que colisione con un turno existente.
7. Devuelve **únicamente la lista de horarios 100% disponibles**:
   ```json
   {
     "fecha": "2026-10-27",
     "servicioId": 2,
     "duracion": 60,
     "horariosDisponibles": ["09:00", "11:00", "11:30", "12:00"]
   }
   ```

#### Ventajas:
- **Seguridad y Privacidad:** El cliente jamás recibe los nombres ni motivos de los turnos de otros usuarios.
- **Rendimiento:** El backend realiza el filtrado con un simple query y entrega un arreglo liviano de strings.
- **Cero ambigüedad:** El frontend solo itera sobre `horariosDisponibles` y dibuja los botones. No necesita pintar botones grises ni leyendas de "ocupado": **los horarios ocupados simplemente no existen en la lista**.

---

### 3.2 Adaptación del Frontend (`Appointments.tsx`)

#### A. Orden Natural en la Interfaz de Reserva
Para que la disponibilidad sea exacta según la duración del servicio, los pasos en la pantalla se ordenan intuitivamente:
1. **Paso 1: Seleccionar Mascota y Servicio.**  
   *(Al elegir el servicio, ya conocemos la duración exacta, ej: Consulta 30 min, Baño 60 min).*
2. **Paso 2: Seleccionar Fecha en el Calendario.**
3. **Paso 3: Seleccionar Horario.**  
   Se llama a `GET /api/turnos/disponibles?fecha=...&id_servicio=...`.  
   Solo se renderizan los horarios devueltos por el servidor.
   - Si no hay horarios libres en todo el día: Se muestra un mensaje amigable: *"No quedan turnos disponibles para este servicio en la fecha seleccionada. Por favor, elige otro día."*

#### B. Eliminación de los botones grises "Ocupados"
- Se elimina la sección de referencias visuales (`Disponible` en verde vs `Ocupado` en gris).
- Solo se renderizan los botones verdes/azules listos para hacer clic y confirmar.

---

## 4. Comparativa: Antes vs. Después

| Característica | Estado Actual | Solución Propuesta |
|:---|:---|:---|
| **Petición HTTP** | `GET /api/turnos` (descarga todos los turnos con datos de clientes) | `GET /api/turnos/disponibles?fecha=...&id_servicio=...` |
| **Horarios ocupados** | Se muestran en gris deshabilitados ocupando espacio | **Desaparecen por completo** de la grilla |
| **Cálculo de colisión** | Se realiza en el frontend en un bucle JavaScript | Se realiza en el backend como regla de negocio centralizada |
| **Privacidad de datos** | Débil (los turnos ajenos viajan en el payload JSON) | Fuerte (solo viajan strings de horas libres) |
| **Manejo de duración** | Si no hay servicio elegido, asume 30 min y puede fallar luego | Siempre exacto al servicio elegido |

---

## 5. Plan de Acción para la Implementación

1. **Backend ([MundoPeludoB/server.js](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoB/server.js)):**
   - Implementar la ruta `GET /api/turnos/disponibles`.
   - Reutilizar la lógica de días de atención y solapamiento.
2. **Servicio API ([MundoPeludoF/src/service/api.ts](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/service/api.ts)):**
   - Agregar función `obtenerTurnosDisponibles(fecha, idServicio)`.
3. **Componentes Frontend ([Appointments.tsx](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/app/components/Appointments.tsx) y [AdminPanel.tsx](file:///c:/Users/lujan/Desktop/MundoPeludo/MundoPeludoF/src/app/components/AdminPanel.tsx)):**
   - Solicitar los horarios disponibles en cuanto haya fecha y servicio seleccionados.
   - Renderizar únicamente los botones disponibles (haciendo desaparecer los ocupados).

