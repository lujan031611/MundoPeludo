export interface DiaAtencion {
  id_horario: number;
  dia_semana: string;
  hora_apertura: string;
  hora_cierre: string;
  activo: number | boolean;
  numero_dia: number; // 0: Domingo ... 6: Sábado
}

// Obtener la configuración general (razón social, dirección, teléfono)
export const obtenerConfiguracion = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/configuracion');
    if (!response.ok) throw new Error('Error al obtener configuración');
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};

// Obtener los días y horarios de atención (para el calendario de turnos)
export const obtenerDiasAtencion = async (): Promise<DiaAtencion[]> => {
  try {
    const response = await fetch('http://localhost:3000/api/dias-atencion');
    if (!response.ok) throw new Error('Error al obtener días de atención');
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};

// Actualizar los días y horarios de atención (desde la configuración del admin)
export const actualizarDiasAtencion = async (dias: DiaAtencion[]): Promise<{ ok: boolean; mensaje?: string }> => {
  const response = await fetch('http://localhost:3000/api/dias-atencion', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dias),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Error al actualizar días de atención');
  }
  return await response.json();
};

// Obtener los horarios verdaderamente disponibles para una fecha y servicio
export const obtenerTurnosDisponibles = async (fecha: string, idServicio?: number): Promise<string[]> => {
  try {
    const params = new URLSearchParams({ fecha });
    if (idServicio && idServicio > 0) {
      params.append('id_servicio', String(idServicio));
    }
    const response = await fetch(`http://localhost:3000/api/turnos/disponibles?${params.toString()}`);
    if (!response.ok) throw new Error('Error al consultar horarios disponibles');
    const data = await response.json();
    return Array.isArray(data.disponibles) ? data.disponibles : [];
  } catch (error) {
    console.error(error);
    return [];
  }
};
