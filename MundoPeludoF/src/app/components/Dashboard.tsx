import { useState } from "react";
import { useNavigate } from "react-router";
import { PawPrint, Search, Users, FileText, CalendarDays, Dog, Cat, Phone, User, ChevronRight, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTurnos } from "../hooks/useTurnos";

function splitName(fullName: string) {
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) return { nombre: parts[0], apellido: "" };
  const apellido = parts[parts.length - 1];
  const nombre = parts.slice(0, -1).join(" ");
  return { nombre, apellido };
}

function SpeciesIcon({ species, className }: { species: string; className?: string }) {
  if (species === "Perro") return <Dog className={className} />;
  if (species === "Gato") return <Cat className={className} />;
  return <PawPrint className={className} />;
}

function speciesColor(species: string) {
  switch (species) {
    case "Perro": return { border: "border-blue-500", badge: "bg-blue-100 text-blue-700", icon: "text-blue-500" };
    case "Gato":  return { border: "border-purple-400", badge: "bg-purple-100 text-purple-700", icon: "text-purple-500" };
    default:      return { border: "border-green-400", badge: "bg-green-100 text-green-700", icon: "text-green-500" };
  }
}

function aggressionColor(level: string) {
  if (level === "Alta")  return "bg-red-100 text-red-700";
  if (level === "Media") return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, pets, clients, clinicalRecords } = useAuth();

  const {turnos,error:turnosError}=useTurnos();
  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("Todos");

  const isStaff = currentUser?.role === "admin" || currentUser?.role === "vet";

  // Clientes ven solo sus mascotas; staff ve todas
  const visiblePets = isStaff
    ? pets
    : pets.filter(p => p.clientId === currentUser?.clientId);

  // Opciones fijas — siempre visibles para todos los usuarios
  const speciesOptions = [
    { label: "Todos", icon: <PawPrint className="w-4 h-4" />, active: "bg-blue-600 text-white border-blue-600", inactive: "bg-white text-gray-600 border-gray-200 hover:border-blue-300" },
    { label: "Perro", icon: <Dog className="w-4 h-4" />,     active: "bg-blue-500 text-white border-blue-500",   inactive: "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400" },
    { label: "Gato",  icon: <Cat className="w-4 h-4" />,     active: "bg-purple-500 text-white border-purple-500", inactive: "bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400" },
  ];

  const filtered = visiblePets.filter(p => {
    const owner = clients.find(c => c.id === p.clientId);
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.breed.toLowerCase().includes(search.toLowerCase()) ||
      (owner?.fullName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchSpecies = speciesFilter === "Todos" || p.species === speciesFilter;
    return matchSearch && matchSpecies;
  });

  const handleVerHistorial = (petId: number) => {
    navigate("/veterinario", { state: { petId } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* ── HERO BANNER ──────────────────────────────────────────────────────── */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl text-white mb-1">
                {isStaff ? "Panel de Mascotas" : "Mis Mascotas"}
              </h1>
              <p className="text-blue-100 text-sm">
                {isStaff
                  ? "Registro completo de pacientes y sus dueños"
                  : "Consultá el historial y datos de tus mascotas"}
              </p>
            </div>

            {/* Stats — solo para staff */}
            {isStaff && (
              <div className="flex gap-4 flex-wrap">
                <div className="bg-white/15 rounded-xl px-5 py-3 text-center min-w-[90px]">
                  <p className="text-2xl text-white">{pets.length}</p>
                  <p className="text-blue-100 text-xs mt-0.5">Mascotas</p>
                </div>
                <div className="bg-white/15 rounded-xl px-5 py-3 text-center min-w-[90px]">
                  <p className="text-2xl text-white">{clients.filter(c => c.id < 98).length}</p>
                  <p className="text-blue-100 text-xs mt-0.5">Clientes</p>
                </div>
                <div className="bg-white/15 rounded-xl px-5 py-3 text-center min-w-[90px]">
                  <p className="text-2xl text-white">{clinicalRecords.length}</p>
                  <p className="text-blue-100 text-xs mt-0.5">Historias</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTERS ──────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, raza o dueño..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Species tabs — fijos, siempre visibles */}
          <div className="flex gap-2 flex-wrap">
            {speciesOptions.map(sp => (
              <button
                key={sp.label}
                onClick={() => setSpeciesFilter(sp.label)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border shadow-sm ${
                  speciesFilter === sp.label ? sp.active : sp.inactive
                }`}
              >
                {sp.icon}
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-5">
          {filtered.length} mascota{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
          {(search || speciesFilter !== "Todos") ? " con los filtros aplicados" : ""}
        </p>

        {/* ── CARDS GRID ─────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <PawPrint className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">No se encontraron mascotas</p>
            <p className="text-sm mt-1">Probá con otro término de búsqueda</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(pet => {
              const owner = clients.find(c => c.id === pet.clientId);
              const ownerName = splitName(owner?.fullName ?? "—");
              const colors = speciesColor(pet.species);
              const recordCount = clinicalRecords.filter(r => r.petId === pet.id).length;

              return (
                <div
                  key={pet.id}
                  className={`bg-white rounded-2xl shadow-sm border-l-4 ${colors.border} hover:shadow-md transition-shadow flex flex-col`}
                >
                  {/* Card header */}
                  <div className="px-5 pt-5 pb-4 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                      <SpeciesIcon species={pet.species} className={`w-6 h-6 ${colors.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-gray-900 text-lg leading-tight">{pet.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
                          {pet.species}
                        </span>
                        {pet.aggression !== "Baja" && (
                          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${aggressionColor(pet.aggression)}`}>
                            <AlertTriangle className="w-3 h-3" />
                            {pet.aggression}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{pet.breed}</p>
                    </div>
                  </div>

                  {/* Pet details */}
                  <div className="px-5 pb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-400 text-xs block">Fecha de Nac.</span>
                      <span className="text-gray-700">{pet.fecha_nac || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Edad</span>
                      <span className="text-gray-700">{pet.age || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Última visita</span>
                      <span className="text-gray-700">{pet.lastVisit || "Sin visitas"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Historias clínicas</span>
                      <span className="text-gray-700">{recordCount}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="mx-5 border-t border-gray-100" />

                  {/* Owner data */}
                  <div className="px-5 py-4 space-y-1.5">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Dueño / Tutor</p>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500">Nombre:</span>
                      <span className="text-gray-800 truncate">{ownerName.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500">Apellido:</span>
                      <span className="text-gray-800 truncate">{ownerName.apellido || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500">Teléfono:</span>
                      <span className="text-gray-800 truncate">{owner?.phone || "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <h2 className="text-gray-900">Próximos Turnos</h2>
          </div>
          {turnosError && <p className="text-red-600 text-sm">{turnosError}</p>}
          {turnos.filter(t=>{
            const inicio=new Date(`${t.date}T${t.time}:00`);
            return !Number.isNaN(inicio.getTime()) && inicio>=new Date() &&
              (isStaff || visiblePets.some(p=>Number(p.id)===Number(t.petId)));
          }).slice().sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0,8).map(t=>(
            <div key={t.id} className="py-2 border-b border-gray-100 text-sm">
              <strong>{t.pet}</strong>{isStaff && t.client ? ` — ${t.client}` : ""} · {t.service} · {t.date} {t.time} ({t.duration} min)
            </div>
          ))}
          {!turnosError && !turnos.some(t=>new Date(`${t.date}T${t.time}:00`)>=new Date() &&
            (isStaff || visiblePets.some(p=>Number(p.id)===Number(t.petId)))) &&
            <p className="text-sm text-gray-500">Sin próximos turnos</p>}
        </div>
      </div>
    </div>
  );
}
