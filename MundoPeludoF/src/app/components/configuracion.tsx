import React, { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle, AlertCircle, Save, Building2 } from 'lucide-react';
import { obtenerDiasAtencion, actualizarDiasAtencion, obtenerConfiguracion, type DiaAtencion } from '../../service/api';

export function PantallaConfiguracion() {
  const [config, setConfig] = useState<any>(null);
  const [dias, setDias] = useState<DiaAtencion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [mensajeError, setMensajeError] = useState('');

  // Cargar datos al montar el componente
  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        const [confData, diasData] = await Promise.all([
          obtenerConfiguracion(),
          obtenerDiasAtencion()
        ]);
        if (confData) setConfig(confData);
        if (Array.isArray(diasData)) {
          // Ordenamos de Lunes (1) a Sábado (6) y Domingo (0) al final para que la lectura sea natural
          const ordenados = [...diasData].sort((a, b) => {
            const numA = a.numero_dia === 0 ? 7 : a.numero_dia;
            const numB = b.numero_dia === 0 ? 7 : b.numero_dia;
            return numA - numB;
          });
          setDias(ordenados);
        }
      } catch (err) {
        setMensajeError('No se pudieron cargar los datos de configuración.');
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, []);

  const handleToggleActivo = (index: number) => {
    setDias(prev => {
      const copy = [...prev];
      const item = { ...copy[index] };
      item.activo = !item.activo;
      // Si se activa y no tiene horario, sugerir por defecto 09:00 a 20:00
      if (item.activo && (!item.hora_apertura || item.hora_apertura.startsWith('00:00'))) {
        item.hora_apertura = '09:00:00';
        item.hora_cierre = item.numero_dia === 6 ? '13:00:00' : '20:00:00';
      }
      copy[index] = item;
      return copy;
    });
  };

  const handleHoraChange = (index: number, campo: 'hora_apertura' | 'hora_cierre', valor: string) => {
    setDias(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [campo]: valor ? `${valor}:00` : '00:00:00'
      };
      return copy;
    });
  };

  const handleGuardarHorarios = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMensajeExito('');
    setMensajeError('');

    try {
      await actualizarDiasAtencion(dias);
      setMensajeExito('¡Horarios de atención actualizados con éxito!');
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err: any) {
      setMensajeError(err.message || 'Error al guardar los horarios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuración del Sistema</h1>
        <p className="text-gray-600 mt-1">Administra los datos generales de la veterinaria y los horarios de atención para turnos.</p>
      </div>

      {/* 1. Datos Generales de la Veterinaria */}
      <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" /> Datos de la Veterinaria
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700 mt-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="block text-xs text-gray-500 font-medium uppercase">Razón Social</span>
            <span className="font-semibold text-gray-900">{config?.razon_social || 'Mundo Peludo S.R.L.'}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="block text-xs text-gray-500 font-medium uppercase">Dirección</span>
            <span className="font-semibold text-gray-900">{config?.direccion || 'Av. Pte. Perón 1020'}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="block text-xs text-gray-500 font-medium uppercase">Teléfono de Contacto</span>
            <span className="font-semibold text-gray-900">{config?.telefono || '(381) 123-1234'}</span>
          </div>
        </div>
      </div>

      {/* 2. Configuración de Días y Horarios de Atención */}
      <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" /> Días y Horarios de Atención (Turnos)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Configura qué días se atienden turnos y las horas de apertura y cierre de corrido.
            </p>
          </div>
        </div>

        {mensajeExito && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {mensajeError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{mensajeError}</span>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 py-6 text-center text-sm">Cargando horarios de atención...</p>
        ) : (
          <form onSubmit={handleGuardarHorarios} className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Día de la semana</th>
                    <th className="py-3 px-4 text-center">Atención</th>
                    <th className="py-3 px-4">Hora de Apertura</th>
                    <th className="py-3 px-4">Hora de Cierre</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {dias.map((dia, idx) => {
                    const isActivo = Boolean(dia.activo);
                    const horaIni = dia.hora_apertura ? String(dia.hora_apertura).slice(0, 5) : '09:00';
                    const horaFin = dia.hora_cierre ? String(dia.hora_cierre).slice(0, 5) : '20:00';

                    return (
                      <tr key={dia.id_horario || dia.dia_semana} className={!isActivo ? 'bg-gray-50/60' : 'hover:bg-blue-50/20'}>
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {dia.dia_semana}
                          {dia.numero_dia === 6 && <span className="ml-2 text-xs text-blue-600 font-normal">(Medio día)</span>}
                          {dia.numero_dia === 0 && <span className="ml-2 text-xs text-gray-500 font-normal">(Por defecto cerrado)</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isActivo}
                              onChange={() => handleToggleActivo(idx)}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="ml-2 text-xs text-gray-600">{isActivo ? 'Abierto' : 'Cerrado'}</span>
                          </label>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="time"
                            value={horaIni}
                            disabled={!isActivo}
                            onChange={(e) => handleHoraChange(idx, 'hora_apertura', e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="time"
                            value={horaFin}
                            disabled={!isActivo}
                            onChange={(e) => handleHoraChange(idx, 'hora_cierre', e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isActivo ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Disponible
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Sin atención
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Los cambios aplicarán inmediatamente al calendario de turnos.
              </span>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Horarios de Atención'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
