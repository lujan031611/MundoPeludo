import { useState } from "react";
import { useLocation } from "react-router";
import { FileText, Plus, Calendar, User, PawPrint, Search, ArrowLeft, X, Pencil } from "lucide-react";
import { useAuth, Pet, calcularEdadMascota } from "../context/AuthContext";
import { useCatalogo, type Especie, type Raza } from "../hooks/useCatalogos";

export default function VetPanel() {
  const { clients, pets, clinicalRecords, reloadPets, reloadRecords, currentUser } = useAuth();
  const location = useLocation();
  const { data: especies, error: especiesError, loading: especiesLoading } = useCatalogo<Especie>("especies");
  const [especieSeleccionada, setEspecieSeleccionada] = useState("");
  const { data: razas, error: razasError, loading: razasLoading } = useCatalogo<Raza>(
    especieSeleccionada ? `razas?id_especie=${especieSeleccionada}` : "razas?id_especie=0"
  );

  // Si viene del dashboard con un petId en el state, pre-seleccionarlo
  const initialPetId = (location.state as { petId?: number } | null)?.petId ?? null;
  const [selectedPetId, setSelectedPetId] = useState<number | null>(initialPetId);
  const [petSearch, setPetSearch] = useState("");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [showPetModal, setShowPetModal] = useState(false);

  const { data: catalogoServicios } = useCatalogo<import("../hooks/useCatalogos").Servicio>("servicios");
  const services = catalogoServicios.map(s => s.descripcion);
  const veterinarians = currentUser?.fullName ? [currentUser.fullName] : [];

  const [recordForm, setRecordForm] = useState({
    service: "",
    veterinarian: "",
    notes: ""
  });

  const [petForm, setPetForm] = useState<Omit<Pet, "id">>({
    name: "", species: "", breed: "", age: "", fecha_nac: "",
    aggression: "Baja", observations: "", clientId: 0
  });

  const selectedPet = pets.find(p => p.id === selectedPetId);
  const selectedClient = selectedPet ? clients.find(c => c.id === selectedPet.clientId) : null;
  const petRecords = selectedPet ? clinicalRecords.filter(r => r.petId === selectedPet.id) : [];

  const filteredPets = pets.filter(p => {
  const owner = clients.find(c => c.id === p.clientId);
  const ownerName = owner?.fullName || "";

  return p.name.toLowerCase().includes(petSearch.toLowerCase()) ||
    ownerName.toLowerCase().includes(petSearch.toLowerCase()) ||
    p.species.toLowerCase().includes(petSearch.toLowerCase()) ||
    p.breed.toLowerCase().includes(petSearch.toLowerCase());
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const openNewRecord=()=>{
    setEditingRecordId(null);setSaveError('');
    setRecordForm({service:'',veterinarian:'',notes:''});setShowRecordModal(true);
  };
  const openEditRecord=(record: typeof clinicalRecords[number])=>{
    setEditingRecordId(record.id);setSaveError('');
    setRecordForm({service:record.service,veterinarian:record.veterinarian,notes:record.notes});
    setShowRecordModal(true);
  };
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPet || !currentUser || saving) return;
    const servicio = catalogoServicios.find(s => s.descripcion === recordForm.service);
    if (!servicio) { setSaveError('Seleccioná un servicio válido.'); return; }
    setSaving(true); setSaveError('');
    try {
      const response = await fetch(editingRecordId ? `http://localhost:3000/api/historias/${editingRecordId}` : 'http://localhost:3000/api/historias', {
        method:editingRecordId ? 'PUT' : 'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id_mascota:selectedPet.id,usuario_veterinario:currentUser.username,id_servicio:servicio.id_servicio,anotacion:recordForm.notes})
      });
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||'No se pudo guardar');
      await reloadRecords(); setShowRecordModal(false);setEditingRecordId(null);
      setRecordForm({service:'',veterinarian:'',notes:''});
    } catch(e) {setSaveError(e instanceof Error?e.message:'Error al guardar');}
    finally {setSaving(false);}
  };
  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault(); if(saving) return;
    const raza=razas.find(r=>r.tipo_raza===petForm.breed);
    if(!raza) {setSaveError('Seleccioná una raza válida.');return;}
    const raw=petForm.fecha_nac.trim();
    const iso=/^\d{2}\/\d{2}\/\d{4}$/.test(raw)?`${raw.slice(6)}-${raw.slice(3,5)}-${raw.slice(0,2)}`:'';
    const fecha = iso ? new Date(`${iso}T12:00:00`) : null;
    if(!fecha || Number.isNaN(fecha.getTime()) ||
      fecha.getFullYear() !== Number(iso.slice(0,4)) ||
      fecha.getMonth()+1 !== Number(iso.slice(5,7)) ||
      fecha.getDate() !== Number(iso.slice(8,10)) ||
      fecha > new Date()) {
      setSaveError('Ingresá una fecha de nacimiento válida, no futura.');return;
    }
    setSaving(true);setSaveError('');
    try {
      const response=await fetch('http://localhost:3000/api/mascotas/agregar',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          nombre:petForm.name,fecha_nac:iso,id_raza:raza.id_raza,id_cliente:petForm.clientId,
          agresividad:petForm.aggression,observaciones:petForm.observations
        })});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||'No se pudo guardar');
      await reloadPets();setShowPetModal(false);setEspecieSeleccionada('');
      setPetForm({name:'',species:'',breed:'',age:'',fecha_nac:'',aggression:'Baja',observations:'',clientId:0});
    }catch(e){setSaveError(e instanceof Error?e.message:'Error al guardar');}
    finally{setSaving(false);}
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-8">
        <div>
          {selectedPet ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedPetId(null)} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />Volver a mascotas
              </button>
              <span className="text-gray-300">|</span>
              <div>
                <h1 className="text-3xl text-gray-900">{selectedPet.name}</h1>
                <p className="text-gray-600 mt-1">{selectedPet.species} · {selectedPet.breed} · Dueño: {selectedClient?.fullName}</p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl text-gray-900">Panel Veterinario</h1>
              <p className="text-gray-600 mt-2">Historias Clínicas — Mundo Peludo</p>
            </>
          )}
        </div>
        <div className="flex gap-3">
          {selectedPet && (
            <button onClick={openNewRecord} className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors">
              <Plus className="w-4 h-4" />Nueva Historia Clínica
            </button>
          )}
          <button onClick={() => setShowPetModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
            <PawPrint className="w-4 h-4" />Agregar Mascota
          </button>
        </div>
      </div>

      {/* ── STATS ───────────────────────────────────────────────────────────── */}
      {!selectedPet && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-md flex items-center gap-3">
            <PawPrint className="w-8 h-8 text-green-600" />
            <div><p className="text-2xl text-gray-900">{pets.length}</p><p className="text-sm text-gray-600">Mascotas en Sistema</p></div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div><p className="text-2xl text-gray-900">{clinicalRecords.length}</p><p className="text-sm text-gray-600">Historias Clínicas</p></div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md flex items-center gap-3">
            <User className="w-8 h-8 text-purple-600" />
            <div><p className="text-2xl text-gray-900">{clients.length}</p><p className="text-sm text-gray-600">Clientes Registrados</p></div>
          </div>
        </div>
      )}

      {/* ── PET LIST ────────────────────────────────────────────────────────── */}
      {!selectedPet && (
        <>
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={petSearch} onChange={e => setPetSearch(e.target.value)}
                placeholder="Buscar mascota por nombre, dueño, raza o especie..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPets.map(pet => {
              const owner = clients.find(c => c.id === pet.clientId);
              const recordCount = clinicalRecords.filter(r => r.petId === pet.id).length;
              return (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPetId(pet.id)}
                  className="bg-white rounded-lg shadow-md p-5 text-left hover:shadow-lg hover:border-green-500 border border-transparent transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <PawPrint className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-gray-900">{pet.name}</p>
                        <p className="text-sm text-gray-500">{pet.species} · {pet.breed}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${pet.aggression === "Baja" ? "bg-green-100 text-green-700" : pet.aggression === "Media" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                      {pet.aggression}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600"><span className="text-gray-400">Dueño:</span> {owner?.fullName || "—"}</p>
                    <p className="text-gray-600"><span className="text-gray-400">Edad:</span> {pet.age || "—"}</p>
                    {pet.lastVisit && <p className="text-gray-600"><span className="text-gray-400">Última visita:</span> {pet.lastVisit}</p>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{recordCount} registro{recordCount !== 1 ? "s" : ""} clínico{recordCount !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-green-600">Ver historial →</span>
                  </div>
                </button>
              );
            })}
          </div>
          {filteredPets.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <PawPrint className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No se encontraron mascotas</p>
            </div>
          )}
        </>
      )}

      {/* ── PET CLINICAL RECORDS ────────────────────────────────────────────── */}
      {selectedPet && (
        <>
          <div className="bg-white rounded-lg shadow-md p-5 mb-6 flex flex-wrap gap-4">
            <div className="text-sm"><span className="text-gray-500">Especie:</span> <span className="text-gray-900">{selectedPet.species}</span></div>
            <div className="text-sm"><span className="text-gray-500">Raza:</span> <span className="text-gray-900">{selectedPet.breed}</span></div>
            <div className="text-sm"><span className="text-gray-500">Edad:</span> <span className="text-gray-900">{selectedPet.age || "—"}</span></div>
            <div className="text-sm"><span className="text-gray-500">Agresividad:</span> <span className={`${selectedPet.aggression === "Baja" ? "text-green-600" : selectedPet.aggression === "Media" ? "text-yellow-600" : "text-red-600"}`}>{selectedPet.aggression}</span></div>
            {selectedPet.observations && (
              <div className="w-full text-sm"><span className="text-gray-500">Observaciones:</span> <span className="text-gray-700">{selectedPet.observations}</span></div>
            )}
          </div>

          {petRecords.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg shadow-md">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No hay historias clínicas para esta mascota</p>
              <button onClick={openNewRecord} className="mt-4 flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors mx-auto">
                <Plus className="w-4 h-4" />Crear Primera Historia Clínica
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {petRecords.map(record => (
                <div key={record.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl text-gray-900">{record.service}</h3>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">{record.date}</span>
                    </div>
                    <button type="button" onClick={()=>openEditRecord(record)}
                      className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 px-2 py-1">
                      <Pencil className="w-4 h-4"/>Editar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Veterinario: <strong className="text-gray-900">{record.veterinarian}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Dueño: <strong className="text-gray-900">{record.owner}</strong></span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-900 mb-1"><strong>Notas Clínicas:</strong></p>
                    <p className="text-sm text-gray-700">{record.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── RECORD MODAL ─────────────────────────────────────────────────────── */}
      {showRecordModal && selectedPet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl text-gray-900">{editingRecordId ? "Editar Historia Clínica" : "Nueva Historia Clínica"} — {selectedPet.name}</h2>
              <button onClick={() => setShowRecordModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Tipo de Servicio *</label>
                  <select required value={recordForm.service} onChange={e => setRecordForm({ ...recordForm, service: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccionar servicio</option>{services.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Veterinario *</label>
                  <select required value={currentUser?.fullName || ""} onChange={e => setRecordForm({ ...recordForm, veterinarian: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {veterinarians.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Anotaciones Clínicas *</label>
                <textarea required value={recordForm.notes} onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={6}
                  placeholder="Diagnóstico, tratamiento, observaciones y recomendaciones..." />
              </div>
              {saveError && <p className="text-red-600">{saveError}</p>}
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowRecordModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors">{editingRecordId ? "Guardar Cambios" : "Guardar Historia Clínica"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD PET MODAL ────────────────────────────────────────────────────── */}
      {showPetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl text-gray-900">Agregar Mascota</h2>
              <button onClick={() => setShowPetModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddPet} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Cliente / Dueño *</label>
                <select required value={petForm.clientId || ""} onChange={e => setPetForm({ ...petForm, clientId: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccionar cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Nombre de la Mascota *</label>
                  <input type="text" required value={petForm.name} onChange={e => setPetForm({ ...petForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Max" />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Especie *</label>
                  <select required value={especieSeleccionada} disabled={especiesLoading || !!especiesError}
                    onChange={e => {
                      const id = e.target.value;
                      setEspecieSeleccionada(id);
                      const especie = especies.find(item => String(item.id_especie) === id);
                      setPetForm(prev => ({ ...prev, species: especie?.tipo_especie || "", breed: "" }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{especiesError || (especiesLoading ? "Cargando especies..." : "Seleccionar especie")}</option>
                    {especies.map(especie => <option key={especie.id_especie} value={especie.id_especie}>{especie.tipo_especie}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Raza *</label>
                  <select required value={petForm.breed} disabled={!especieSeleccionada || razasLoading || !!razasError}
                    onChange={e => setPetForm(prev => ({ ...prev, breed: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{razasError || (!especieSeleccionada ? "Primero seleccioná una especie" : razasLoading ? "Cargando razas..." : "Seleccionar raza")}</option>
                    {razas.map(raza => <option key={raza.id_raza} value={raza.tipo_raza}>{raza.tipo_raza}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Edad (calculada automáticamente)</label>
                  <div className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                    {calcularEdadMascota(petForm.fecha_nac.length === 10
                      ? `${petForm.fecha_nac.slice(6)}-${petForm.fecha_nac.slice(3,5)}-${petForm.fecha_nac.slice(0,2)}` : "") || "Ingresá la fecha de nacimiento"}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Fecha de Nacimiento</label>
                <input type="text" inputMode="numeric" maxLength={10} value={petForm.fecha_nac}
                  onChange={e => {
                    const digitos = e.target.value.replace(/\D/g, "").slice(0,8);
                    const fecha = digitos.length > 4
                      ? `${digitos.slice(0,2)}/${digitos.slice(2,4)}/${digitos.slice(4)}`
                      : digitos.length > 2 ? `${digitos.slice(0,2)}/${digitos.slice(2)}` : digitos;
                    setPetForm(prev => ({ ...prev, fecha_nac: fecha }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="DD/MM/AAAA (solo números)" required />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Nivel de Agresividad *</label>
                <select required value={petForm.aggression} onChange={e => setPetForm({ ...petForm, aggression: e.target.value as "Baja" | "Media" | "Alta" })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Baja">Baja — Dócil y sociable</option>
                  <option value="Media">Media — Requiere manejo cuidadoso</option>
                  <option value="Alta">Alta — Precaución extrema</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Observaciones</label>
                <textarea value={petForm.observations} onChange={e => setPetForm({ ...petForm, observations: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
              </div>
              {saveError && <p className="text-red-600">{saveError}</p>}
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowPetModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors">Agregar Mascota</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
