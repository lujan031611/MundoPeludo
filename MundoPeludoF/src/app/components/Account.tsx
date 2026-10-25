import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  User, Mail, Phone, MapPin, Lock, PawPrint, Calendar,
  AlertCircle, FileText, Check, Eye, EyeOff,
  Dog, Cat, Search, Users, ChevronRight, AlertTriangle, ShoppingBag,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTurnos } from "../hooks/useTurnos";

// ── helpers compartidos con Dashboard ────────────────────────────────────────
function splitName(fullName: string) {
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) return { nombre: parts[0], apellido: "" };
  return { nombre: parts.slice(0, -1).join(" "), apellido: parts[parts.length - 1] };
}

function SpeciesIcon({ species, className }: { species: string; className?: string }) {
  if (species === "Perro") return <Dog className={className} />;
  if (species === "Gato")  return <Cat className={className} />;
  return <PawPrint className={className} />;
}

function speciesCardColor(species: string) {
  switch (species) {
    case "Perro": return { border: "border-blue-500",   badge: "bg-blue-100 text-blue-700",     icon: "text-blue-500" };
    case "Gato":  return { border: "border-purple-400", badge: "bg-purple-100 text-purple-700", icon: "text-purple-500" };
    default:      return { border: "border-green-400",  badge: "bg-green-100 text-green-700",   icon: "text-green-500" };
  }
}

function aggressionColor(level: string) {
  if (level === "Alta")  return "bg-red-100 text-red-700";
  if (level === "Media") return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}

const SPECIES_FILTERS = [
  { label: "Todos", icon: <PawPrint className="w-4 h-4" />, active: "bg-blue-600 text-white border-blue-600",     inactive: "bg-white text-gray-600 border-gray-200 hover:border-blue-300" },
  { label: "Perro", icon: <Dog className="w-4 h-4" />,      active: "bg-blue-500 text-white border-blue-500",     inactive: "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400" },
  { label: "Gato",  icon: <Cat className="w-4 h-4" />,      active: "bg-purple-500 text-white border-purple-500", inactive: "bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400" },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function Account() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<number|null>(null);
  const loadOrders = async () => {
    setOrdersLoading(true);setOrdersError("");
    try {
      const r=await fetch('http://localhost:3000/api/ventas/mis-compras',{credentials:'include',cache:'no-store'});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'No se pudieron cargar tus compras');
      setOrders(data);
    }catch(e){setOrdersError(e instanceof Error?e.message:'Error al cargar compras');}
    finally{setOrdersLoading(false);}
  };
  useEffect(()=>{if(searchParams.get('tab')==='compras'){setActiveTab('compras');void loadOrders();}},[searchParams]);

  const { currentUser, clients, pets, clinicalRecords, updateClientInfo, updateClientPassword, logout } = useAuth();
  const {turnos,error:turnosError,reload:reloadTurnos}=useTurnos();
  const [turnoError,setTurnoError]=useState('');
  const [turnoBusy,setTurnoBusy]=useState<number|null>(null);
  const [editingTurno,setEditingTurno]=useState<number|null>(null);
  const [newFecha,setNewFecha]=useState('');
  const [newHora,setNewHora]=useState('');
  const [activeTab, setActiveTab] = useState<"info" | "pets" | "compras">("info");

  const client = currentUser?.clientId ? clients.find(c => c.id === currentUser.clientId) : null;
  const myPets = client ? pets.filter(p => p.clientId === client.id) : [];
  const isStaff = currentUser?.role === "admin" || currentUser?.role === "vet";

  // ── Personal info state ───────────────────────────────────────────────────
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    fullName: client?.fullName || "",
    dni: client?.dni || "",
    email: client?.email || "",
    phone: client?.phone || "",
    address: client?.address || "",
  });
  const [infoSaved, setInfoSaved] = useState(false);

  // ── Password state ────────────────────────────────────────────────────────
  const [editingPass, setEditingPass] = useState(false);
  const [passForm, setPassForm] = useState({ current: "", newPass: "", confirm: "" });
  const [passError, setPassError] = useState("");
  const [passSaved, setPassSaved] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // ── Pet filter state ──────────────────────────────────────────────────────
  const [petSearch, setPetSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("Todos");

  const filteredPets = myPets.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(petSearch.toLowerCase()) ||
      p.breed.toLowerCase().includes(petSearch.toLowerCase());
    const matchSpecies = speciesFilter === "Todos" || p.species === speciesFilter;
    return matchSearch && matchSpecies;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleInfoSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    try {
      await updateClientInfo(client.id, infoForm);
      setEditingInfo(false);
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 3000);
    } catch (error) { alert(error instanceof Error ? error.message : 'No se pudo guardar.'); }
  };

  const handlePassSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    if (passForm.newPass !== passForm.confirm) { setPassError('Las contraseñas nuevas no coinciden'); return; }
    if (passForm.newPass.length < 6) { setPassError('La contraseña debe tener al menos 6 caracteres'); return; }
    try {
      await updateClientPassword(client.id, passForm.current, passForm.newPass);
      setEditingPass(false);
      setPassForm({ current: '', newPass: '', confirm: '' });
      setPassError('');
      setPassSaved(true);
      setTimeout(() => setPassSaved(false), 3000);
    } catch (error) { setPassError(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña'); }
  };

  const upcomingAppointments=turnos.filter(t=>{
    const inicio=new Date(`${t.date}T${t.time}:00`);
    return t.status!=='cancelado' && !Number.isNaN(inicio.getTime()) && inicio>=new Date() &&
      (isStaff || myPets.some(p=>Number(p.id)===Number(t.petId)));
  }).slice().sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const manageTurno=async(id:number,action:'cancelar'|'reprogramar')=>{
    if(action==='cancelar' && !window.confirm('¿Cancelar este turno? Se liberará su horario.'))return;
    setTurnoError('');setTurnoBusy(id);
    try{
      const response=await fetch(`http://localhost:3000/api/turnos/${id}/${action}`,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        ...(action==='reprogramar'?{body:JSON.stringify({fecha:newFecha,hora:newHora})}:{})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'No se pudo actualizar el turno');
      await reloadTurnos();setEditingTurno(null);
    }catch(e){setTurnoError(e instanceof Error?e.message:'Error al actualizar turno');}
    finally{setTurnoBusy(null);}
  };
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl text-gray-900">Mi Cuenta</h1>
        <button onClick={logout} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">
          Cerrar Sesión
        </button>
      </div>

      {/* Success banners */}
      {(infoSaved || passSaved) && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 mb-6">
          <Check className="w-4 h-4" />
          {infoSaved ? "Información actualizada correctamente." : "Contraseña cambiada correctamente."}
        </div>
      )}

      {/* Tab buttons */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab("info")}
          className={`px-6 py-3 rounded-lg transition-colors ${activeTab === "info" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
        >
          <User className="w-5 h-5 inline mr-2" />Información Personal
        </button>
        {!isStaff && <button
          onClick={() => setActiveTab("pets")}
          className={`px-6 py-3 rounded-lg transition-colors ${activeTab === "pets" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
        >
          <PawPrint className="w-5 h-5 inline mr-2" />Mis Mascotas
        </button>}
        {!isStaff && <button onClick={() => {setActiveTab('compras');void loadOrders();}}
          className={`px-6 py-3 rounded-lg transition-colors ${activeTab === 'compras' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
          <ShoppingBag className="w-5 h-5 inline mr-2"/>Mis compras
        </button>}
      </div>

      {activeTab === 'compras' && !isStaff && <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Mis compras</h2>
          <button onClick={() => void loadOrders()} className="text-blue-600 hover:underline">Actualizar</button></div>
        {ordersLoading && <p>Cargando compras...</p>}
        {ordersError && <p role="alert" className="text-red-600">{ordersError}</p>}
        {!ordersLoading && !ordersError && orders.length===0 && <p className="bg-white rounded-lg p-6">Todavía no realizaste ninguna compra.</p>}
        {orders.map(order => <div key={order.id} className="bg-white p-5 rounded-xl shadow-sm border space-y-3">
          <div className="flex justify-between items-center gap-3"><div><strong>Pedido #{order.id}</strong>
            <p className="text-sm text-gray-500">{new Date(String(order.date).replace(' ','T')).toLocaleString('es-AR')}</p></div>
            <span className={`text-sm rounded-full px-3 py-1 ${order.delivered?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
              {order.delivered?'Entregado':'Pendiente'}</span></div>
          <div className="flex justify-between gap-3"><span>{order.shipping?'Envío a domicilio':'Retiro en local'}</span>
            <strong>${Number(order.total).toLocaleString('es-AR',{minimumFractionDigits:2})}</strong></div>
          <button onClick={()=>setExpandedOrder(expandedOrder===order.id?null:order.id)} className="text-blue-600 hover:underline">
            {expandedOrder===order.id?'Ocultar detalle':'Ver detalle'}</button>
          {expandedOrder===order.id && <div className="border-t pt-3 space-y-2 text-sm">
            {(order.items||[]).map((item:any,i:number)=><div key={i} className="flex justify-between gap-3">
              <span>{item.quantity} × {item.name} (${Number(item.unitPrice).toLocaleString('es-AR')} c/u)</span>
              <span>${Number(item.subtotal).toLocaleString('es-AR')}</span></div>)}
            {Boolean(order.shipping) && <p><strong>Dirección:</strong> {order.deliveryAddress}</p>}
            {order.deliveryInstructions && <p><strong>Instrucciones:</strong> {order.deliveryInstructions}</p>}
          </div>}
        </div>)}
      </div>}

      {/* ── INFO TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">

            {/* Personal data */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl text-gray-900">Datos Personales</h2>
                {!editingInfo && !isStaff && (
                  <button
                    onClick={() => { setEditingInfo(true); setInfoForm({ fullName: client?.fullName || "", dni: client?.dni || "", email: client?.email || "", phone: client?.phone || "", address: client?.address || "" }); }}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Editar
                  </button>
                )}
              </div>
              {!editingInfo ? (
                <div className="space-y-4">
                  {[
                    { icon: <User className="w-5 h-5 text-gray-500" />,    label: "Nombre Completo", value: client?.fullName || currentUser?.fullName || "—" },
                    { icon: <FileText className="w-5 h-5 text-gray-500" />, label: "DNI",             value: client?.dni || currentUser?.dni || "—" },
                    { icon: <Mail className="w-5 h-5 text-gray-500" />,    label: "Email",            value: client?.email || "—" },
                    { icon: <Phone className="w-5 h-5 text-gray-500" />,   label: "Teléfono",         value: client?.phone || "—" },
                    { icon: <MapPin className="w-5 h-5 text-gray-500" />,  label: "Dirección",        value: client?.address || "—" },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      {icon}
                      <div><p className="text-sm text-gray-500">{label}</p><p className="text-gray-900">{value}</p></div>
                    </div>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleInfoSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">Nombre Completo *</label>
                      <input type="text" required value={infoForm.fullName} onChange={e => setInfoForm({ ...infoForm, fullName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">DNI</label>
                      <input type="text" value={infoForm.dni} onChange={e => setInfoForm({ ...infoForm, dni: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Email *</label>
                    <input type="email" required value={infoForm.email} onChange={e => setInfoForm({ ...infoForm, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">Teléfono</label>
                      <input type="tel" value={infoForm.phone} onChange={e => setInfoForm({ ...infoForm, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">Dirección</label>
                      <input type="text" value={infoForm.address} onChange={e => setInfoForm({ ...infoForm, address: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setEditingInfo(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">Guardar Cambios</button>
                  </div>
                </form>
              )}
            </div>

            {/* Security */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl text-gray-900">Seguridad</h2>
                {!editingPass && (
                  <button onClick={() => setEditingPass(true)} className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Cambiar Contraseña
                  </button>
                )}
              </div>
              {!editingPass ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-500" />
                    <div><p className="text-sm text-gray-500">Usuario</p><p className="text-gray-900">{currentUser?.username}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-gray-500" />
                    <div><p className="text-sm text-gray-500">Contraseña</p><p className="text-gray-900">••••••••</p></div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePassSave} className="space-y-4">
                  {passError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{passError}</div>}
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Contraseña Actual *</label>
                    <div className="relative">
                      <input type={showCurrentPass ? "text" : "password"} required value={passForm.current}
                        onChange={e => setPassForm({ ...passForm, current: e.target.value })}
                        className="w-full px-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Nueva Contraseña *</label>
                    <div className="relative">
                      <input type={showNewPass ? "text" : "password"} required value={passForm.newPass}
                        onChange={e => setPassForm({ ...passForm, newPass: e.target.value })}
                        className="w-full px-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Confirmar Nueva Contraseña *</label>
                    <input type="password" required value={passForm.confirm}
                      onChange={e => setPassForm({ ...passForm, confirm: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => { setEditingPass(false); setPassForm({ current: "", newPass: "", confirm: "" }); setPassError(""); }}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">Guardar Contraseña</button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl mb-4 text-gray-900">Próximos Turnos</h2>
              {turnoError && <p className="text-red-600 text-sm mb-2">{turnoError}</p>}
              {turnosError && <p className="text-red-600 text-sm mb-2">{turnosError}</p>}
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Sin próximos turnos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingAppointments.map((apt, i) => (
                    <div key={i} className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-green-600 mt-1" />
                        <div>
                          <p className="text-gray-900">{apt.service}</p>
                          <p className="text-sm text-gray-600">{apt.pet}{isStaff && apt.client ? ` — ${apt.client}` : ""}</p>
                          <p className="text-sm text-gray-600">{apt.date} — {apt.time}</p>
                          <p className="text-sm text-blue-600">Duración: {apt.duration} min</p>
                           <div className="flex gap-2 mt-2 flex-wrap">
                             <button type="button" disabled={turnoBusy===apt.id} onClick={()=>manageTurno(apt.id,'cancelar')}
                               className="text-xs border border-red-300 text-red-700 px-2 py-1 rounded">Cancelar</button>
                             <button type="button" disabled={turnoBusy===apt.id} onClick={()=>{
                               setEditingTurno(editingTurno===apt.id?null:apt.id);setNewFecha(apt.date);setNewHora(apt.time);setTurnoError('');
                             }} className="text-xs border border-blue-300 text-blue-700 px-2 py-1 rounded">Reprogramar</button>
                           </div>
                           {editingTurno===apt.id && <div className="mt-2 space-y-2">
                             <input type="date" value={newFecha} min={new Date().toLocaleDateString('en-CA')}
                               onChange={e=>setNewFecha(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
                             <select value={newHora} onChange={e=>setNewHora(e.target.value)} className="border rounded px-2 py-1 text-sm w-full">
                               {['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30'].map(h=><option key={h} value={h}>{h}</option>)}
                             </select>
                             <button type="button" disabled={!newFecha||!newHora||turnoBusy===apt.id}
                               onClick={()=>manageTurno(apt.id,'reprogramar')} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Guardar nueva fecha</button>
                           </div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-lg">
              <h3 className="text-xl mb-2">Recordatorios Automáticos</h3>
              <p className="text-blue-100 mb-4">Activos para todos tus turnos</p>
              <ul className="space-y-2 text-sm text-blue-100">
                <li>✓ Email 24hs antes</li>
                <li>✓ SMS 2 horas antes</li>
                <li>✓ Recordatorio en la app</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── PETS TAB — full width con cards + filtros ─────────────────────────── */}
      {activeTab === "pets" && !isStaff && (
        <div>
          {/* Notice for clients */}
          {currentUser?.role === "client" && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Las mascotas son gestionadas exclusivamente por el personal veterinario. Para agregar o modificar datos, comunícate con la clínica.
              </p>
            </div>
          )}

          {/* Search + filter bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={petSearch}
                onChange={e => setPetSearch(e.target.value)}
                placeholder="Buscar por nombre o raza..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {SPECIES_FILTERS.map(f => (
                <button
                  key={f.label}
                  onClick={() => setSpeciesFilter(f.label)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border shadow-sm ${speciesFilter === f.label ? f.active : f.inactive}`}
                >
                  {f.icon}{f.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-5">
            {filteredPets.length} mascota{filteredPets.length !== 1 ? "s" : ""} encontrada{filteredPets.length !== 1 ? "s" : ""}
          </p>

          {/* Cards grid */}
          {filteredPets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <PawPrint className="w-14 h-14 mb-4 opacity-30" />
              <p className="text-lg">No se encontraron mascotas</p>
              {myPets.length === 0 && (
                <p className="text-sm mt-1 text-gray-400">Aún no tenés mascotas registradas. Visitá la veterinaria.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredPets.map(pet => {
                const owner = clients.find(c => c.id === pet.clientId);
                const ownerName = splitName(owner?.fullName ?? "—");
                const colors = speciesCardColor(pet.species);
                const recordCount = clinicalRecords.filter(r => r.petId === pet.id).length;

                return (
                  <div key={pet.id} className={`bg-white rounded-2xl shadow-sm border-l-4 ${colors.border} hover:shadow-md transition-shadow flex flex-col`}>
                    {/* Header */}
                    <div className="px-5 pt-5 pb-4 flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                        <SpeciesIcon species={pet.species} className={`w-6 h-6 ${colors.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-gray-900 text-lg leading-tight">{pet.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{pet.species}</span>
                          {pet.aggression !== "Baja" && (
                            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${aggressionColor(pet.aggression)}`}>
                              <AlertTriangle className="w-3 h-3" />{pet.aggression}
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

                    {/* Owner */}
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
        </div>
      )}
    </div>
  );
}
