import { Outlet, Link, Navigate, useLocation, useNavigate } from "react-router";
import { PawPrint, ShoppingBag, Calendar, User, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  if (location.pathname === '/admin' && currentUser?.role !== 'admin') return <Navigate to={currentUser?.role === 'vet' ? '/veterinario' : '/'} replace />;
  if (location.pathname === '/veterinario' && currentUser?.role !== 'vet') return <Navigate to={currentUser?.role === 'admin' ? '/admin' : '/'} replace />;
  if (location.pathname === '/dashboard' && currentUser?.role === 'client') return <Navigate to="/" replace />;
  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link to="/" className="flex items-center gap-2">
              <PawPrint className="w-8 h-8 text-blue-600" />
              <span className="text-2xl text-blue-900">Mundo Peludo</span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                to="/"
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isActive("/") && location.pathname === "/"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-blue-50"
                }`}
              >
                Inicio
              </Link>
              <Link
                to="/tienda"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive("/tienda")
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-blue-50"
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Tienda
              </Link>
              <Link
                to="/turnos"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive("/turnos")
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-blue-50"
                }`}
              >
                <Calendar className="w-4 h-4" />
                Turnos
              </Link>
              <Link
                to="/cuenta"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive("/cuenta")
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-blue-50"
                }`}
              >
                <User className="w-4 h-4" />
                {currentUser?.fullName || (currentUser?.role === "client" ? currentUser.username : "Cuenta")}
              </Link>

              <div className="w-px h-6 bg-gray-200 mx-1" />

              <button
                onClick={() => { logout(); navigate("/", { replace: true }); }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors text-sm"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <PawPrint className="w-6 h-6 text-blue-600" />
                <span className="text-xl text-blue-900">Mundo Peludo</span>
              </div>
              <p className="text-gray-600">Cuidando a tus mascotas con amor y profesionalismo</p>
            </div>
            <div>
              <h3 className="mb-4 text-gray-900">Contacto</h3>
              <p className="text-gray-600">Tel: (381) 123-1234</p>
              <p className="text-gray-600">Email: info@mundopeludo.com</p>
              <p className="text-gray-600">Dirección: Av. Pte. Perón 1020</p>
              {(currentUser?.role === "admin" || currentUser?.role === "vet") && (
                <div className="mt-4 flex gap-4 text-sm">
                  {currentUser.role === "admin" && (
                    <Link to="/admin" className="text-blue-600 hover:underline">Panel Admin</Link>
                  )}
                  {currentUser.role === "vet" && (
                    <Link to="/veterinario" className="text-blue-600 hover:underline">Panel Veterinario</Link>
                  )}
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-4 text-gray-900">Horarios</h3>
              <p className="text-gray-600">Atención urgencias 24/7</p>
              <p className="text-gray-600">Turnos online disponibles</p>
              <p className="text-gray-600">Emergencias: (381) 111-2222</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
