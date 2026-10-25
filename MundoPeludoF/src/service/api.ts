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
export const obtenerDiasAtencion = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/dias-atencion');
    if (!response.ok) throw new Error('Error al obtener días de atención');
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};