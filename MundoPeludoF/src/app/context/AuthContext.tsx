import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// La edad se calcula a partir de la fecha guardada, sin persistir un número fijo.
export function calcularEdadMascota(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!partes) return "";
  const anio = Number(partes[1]), mes = Number(partes[2]), dia = Number(partes[3]);
  const hoy = new Date();
  const nacimiento = new Date(anio, mes - 1, dia);
  if (nacimiento.getFullYear() !== anio || nacimiento.getMonth() !== mes - 1 ||
      nacimiento.getDate() !== dia || nacimiento > hoy) return "";
  let meses = (hoy.getFullYear() - anio) * 12 + hoy.getMonth() - (mes - 1);
  if (hoy.getDate() < dia) meses--;
  if (meses < 1) return "Menos de 1 mes";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  return `${anios} ${anios === 1 ? "año" : "años"}`;
}

export interface Pet {
  id: number;
  name: string;
  species: string;
  breed: string;
  age: string;
  fecha_nac: string;
  aggression: "Baja" | "Media" | "Alta";
  observations: string;
  clientId: number;
  lastVisit?: string;
}

export interface Client {
  id: number;
  fullName: string;
  dni: string;
  birthDate: string;
  email: string;
  phone: string;
  address: string;
  username: string;
  password: string;
}

export interface ClinicalRecord {
  id: number;
  date: string;
  petId: number;
  petName: string;
  owner: string;
  service: string;
  veterinarian: string;
  notes: string;
}

type Role = "admin" | "vet" | "client";

interface AuthUser {
  username: string;
  role: Role;
  clientId?: number;
  fullName?: string;
  dni?: string;
  birthDate?: string;
  staffId?: number;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  restoringSession: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: Client) => Promise<void>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  pets: Pet[];
  setPets: React.Dispatch<React.SetStateAction<Pet[]>>;
  clinicalRecords: ClinicalRecord[];
  setClinicalRecords: React.Dispatch<React.SetStateAction<ClinicalRecord[]>>;
  updateClientPassword: (clientId: number, currentPassword: string, newPassword: string) => Promise<void>;
  updateClientInfo: (clientId: number, data: Partial<Client>) => Promise<void>;
  createClient: (data: Client) => Promise<void>;
  reloadPets: () => Promise<void>;
  reloadRecords: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const initialClients: Client[] = [];
const initialPets: Pet[] = [];
const initialRecords: ClinicalRecord[] = [];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  useEffect(() => {
    let active = true;
    fetch('http://localhost:3000/api/sesion', { credentials: 'include', cache: 'no-store' })
      .then(async r => r.ok ? (await r.json()).user : null)
      .then(user => { if (active) setCurrentUser(user); })
      .catch(() => { if (active) setCurrentUser(null); })
      .finally(() => { if (active) setRestoringSession(false); });
    return () => { active = false; };
  }, []);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [pets, setPets] = useState<Pet[]>(initialPets);
  const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>(initialRecords);

  const fromDatabase = (c: any): Client => ({
    id: c.id_clien, fullName: `${c.nombre} ${c.apellido}`.trim(), dni: c.dni || '', birthDate: c.fecha_na || '',
    email: c.email, phone: c.telefono, address: c.direccion || '',
    username: c.usuario, password: ''
  });

  const apiRequest = async (path: string, body: object) => {
    let response: Response;
    try {
      response = await fetch(`http://localhost:3000/api/clientes/${path}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
    } catch {
      throw new Error('No se pudo conectar con el backend en localhost:3000.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
    return result;
  };

  const login = async (username: string, password: string): Promise<void> => {
    // Intentar primero como personal; solo si no coincide, probar como cliente.
    let staffResponse: Response;
    try {
      staffResponse = await fetch('http://localhost:3000/api/personal/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: username, contraseña: password })
      });
    } catch {
      throw new Error('No se pudo conectar con el backend en localhost:3000.');
    }
    const staffResult = await staffResponse.json().catch(() => ({}));
    if (staffResponse.ok) {
      const personal = staffResult.personal;
      setCurrentUser({ username: personal.usuario, role: personal.role, fullName: `${personal.nombre} ${personal.apellido}`.trim(), dni: personal.dni, birthDate: personal.fecha_na, staffId: personal.id_personal });
      return;
    }
    if (staffResponse.status !== 401) {
      throw new Error(staffResult.error || 'No se pudo iniciar sesión.');
    }
    const { cliente } = await apiRequest('login', { usuario: username, contraseña: password });
    setClients(prev => [...prev.filter(c => c.id !== cliente.id_clien), fromDatabase(cliente)]);
    setCurrentUser({ username: cliente.usuario, role: 'client', clientId: cliente.id_clien });
  };

  const logout = () => {
    setCurrentUser(null);
    void fetch('http://localhost:3000/api/sesion/logout', {
      method: 'POST', credentials: 'include'
    }).catch(console.error);
  };

  const register = async (data: Client): Promise<void> => {
    const { cliente } = await apiRequest('registrar', data);
    setClients(prev => [...prev, fromDatabase(cliente)]);
    setCurrentUser({ username: cliente.usuario, role: 'client', clientId: cliente.id_clien });
  };

  useEffect(() => {
    fetch('http://localhost:3000/api/clientes').then(r => {
      if (!r.ok) throw new Error('No se pudo cargar clientes');
      return r.json();
    }).then(({ clientes }) => setClients(clientes.map(fromDatabase))).catch(console.error);
  }, []);

  const reloadPets = async () => {
    const response = await fetch('http://localhost:3000/api/mascotas');
    if (!response.ok) throw new Error('No se pudieron cargar las mascotas.');
    const rows = await response.json();
    setPets(rows.map((p: any) => ({...p, age: calcularEdadMascota(p.fecha_nac)})));
  };
  const reloadRecords = async () => {
    const response = await fetch('http://localhost:3000/api/historias');
    if (!response.ok) throw new Error('No se pudieron cargar las historias clínicas.');
    setClinicalRecords(await response.json());
  };
  useEffect(() => { reloadPets().catch(console.error); reloadRecords().catch(console.error); }, []);

  const updateClientInfo = async (clientId: number, data: Partial<Client>) => {
    const existing = clients.find(c => c.id === clientId);
    if (!existing) throw new Error('No se encontró el cliente.');
    const response = await fetch(`http://localhost:3000/api/clientes/${clientId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...existing, ...data })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo editar el cliente.');
    setClients(prev => prev.map(c => c.id === clientId ? fromDatabase(result.cliente) : c));
    setCurrentUser(prev => prev?.clientId === clientId ? { ...prev, username: result.cliente.usuario } : prev);
  };

  const updateClientPassword = async (clientId: number, currentPassword: string, newPassword: string) => {
    const response = await fetch(`http://localhost:3000/api/clientes/${clientId}/password`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo cambiar la contraseña.');
  };

  const createClient = async (data: Client) => {
    const { cliente } = await apiRequest('registrar', data);
    setClients(prev => [...prev, fromDatabase(cliente)]);
  };

  return (
    <AuthContext.Provider value={{
      currentUser, restoringSession, login, logout, register,
      clients, setClients,
      pets, setPets,
      clinicalRecords, setClinicalRecords,
      updateClientPassword, updateClientInfo, createClient, reloadPets, reloadRecords,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
