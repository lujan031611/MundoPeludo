import React from 'react';
import { Clock } from 'lucide-react';

export function PantallaConfiguracion() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configuración del Sistema</h1>

      {/* Sección principal de configuración */}
      <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" /> Datos de la Veterinaria
        </h2>
        
        <p className="text-gray-600 mb-2">Aquí puedes ver y administrar los datos generales de la veterinaria, contacto, teléfono, mail y dirección.</p>
        
        <div className="mt-4 space-y-2 text-sm text-gray-700">
          <p><strong>Atención:</strong> Urgencias 24/7</p>
          <p><strong>Turnos online:</strong> Disponibles</p>
        </div>
      </div>
    </div>
  );
}