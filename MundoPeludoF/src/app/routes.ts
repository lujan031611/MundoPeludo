import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import Home from "./components/Home";
import Dashboard from "./components/Dashboard";
import Account from "./components/Account";
import Shop from "./components/Shop";
import Appointments from "./components/Appointments";
import Register from "./components/Register";
import AdminPanel from "./components/AdminPanel";
import VetPanel from "./components/VetPanel";
import { PantallaConfiguracion } from "./components/configuracion"; 

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "dashboard", Component: Dashboard },
      { path: "cuenta", Component: Account },
      { path: "tienda", Component: Shop },
      { path: "turnos", Component: Appointments },
      { path: "registro", Component: Register },
      { path: "admin", Component: AdminPanel },
      { path: "veterinario", Component: VetPanel },
      { path: "configuracion", Component: PantallaConfiguracion },
    ],
  },
]);