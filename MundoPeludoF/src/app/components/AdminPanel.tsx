import Dashboard from "./Dashboard";
import VentasAdmin from "./VentasAdmin";
import { useProductos } from "../hooks/useProductos";
import { useTurnos, toIsoDate, slotAvailable } from "../hooks/useTurnos";
import { useCatalogo, esFeriadoFijo, type Servicio, type Feriado } from "../hooks/useCatalogos";
import { useState } from "react";
import { Package, Plus, Edit, Trash2, Search, Calendar, Clock, ChevronLeft, ChevronRight, CheckCircle, User, Users, PawPrint, Image, X, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth, Client } from "../context/AuthContext";

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  imageUrl?: string;
}

interface Appointment {
  id: number;
  client: string;
  pet: string;
  service: string;
  date: string;
  time: string;
  notes: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

export default function AdminPanel() {
  const { clients, setClients, pets, updateClientInfo, createClient } = useAuth();
  const [activeTab, setActiveTab] = useState<"mascotas" | "stock" | "turnos" | "clientes" | "ventas">("mascotas");

  // ── Stock state ──────────────────────────────────────────────────────────────
  const {products,reload:reloadProducts,error:productsError}=useProductos();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [productError,setProductError]=useState('');
  const [productSearch, setProductSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "", category: "Alimento", price: 0, stock: 0, description: "", imageUrl: ""
  });

  const categories = ["Alimento", "Juguetes", "Accesorios", "Higiene", "Salud"];

  const handleAdd = () => {
    setSelectedImage(null);
    setEditingProduct(null);
    setFormData({ name: "", category: "Alimento", price: 0, stock: 0, description: "", imageUrl: "" });
    setShowModal(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedImage(null);
    setEditingProduct(product);
    setFormData({ name: product.name, category: product.category, price: product.price, stock: product.stock, description: product.description, imageUrl: product.imageUrl || "" });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if(!confirm('¿Estás seguro de eliminar este producto?'))return;
    setProductError('');
    try{
      const response=await fetch(`http://localhost:3000/api/productos/${id}`,{method:'DELETE'});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo eliminar');
      await reloadProducts();
    }catch(e){setProductError(e instanceof Error?e.message:'Error al eliminar');}
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();setProductError('');
    try{
      const response=await fetch(`http://localhost:3000/api/productos${editingProduct?`/${editingProduct.id}`:''}`,{
        method:editingProduct?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...formData, ...(selectedImage ? {imageData:selectedImage} : {})})
      });
      const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo guardar');
      await reloadProducts();setShowModal(false);setSelectedImage(null);
    }catch(e){setProductError(e instanceof Error?e.message:'Error al guardar');}
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  // ── Turnos state ─────────────────────────────────────────────────────────────
  const clientNames = clients.map(c => c.fullName);
  const clientPets: Record<string, string[]> = {};
  clients.forEach(c => {
    clientPets[c.fullName] = pets.filter(p => p.clientId === c.id).map(p => p.name);
  });
  const { data: servicios, error: serviciosError } = useCatalogo<Servicio>("servicios");
  const { data: feriados, error: feriadosError } = useCatalogo<Feriado>("feriados");
  const apptServices = servicios.map(s => ({ name: s.descripcion, duration: `${s.duracion_minutos} min` }));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoMonthsLater = new Date(today);
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);

  const esFeriado = (fecha: Date) => esFeriadoFijo(fecha, feriados);
  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const [apptClient, setApptClient] = useState("");
  const [apptPet, setApptPet] = useState("");
  const [apptService, setApptService] = useState("");
  const [apptNotes, setApptNotes] = useState("");
  const [apptDate, setApptDate] = useState<string | null>(null);
  const [apptTime, setApptTime] = useState<string | null>(null);
  const [apptMonth, setApptMonth] = useState(new Date());
  const {turnos:appointments,reload:reloadTurnos,error:turnosError}=useTurnos();
  const [apptError,setApptError]=useState('');
  const [apptSaving,setApptSaving]=useState(false);
  const [apptSuccess, setApptSuccess] = useState(false);

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

  const isDateAvailable = (day: number) => {
  const d = new Date(
    apptMonth.getFullYear(),
    apptMonth.getMonth(),
    day
  );

  return d >= today && d <= twoMonthsLater && !esFeriado(d);
  };

  const getTimeSlots = (): TimeSlot[] => {
    const slots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30"];
    const selected=servicios.find(s=>s.descripcion===apptService);
    return slots.map(t => ({time:t,available:slotAvailable(apptDate?toIsoDate(apptDate):'',t,selected?.duracion_minutos||0,appointments)}));
  };

  const handleApptBooking = async () => {
    if (!apptClient || !apptPet || !apptService || !apptDate || !apptTime || apptSaving) return;
    const cliente=clients.find(c=>c.fullName===apptClient);
    const mascota=pets.find(p=>p.name===apptPet && p.clientId===cliente?.id);
    const servicio=servicios.find(s=>s.descripcion===apptService);
    if(!mascota||!servicio){setApptError('No se encontró mascota o servicio');return;}
    setApptSaving(true);setApptError('');
    try {
      const response=await fetch('http://localhost:3000/api/turnos',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          id_mascota:mascota.id,id_servicio:servicio.id_servicio,
          fecha:toIsoDate(apptDate),hora:apptTime,motivo:apptNotes
        })});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'No se pudo guardar');
      await reloadTurnos();
      setApptClient('');setApptPet('');setApptService('');setApptNotes('');
      setApptDate(null);setApptTime(null);setApptSuccess(true);
      setTimeout(()=>setApptSuccess(false),3000);
    }catch(e){setApptError(e instanceof Error?e.message:'Error al guardar');}
    finally{setApptSaving(false);}
  };

  // ── Clientes state ─────────────────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState("");
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientFormData, setClientFormData] = useState<Omit<Client, "id">>({
    fullName: "", dni: "", birthDate: "", email: "", phone: "", address: "", username: "", password: ""
  });

  const filteredClients = clients.filter(c =>
    c.fullName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.username.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleAddClient = () => {
    setEditingClient(null);
    setClientFormData({ fullName: "", dni: "", birthDate: "", email: "", phone: "", address: "", username: "", password: "" });
    setShowClientModal(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setClientFormData({ fullName: client.fullName, dni: client.dni, birthDate: client.birthDate || "", email: client.email, phone: client.phone, address: client.address, username: client.username, password: client.password });
    setShowClientModal(true);
  };

  const handleDeleteClient = (id: number) => {
    if (confirm("¿Estás seguro de eliminar este cliente?")) {
      alert("La eliminación de clientes en MySQL todavía no está implementada. No se eliminó ningún dato.");
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await updateClientInfo(editingClient.id, clientFormData);
      } else {
        await createClient({ id: 0, ...clientFormData });
      }
      setShowClientModal(false);
    } catch (error) { alert(error instanceof Error ? error.message : 'No se pudo guardar el cliente.'); }
  };

  const tabs = [
    { key: "mascotas" as const, label: "Mascotas", icon: <PawPrint className="w-4 h-4" /> },
    { key: "stock" as const, label: "Gestión de Stock", icon: <Package className="w-4 h-4" /> },
    { key: "turnos" as const, label: "Turnos", icon: <Calendar className="w-4 h-4" /> },
    { key: "clientes" as const, label: "Clientes", icon: <Users className="w-4 h-4" /> },
    { key: "ventas" as const, label: "Ventas", icon: <Package className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl text-gray-900">Panel Administrativo</h1>
          <p className="text-gray-600 mt-1">Mundo Peludo</p>
        </div>
        {activeTab === "stock" && (
          <button onClick={handleAdd} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-5 h-5" /> Agregar Producto
          </button>
        )}
        {activeTab === "clientes" && (
          <button onClick={handleAddClient} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-5 h-5" /> Agregar Cliente
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors ${activeTab === tab.key ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === "mascotas" && <Dashboard />}

      {activeTab === "ventas" && <VentasAdmin />}

      {/* ── STOCK TAB ────────────────────────────────────────────────────────── */}
      {activeTab === "stock" && (
        <>
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar productos..." className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Imagen</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Producto</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Categoría</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Precio</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Stock</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded-lg border border-gray-200" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                          <Image className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.description}</p>
                    </td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">{product.category}</span></td>
                    <td className="px-6 py-4 text-gray-900">${product.price.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`${product.stock === 0 ? "text-red-600" : product.stock < 5 ? "text-yellow-600" : "text-green-600"}`}>{product.stock}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TURNOS TAB ───────────────────────────────────────────────────────── */}
      {activeTab === "turnos" && (
        <div className="space-y-6">
          {apptSuccess && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-5 py-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-800">Turno asignado exitosamente.</p>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl mb-4 text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" />Seleccionar Fecha</h2>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => { const n = new Date(apptMonth.getFullYear(), apptMonth.getMonth() - 1); if (n >= new Date(today.getFullYear(), today.getMonth(), 1)) setApptMonth(n); }} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                <span className="text-gray-900">{monthNames[apptMonth.getMonth()]} {apptMonth.getFullYear()}</span>
                <button onClick={() => { const n = new Date(apptMonth.getFullYear(), apptMonth.getMonth() + 1); if (n <= new Date(twoMonthsLater.getFullYear(), twoMonthsLater.getMonth(), 1)) setApptMonth(n); }} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d => <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(apptMonth).map((day, i) => {
                  const avail = day ? isDateAvailable(day) : false;
                  const dateStr = day ? `${day} ${monthNames[apptMonth.getMonth()]} ${apptMonth.getFullYear()}` : "";
                  const selected = apptDate === dateStr;
                  return (
                    <button key={i} onClick={() => { if (day && avail) { setApptDate(dateStr); setApptTime(null); } }} disabled={!day || !avail}
                      className={`aspect-square flex items-center justify-center rounded-lg text-sm transition-colors ${!day ? "invisible" : !avail ? "bg-gray-100 text-gray-300 cursor-not-allowed" : selected ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-blue-100 text-gray-900"}`}>
                      {day}
                    </button>
                  );
                })}
              </div>
              {apptDate && (
                <div className="mt-5">
                  <h3 className="text-gray-900 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" />Horarios — {apptDate}</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {getTimeSlots().map(slot => (
                      <button key={slot.time} onClick={() => slot.available && setApptTime(slot.time)} disabled={!slot.available}
                        className={`px-2 py-1.5 rounded-lg text-sm transition-colors ${!slot.available ? "bg-gray-200 text-gray-400 cursor-not-allowed" : apptTime === slot.time ? "bg-green-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"}`}>
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl mb-4 text-gray-900 flex items-center gap-2"><User className="w-5 h-5 text-blue-600" />Datos del Turno</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Cliente *</label>
                    <select value={apptClient} onChange={e => { setApptClient(e.target.value); setApptPet(""); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Seleccionar cliente</option>
                      {clientNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Mascota *</label>
                    <select value={apptPet} onChange={e => setApptPet(e.target.value)} disabled={!apptClient}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                      <option value="">Seleccionar mascota</option>
                      {apptClient && (clientPets[apptClient] || []).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Servicio *</label>
                    <select value={apptService} onChange={e => setApptService(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{serviciosError || "Seleccionar servicio"}</option>
                      {(serviciosError ? [] : apptServices).map(s => <option key={s.name} value={s.name}>{s.name} — {s.duration}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Notas internas</label>
                    <textarea value={apptNotes} onChange={e => setApptNotes(e.target.value)} rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <h3 className="text-gray-900 mb-3">Resumen</h3>
                <div className="space-y-1 text-sm text-gray-700 mb-4">
                  <p><span className="text-gray-500">Cliente:</span> {apptClient || "—"}</p>
                  <p><span className="text-gray-500">Mascota:</span> {apptPet || "—"}</p>
                  <p><span className="text-gray-500">Servicio:</span> {apptService || "—"}</p>
                  <p><span className="text-gray-500">Fecha:</span> {apptDate || "—"}</p>
                  <p><span className="text-gray-500">Hora:</span> {apptTime || "—"}</p>
                </div>
                {(apptError||turnosError) && <p className="text-red-600">{apptError||turnosError}</p>}
                  <button onClick={handleApptBooking} disabled={!apptClient || !apptPet || !apptService || !apptDate || !apptTime}
                  className={`w-full py-3 rounded-lg transition-colors ${apptClient && apptPet && apptService && apptDate && apptTime ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                  Confirmar Turno
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg text-gray-900">Turnos Registrados</h2></div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Cliente","Mascota","Servicio","Fecha","Hora"].map(h => <th key={h} className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {appointments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{a.client}</td>
                    <td className="px-6 py-4 text-gray-600">{a.pet}</td>
                    <td className="px-6 py-4 text-gray-600">{a.service}</td>
                    <td className="px-6 py-4 text-gray-600">{a.date}</td>
                    <td className="px-6 py-4 text-gray-600">{a.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CLIENTES TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "clientes" && (
        <>
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                placeholder="Buscar clientes por nombre, email o usuario..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="space-y-3">
            {filteredClients.map(client => {
              const clientPetsList = pets.filter(p => p.clientId === client.id);
              const isExpanded = expandedClient === client.id;
              return (
                <div key={client.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-gray-900">{client.fullName}</p>
                        <p className="text-sm text-gray-500">{client.email} · @{client.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <PawPrint className="w-4 h-4" />{clientPetsList.length} mascota{clientPetsList.length !== 1 ? "s" : ""}
                      </span>
                      <button onClick={() => handleEditClient(client)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteClient(client.id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      <button onClick={() => setExpandedClient(isExpanded ? null : client.id)} className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                        <div><span className="text-gray-500">DNI:</span> <span className="text-gray-900">{client.dni}</span></div>
                        <div><span className="text-gray-500">Teléfono:</span> <span className="text-gray-900">{client.phone}</span></div>
                        <div><span className="text-gray-500">Dirección:</span> <span className="text-gray-900">{client.address}</span></div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-gray-700">Mascotas registradas</p>
                          <p className="text-xs text-gray-400 italic">Solo el veterinario puede agregar mascotas</p>
                        </div>
                        {clientPetsList.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">Sin mascotas registradas</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {clientPetsList.map(pet => (
                              <div key={pet.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
                                <PawPrint className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <div>
                                  <p className="text-gray-900 text-sm">{pet.name}</p>
                                  <p className="text-xs text-gray-500">{pet.species} · {pet.breed}</p>
                                </div>
                                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${pet.aggression === "Baja" ? "bg-green-100 text-green-700" : pet.aggression === "Media" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                                  {pet.aggression}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── PRODUCT MODAL ────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl text-gray-900">{editingProduct ? "Editar Producto" : "Agregar Producto"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {productError && <p className="text-red-600">{productError}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Nombre del Producto *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Alimento Premium Perro" />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Imagen del Producto</label>
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input type="file" accept="image/jpeg,image/png,image/webp"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      onChange={async e => {
                        const file=e.target.files?.[0];
                        if(!file) return;
                        if(!['image/jpeg','image/png','image/webp'].includes(file.type)) {setProductError('Usá JPG, PNG o WebP');return;}
                        if(file.size>2*1024*1024) {setProductError('La imagen debe pesar como máximo 2 MB');return;}
                        const reader=new FileReader();
                        reader.onload=()=>{setSelectedImage(String(reader.result));setProductError('');};
                        reader.onerror=()=>setProductError('No se pudo leer la imagen');
                        reader.readAsDataURL(file);
                      }} />
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG o WebP. Máximo 2 MB. Si no elegís otra imagen, se conserva la actual.</p>
                  </div>
                  <div className="w-16 h-16 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {(selectedImage || formData.imageUrl) ? (
                      <img src={selectedImage || formData.imageUrl} alt="Preview" className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <Image className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Categoría *</label>
                  <select required value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Precio *</label>
                  <input type="number" required min="0" value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Stock Disponible *</label>
                <input type="number" required min="0" value={formData.stock} onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Descripción</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">{editingProduct ? "Guardar Cambios" : "Agregar Producto"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CLIENT MODAL ─────────────────────────────────────────────────────── */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl text-gray-900">{editingClient ? "Editar Cliente" : "Agregar Cliente"}</h2>
              <button onClick={() => setShowClientModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleClientSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Nombre Completo *</label>
                  <input type="text" required value={clientFormData.fullName} onChange={e => setClientFormData({ ...clientFormData, fullName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">DNI *</label>
                  <input type="text" required value={clientFormData.dni} onChange={e => setClientFormData({ ...clientFormData, dni: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Fecha de nacimiento *</label>
                <input type="date" required max={new Date().toISOString().slice(0,10)}
                  value={clientFormData.birthDate}
                  onChange={e => setClientFormData({ ...clientFormData, birthDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Email *</label>
                <input type="email" required value={clientFormData.email} onChange={e => setClientFormData({ ...clientFormData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Teléfono *</label>
                  <input type="tel" required value={clientFormData.phone} onChange={e => setClientFormData({ ...clientFormData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Dirección *</label>
                  <input type="text" required value={clientFormData.address} onChange={e => setClientFormData({ ...clientFormData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Usuario *</label>
                    <input type="text" required value={clientFormData.username} onChange={e => setClientFormData({ ...clientFormData, username: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Contraseña {editingClient ? "" : "*"}</label>
                    <input type="password" required={!editingClient} value={clientFormData.password} onChange={e => setClientFormData({ ...clientFormData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={editingClient ? "Dejar vacío para mantener" : ""} />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowClientModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">{editingClient ? "Guardar Cambios" : "Agregar Cliente"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
