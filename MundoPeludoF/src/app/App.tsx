import { useState, useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PawPrint, User, Lock, Eye, EyeOff } from "lucide-react";

// Función para obtener la configuración directamente sin problemas de rutas
const obtenerConfiguracion = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/configuracion');
    if (!response.ok) throw new Error('Error al obtener configuración');
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};

function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Estado para la configuración del negocio (traída de la BD)
  const [config, setConfig] = useState<any>({});

  // Cargar la configuración al abrir la pantalla
  useEffect(() => {
    const cargarConfig = async () => {
      const data = await obtenerConfiguracion();
      if (data) setConfig(data);
    };
    cargarConfig();
  }, []);

  // Login state
  const [loginData, setLoginData] = useState({ username: "", password: "" });

  // Register state
  const [clientData, setClientData] = useState({
    fullName: "", dni: "", birthDate: "", email: "", phone: "", address: "",
    username: "", password: "", confirmPassword: ""
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSubmitting(true);
    try { await login(loginData.username, loginData.password); }
    catch (err) { setError(err instanceof Error ? err.message : 'Error al iniciar sesión.'); }
    finally { setSubmitting(false); }
  };

  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clientData.password !== clientData.confirmPassword) {
      setError('Las contraseñas no coinciden'); return;
    }
    setError(''); setSubmitting(true);
    try {
      await register({ id: 0, fullName: clientData.fullName, dni: clientData.dni, birthDate: clientData.birthDate,
        email: clientData.email, phone: clientData.phone, address: clientData.address,
        username: clientData.username, password: clientData.password });
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al registrar.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-2">
          <PawPrint className="w-8 h-8 text-blue-600 fill-blue-600" />
          {/* Muestra dinámicamente la razón social de la base de datos */}
          <span className="text-2xl text-blue-900">{config.razon_social || "Mundo Peludo"}</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
          {/* Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-8">
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2.5 text-sm transition-colors ${mode === "login" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-2.5 text-sm transition-colors ${mode === "register" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Registrarse
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="text-center mb-6">
                <PawPrint className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                <h2 className="text-2xl text-gray-900">Bienvenido</h2>
                <p className="text-gray-500 text-sm mt-1">Ingresa a tu cuenta de {config.razon_social || "Mundo Peludo"}</p>
              </div>
              <div>
                <label className="block text-gray-700 mb-1.5 text-sm">Usuario</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={loginData.username}
                    onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="nombre_usuario"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-1.5 text-sm">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors mt-2">
                Ingresar
              </button>

            </form>
          )}

          {mode === "register" && (
                <form onSubmit={handleRegisterClient} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">Nombre completo *</label>
                      <input type="text" required value={clientData.fullName}
                        onChange={e => setClientData({ ...clientData, fullName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Nombre y apellido" />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">DNI *</label>
                      <input type="text" required value={clientData.dni}
                        onChange={e => setClientData({ ...clientData, dni: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="12.345.678" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Fecha de nacimiento *</label>
                    <input type="date" required max={new Date().toISOString().slice(0,10)}
                      value={clientData.birthDate}
                      onChange={e => setClientData({ ...clientData, birthDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">Email *</label>
                    <input type="email" required value={clientData.email}
                      onChange={e => setClientData({ ...clientData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="tu@email.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">Teléfono *</label>
                      <input type="tel" required value={clientData.phone}
                        onChange={e => setClientData({ ...clientData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="+54 11 1234-5678" />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">Dirección *</label>
                      <input type="text" required value={clientData.address}
                        onChange={e => setClientData({ ...clientData, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Av. Principal 123" />
                    </div>
                  </div>
                  <div className="border-t pt-3 mt-1">
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">Usuario *</label>
                      <input type="text" required value={clientData.username}
                        onChange={e => setClientData({ ...clientData, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="nombre_usuario" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">Contraseña *</label>
                      <input type="password" required value={clientData.password}
                        onChange={e => setClientData({ ...clientData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1 text-sm">Confirmar *</label>
                      <input type="password" required value={clientData.confirmPassword}
                        onChange={e => setClientData({ ...clientData, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="••••••••" />
                    </div>
                  </div>
                  <button type="submit" disabled={submitting} className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm mt-1">
                    Completar Registro
                  </button>
                </form>
          )}

        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { currentUser, restoringSession } = useAuth();
  useEffect(() => {
    if (!currentUser) return;
    const destination = currentUser.role === 'admin' ? '/admin'
      : currentUser.role === 'vet' ? '/veterinario' : '/';
    void router.navigate(destination, { replace: true });
  }, [currentUser?.username, currentUser?.role]);
  if (restoringSession) return <div className="min-h-screen flex items-center justify-center">Restaurando sesión...</div>;
  if (!currentUser) return <LoginScreen />;
  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}