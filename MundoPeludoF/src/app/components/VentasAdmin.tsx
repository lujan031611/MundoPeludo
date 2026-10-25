import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, Package, RefreshCw, Truck, Store } from "lucide-react";

type SaleItem = { id?: number; productId?: number; name: string; quantity: number; unitPrice: number | string; subtotal: number | string };
type Sale = {
  id: number; clientId: number; clientName: string; username: string; date: string;
  total: number | string; delivered: number | boolean; shipping: number | boolean;
  deliveryAddress: string | null; deliveryInstructions: string | null; items: SaleItem[];
};
const money = (n: number | string) => Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const isTrue = (v: number | boolean) => v === true || v === 1;

export default function VentasAdmin() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<"pendientes" | "todos" | "entregados">("pendientes");
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/ventas", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudieron cargar las ventas.");
      }
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Respuesta de ventas inválida.");
      setSales(data);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Error al consultar ventas."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const changeDelivery = async (sale: Sale) => {
    const next = !isTrue(sale.delivered);
    if (!window.confirm(next ? `¿Marcar el pedido #${sale.id} como entregado?` : `¿Volver a marcar el pedido #${sale.id} como pendiente?`)) return;
    setBusy(sale.id);
    setError("");
    try {
      const res = await fetch(`http://localhost:3000/api/ventas/${sale.id}/entrega`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivered: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo actualizar el pedido.");
      }
      setSales(prev => prev.map(s => s.id === sale.id ? { ...s, delivered: next } : s));
    } catch (e) { setError(e instanceof Error ? e.message : "Error al actualizar el pedido."); }
    finally { setBusy(null); }
  };

  const visible = sales.filter(s => {
    if (filter === "pendientes" && isTrue(s.delivered)) return false;
    if (filter === "entregados" && !isTrue(s.delivered)) return false;
    const term = search.trim().toLocaleLowerCase("es");
    return !term || String(s.id).includes(term) || s.clientName?.toLocaleLowerCase("es").includes(term) || s.username?.toLocaleLowerCase("es").includes(term);
  });
  const pending = sales.filter(s => !isTrue(s.delivered)).length;

  return <section className="space-y-5">
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div><h2 className="text-2xl font-semibold text-gray-900">Gestión de ventas</h2>
          <p className="text-sm text-gray-500">{pending} pedido{pending !== 1 ? "s" : ""} pendiente{pending !== 1 ? "s" : ""} de entrega · {sales.length} en total</p></div>
        <button type="button" onClick={() => void reload()} disabled={loading} className="flex gap-2 items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
          <RefreshCw className="w-4 h-4" /> Actualizar</button>
      </div>
      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente o número de pedido" aria-label="Buscar ventas" className="flex-1 min-w-56 border rounded-lg px-3 py-2" />
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} aria-label="Filtrar por estado" className="border rounded-lg px-3 py-2 bg-white">
          <option value="pendientes">Pendientes</option><option value="todos">Todas</option><option value="entregados">Entregadas</option>
        </select>
      </div>
    </div>
    {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">{error}</p>}
    {loading ? <p className="p-5">Cargando ventas...</p> : visible.length === 0 ?
      <p className="bg-white rounded-xl border p-6 text-gray-500">No hay pedidos que coincidan con el filtro.</p> :
      visible.map(sale => <article key={sale.id} className="bg-white rounded-xl shadow-sm border p-5 space-y-3">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div><h3 className="text-lg font-semibold">Pedido #{sale.id}</h3>
            <p className="text-sm text-gray-600">{sale.clientName} · @{sale.username}</p>
            <p className="text-sm text-gray-500">{new Date(String(sale.date).replace(" ", "T")).toLocaleString("es-AR")}</p></div>
          <span className={`inline-flex gap-1 items-center px-3 py-1 rounded-full text-sm ${isTrue(sale.delivered) ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {isTrue(sale.delivered) ? <CheckCircle2 className="w-4 h-4" /> : <Clock3 className="w-4 h-4" />}
            {isTrue(sale.delivered) ? "Entregado" : "Pendiente"}</span>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3">
          <span className="flex gap-2 items-center text-gray-700">{isTrue(sale.shipping) ? <Truck className="w-4 h-4" /> : <Store className="w-4 h-4" />}
            {isTrue(sale.shipping) ? "Envío a domicilio" : "Retiro en local"}</span>
          <strong className="text-lg">{money(sale.total)}</strong>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <button type="button" onClick={() => setExpanded(expanded === sale.id ? null : sale.id)} className="inline-flex gap-1 items-center text-blue-700 hover:underline">
            {expanded === sale.id ? "Ocultar detalle" : "Ver detalle"}{expanded === sale.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => void changeDelivery(sale)} disabled={busy !== null}
            className={`rounded-lg px-4 py-2 text-white disabled:opacity-50 ${isTrue(sale.delivered) ? "bg-gray-600 hover:bg-gray-700" : "bg-green-600 hover:bg-green-700"}`}>
            {busy === sale.id ? "Guardando..." : isTrue(sale.delivered) ? "Marcar pendiente" : "Marcar entregado"}
          </button>
        </div>
        {expanded === sale.id && <div className="border-t pt-3 space-y-3 text-sm">
          <h4 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4" /> Productos</h4>
          {(sale.items || []).map((item, i) => <div key={`${item.productId ?? item.id ?? i}-${i}`} className="flex justify-between gap-3">
            <span>{item.quantity} × {item.name} ({money(item.unitPrice)} c/u)</span>
            <span className="whitespace-nowrap">{money(item.subtotal)}</span>
          </div>)}
          {isTrue(sale.shipping) && <p><strong>Dirección:</strong> {sale.deliveryAddress || "No indicada"}</p>}
          {Boolean(sale.deliveryInstructions) && <p><strong>Instrucciones:</strong> {sale.deliveryInstructions}</p>}
        </div>}
      </article>)}
  </section>;
}
