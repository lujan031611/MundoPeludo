import { useTurnos, toIsoDate, slotAvailable, generarSlotsDelDia } from "../hooks/useTurnos";
import { useCatalogo, esFeriadoFijo, type Servicio, type Feriado } from "../hooks/useCatalogos";
import { useState, useEffect } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight, AlertCircle, Info, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { obtenerDiasAtencion, obtenerTurnosDisponibles, type DiaAtencion } from "../../service/api";

export default function Appointments() {
  const { currentUser, clients, pets } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedPet, setSelectedPet] = useState<string>("");
  const [motive, setMotive] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [booked, setBooked] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [saving, setSaving] = useState(false);
  const {turnos,reload:reloadTurnos,error:turnosError}=useTurnos();
  const [diasAtencion, setDiasAtencion] = useState<DiaAtencion[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    obtenerDiasAtencion().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setDiasAtencion(data);
      }
    }).catch(console.error);
  }, []);

  const { data: servicios, error: serviciosError } = useCatalogo<Servicio>("servicios");
  const { data: feriados, error: feriadosError } = useCatalogo<Feriado>("feriados");
  const services = servicios.map(s => ({ name: s.descripcion, duration: `${s.duracion_minutos} min`, description: s.descripcion }));
  const clientRecord = currentUser?.clientId ? clients.find(c => c.id === currentUser.clientId) : null;
  const isAdmin = currentUser?.role === "admin";
  const myPets = isAdmin ? pets : currentUser?.clientId
    ? pets.filter(p => p.clientId === currentUser.clientId) : [];

  // Consulta los horarios disponibles en el servidor (descartando automáticamente los ocupados por duración)
  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([]);
      return;
    }
    const isoDate = toIsoDate(selectedDate);
    if (!isoDate) {
      setAvailableSlots([]);
      return;
    }

    const servicioObj = servicios.find(s => s.descripcion === selectedService);
    setLoadingSlots(true);

    obtenerTurnosDisponibles(isoDate, servicioObj?.id_servicio)
      .then(slots => {
        setAvailableSlots(slots);
        if (selectedTime && !slots.includes(selectedTime)) {
          setSelectedTime(null);
        }
      })
      .catch(err => {
        console.error(err);
        setAvailableSlots([]);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [selectedDate, selectedService, turnos, servicios]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(i);
    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const twoMonthsLater = new Date(today);
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);

  const esFeriado = (fecha: Date) => esFeriadoFijo(fecha, feriados);
  const isDateAvailable = (day: number) => {
    const d = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    const diaSemana = d.getDay();
    const configDia = diasAtencion.find(da => da.numero_dia === diaSemana);
    const diaHabilitado = configDia !== undefined ? Boolean(configDia.activo) : diaSemana !== 0;

    return d >= today && d <= twoMonthsLater && !esFeriado(d) && diaHabilitado;
  };

  const handleDateClick = (day: number) => {
    if (isDateAvailable(day)) {
      setSelectedDate(`${day} ${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`);
      setSelectedTime(null);
    }
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime || !selectedService || !selectedPet || saving || turnosError) return;
    const mascota=myPets.find(p=>String(p.id)===selectedPet);
    const servicio=servicios.find(s=>s.descripcion===selectedService);
    if(!mascota||!servicio)return;
    if(!slotAvailable(toIsoDate(selectedDate), selectedTime, Number(servicio.duracion_minutos), turnos, servicio.descripcion)) {
      setBookingError('Ese horario ya está ocupado. Seleccioná otro.');
      setSelectedTime(null);
      return;
    }
    setSaving(true);setBookingError('');
    try {
      const response=await fetch('http://localhost:3000/api/turnos',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id_mascota:mascota.id,id_servicio:servicio.id_servicio,
          fecha:toIsoDate(selectedDate),hora:selectedTime,motivo:motive})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'No se pudo reservar');
      await reloadTurnos();setBooked(true);
      setTimeout(()=>{setBooked(false);setSelectedDate(null);setSelectedTime(null);setSelectedService('');setSelectedPet('');setMotive('');},4000);
    }catch(e){setBookingError(e instanceof Error?e.message:'Error al reservar');}
    finally{setSaving(false);}
  };

  const selectedServiceDetails = services.find(s => s.name === selectedService);

  if (booked) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex flex-col items-center">
        <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
        <h2 className="text-2xl text-gray-900 mb-2">¡Turno reservado!</h2>
        <p className="text-gray-600 mb-1">Mascota: <strong>{myPets.find(p=>String(p.id)===selectedPet)?.name}</strong></p>
        <p className="text-gray-600 mb-1">Servicio: <strong>{selectedService}</strong></p>
        <p className="text-gray-600 mb-1">Fecha: <strong>{selectedDate}</strong> a las <strong>{selectedTime}</strong></p>
        <p className="text-sm text-gray-500 mt-4">Tu reserva quedó registrada en la base de datos</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl mb-4 text-gray-900">Gestión de Turnos</h1>

      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-8 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-gray-900 mb-1">Sistema de Turnos — Disponibilidad 24/7</h3>
          <p className="text-sm text-gray-600">Reserva turnos en los próximos 2 meses. Los horarios ocupados aparecen en gris.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calendar */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl mb-4 text-gray-900">Seleccionar Fecha</h2>
          <p className="text-sm text-gray-600 mb-4">
            Disponibilidad: {today.getDate()} {monthNames[today.getMonth()]} — {twoMonthsLater.getDate()} {monthNames[twoMonthsLater.getMonth()]} {twoMonthsLater.getFullYear()}
          </p>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { const n = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1); if (n >= new Date(today.getFullYear(), today.getMonth(), 1)) setCurrentMonth(n); }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-gray-900">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
            <button onClick={() => { const n = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1); if (n <= new Date(twoMonthsLater.getFullYear(), twoMonthsLater.getMonth(), 1)) setCurrentMonth(n); }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
         {/* Cabecera de días de la semana */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm text-gray-600 font-medium">
            <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
          </div>

          {/* Grilla de días del mes */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              const isAvailable = day ? isDateAvailable(day) : false;
              const isSelected = selectedDate === `${day} ${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
              return (
                <button key={index} onClick={() => day && handleDateClick(day)} disabled={!day || !isAvailable}
                  className={`aspect-square flex items-center justify-center rounded-lg transition-colors text-sm font-medium ${
                    !day ? "invisible pointer-events-none" : !isAvailable ? "bg-gray-200 text-gray-400 cursor-not-allowed" : isSelected ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                  }`}>
                  {day}
                </button>
              );
            })}
          </div>
          {selectedDate && (
            <div className="mt-6">
              <h3 className="mb-3 text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Horarios Disponibles — {selectedDate}
              </h3>
              {selectedServiceDetails && (
                <p className="text-xs text-blue-600 mb-3 font-medium">
                  Horarios calculados para {selectedService} ({selectedServiceDetails.duration})
                </p>
              )}
              {loadingSlots ? (
                <p className="text-sm text-gray-500 py-3">Consultando horarios disponibles...</p>
              ) : availableSlots.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {availableSlots.map(time => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                        selectedTime === time
                          ? "bg-green-600 text-white shadow-sm"
                          : "bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                  {selectedService
                    ? `No hay turnos disponibles para el servicio de ${selectedService} en esta fecha. Por favor, selecciona otro día.`
                    : 'No hay horarios disponibles para esta fecha. Por favor, selecciona otro día.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl mb-4 text-gray-900">Detalles del Turno</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Mascota *</label>
                <select value={selectedPet} onChange={e => setSelectedPet(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccionar mascota</option>
                  {myPets.map(p => <option key={p.id} value={String(p.id)}>
                    {p.name}{isAdmin ? ` — ${clients.find(c => Number(c.id) === Number(p.clientId))?.fullName || "Sin titular"}` : ""}
                  </option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Servicio *</label>
                <select value={selectedService} onChange={e => { setSelectedService(e.target.value); setSelectedTime(null); }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{serviciosError || "Seleccionar servicio"}</option>
                  {services.map(s => <option key={s.name} value={s.name}>{s.name} — {s.duration}</option>)}
                </select>
                {selectedServiceDetails && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-700">{selectedServiceDetails.description}</p>
                    <p className="text-sm text-blue-600 mt-1">Duración aproximada: {selectedServiceDetails.duration}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Motivo (opcional)</label>
                <textarea value={motive} onChange={e => setMotive(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3}
                  placeholder="Describe brevemente el motivo..." />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="mb-3 text-gray-900">Resumen de la Reserva</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /><span className="text-gray-900">{selectedDate || "Seleccionar fecha"}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /><span className="text-gray-900">{selectedTime || "Seleccionar hora"}</span></div>
              <p className="text-gray-900">Mascota: {myPets.find(p=>String(p.id)===selectedPet)?.name || "No seleccionada"}</p>
              <p className="text-gray-900">Servicio: {selectedService || "No seleccionado"}</p>
              {selectedServiceDetails && <p className="text-gray-900">Duración: {selectedServiceDetails.duration}</p>}
            </div>
            {(bookingError||turnosError) && <p className="text-red-600 mb-2">{bookingError||turnosError}</p>}
            <button onClick={handleBooking} disabled={saving || !!turnosError || !selectedDate || !selectedTime || !selectedService || !selectedPet}
              className={`w-full py-3 rounded-lg transition-colors ${selectedDate && selectedTime && selectedService && selectedPet ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
              Confirmar Turno
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="mb-3 text-gray-900 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-blue-600" />Recordatorios Automáticos</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✉️ Los recordatorios por email aún no están habilitados</li>
              <li>📱 Los SMS aún no están habilitados</li>
              <li>🔔 Las notificaciones aún no están habilitadas</li>
              <li>⏰ Llega 10 minutos antes de tu turno</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
