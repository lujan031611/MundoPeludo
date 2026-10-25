import { useProductos } from "../hooks/useProductos";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { ShoppingCart, Search, Filter, Package, AlertCircle, Plus, Minus, Trash2, X } from "lucide-react";

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string;
  description: string;
}

const money = (value: number) => `$${value.toLocaleString("es-AR")}`;

export default function Shop() {
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const { currentUser, clients } = useAuth();
  const navigate = useNavigate();
  const client = clients.find(c => c.id === currentUser?.clientId);
  const [checkout, setCheckout] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"registered" | "other" | "pickup">("registered");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [processing, setProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);

  const confirmPurchase = async () => {
    if (processing || !cartProducts.length) return;
    setCheckoutError(""); setProcessing(true);
    try {
      const response = await fetch("http://localhost:3000/api/ventas", {
        method: "POST", credentials: "include", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          items: cartProducts.map(p => ({productId:p.id,quantity:cart[p.id]})),
          deliveryType, deliveryAddress:deliveryType === "other" ? deliveryAddress.trim() : undefined,
          deliveryInstructions:deliveryType !== "pickup" ? deliveryInstructions.trim() : undefined
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo confirmar la compra");
      setOrderId(result.id); setCart({}); setCheckout(false); setCartOpen(false);
      void reloadProducts().catch(() => {});
    } catch (error) { setCheckoutError(error instanceof Error ? error.message : "Error al confirmar la compra"); }
    finally {setProcessing(false);}
  };
  const categories = ["Todos", "Alimento", "Juguetes", "Accesorios", "Higiene", "Salud"];

  const { products: dbProducts, error: productsError, reload: reloadProducts } = useProductos();
  const products: Product[] = dbProducts.map(p => ({ ...p, image: p.imageUrl || "" }));
  const productById = new Map(products.map(p => [p.id, p]));
  const cartProducts = products.filter(p => (cart[p.id] || 0) > 0);
  const totalItems = cartProducts.reduce((sum, p) => sum + Math.min(cart[p.id], Math.max(0, p.stock)), 0);
  const totalPrice = cartProducts.reduce((sum, p) => sum + p.price * Math.min(cart[p.id], Math.max(0, p.stock)), 0);
  const filteredProducts = products.filter(p =>
    (selectedCategory === "Todos" || p.category === selectedCategory) &&
    `${p.name} ${p.description}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))
  );

  // Si el administrativo modifica el stock mientras el cliente compra,
  // las cantidades seleccionadas no pueden superar la disponibilidad actual.
  useEffect(() => {
    setCart(previous => {
      let changed = false;
      const next: Record<number, number> = {};
      for (const [id, qty] of Object.entries(previous)) {
        const stock = productById.get(Number(id))?.stock;
        const adjusted = stock === undefined ? qty : Math.min(qty, Math.max(0, stock));
        if (adjusted > 0) next[Number(id)] = adjusted;
        if (adjusted !== qty) changed = true;
      }
      return changed ? next : previous;
    });
  }, [dbProducts]);

  useEffect(() => {
    if (!cartOpen) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setCartOpen(false); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [cartOpen]);

  const changeQuantity = (product: Product, delta: number) => {
    setCart(previous => {
      const next = { ...previous };
      const qty = Math.max(0, Math.min(product.stock, (previous[product.id] || 0) + delta));
      if (qty === 0) delete next[product.id];
      else next[product.id] = qty;
      return next;
    });
  };
  const removeProduct = (id: number) => setCart(previous => {
    const next = { ...previous };
    delete next[id];
    return next;
  });

  const quantityControl = (product: Product) => (
    <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden" aria-label={`Cantidad de ${product.name}`}>
      <button type="button" onClick={() => changeQuantity(product, -1)}
        className="p-2 hover:bg-gray-100 text-gray-700" aria-label={`Quitar una unidad de ${product.name}`}>
        <Minus className="w-4 h-4" />
      </button>
      <span className="min-w-8 text-center font-medium text-gray-900">{cart[product.id] || 0}</span>
      <button type="button" onClick={() => changeQuantity(product, 1)}
        disabled={(cart[product.id] || 0) >= product.stock}
        className="p-2 hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label={`Agregar una unidad de ${product.name}`}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {orderId !== null && <div className="mb-6 p-5 bg-green-50 border border-green-300 rounded-xl text-green-800">
        <strong>¡Pedido #{orderId} registrado correctamente!</strong> Podés consultarlo en Mi Cuenta → Mis compras.
        <button className="ml-3 underline" onClick={() => navigate("/cuenta?tab=compras")}>Ver mis compras</button>
        <button className="float-right" onClick={() => setOrderId(null)}>×</button>
      </div>}
      <div className="flex justify-between items-center gap-4 mb-8">
        <h1 className="text-3xl text-gray-900">Tienda - Mundo Peludo</h1>
        <button type="button" onClick={() => setCartOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          aria-label={`Abrir carrito, ${totalItems} productos`}>
          <ShoppingCart className="w-5 h-5" /> Carrito ({totalItems})
        </button>
      </div>

      {productsError && <p className="text-red-600 mb-4">{productsError}</p>}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Package className="w-5 h-5 text-blue-600 mt-0.5" />
        <div><h3 className="text-gray-900 mb-1">Stock en Tiempo Real</h3>
          <p className="text-sm text-gray-600">El stock mostrado se actualiza automáticamente. Los productos sin stock mostrarán "Sin Stock".</p>
        </div>
      </div>

      <div className="mb-8">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-gray-600" />
          <div className="flex gap-2 flex-wrap">
            {categories.map(category => (
              <button key={category} onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg transition-colors ${selectedCategory === category ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}>
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredProducts.map(product => (
          <div key={product.id} className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${product.stock === 0 ? "opacity-75" : ""}`}>
            <div className="bg-gradient-to-br from-blue-100 to-green-100 p-8 flex items-center justify-center relative">
              <img src={product.image} alt={product.name} className="w-full h-48 object-contain" />
              {product.stock === 0 && <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold">SIN STOCK</span>
              </div>}
            </div>
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{product.category}</span>
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className={`text-sm ${product.stock === 0 ? "text-red-600" : product.stock < 5 ? "text-yellow-600" : "text-green-600"}`}>Stock: {product.stock}</span>
                </div>
              </div>
              <h3 className="text-lg mb-1 text-gray-900">{product.name}</h3>
              <p className="text-sm text-gray-600 mb-3">{product.description}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xl text-blue-600">{money(product.price)}</span>
                {cart[product.id] > 0 ? quantityControl(product) :
                  <button type="button" onClick={() => changeQuantity(product, 1)} disabled={product.stock <= 0}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">
                    {product.stock <= 0 ? "Sin Stock" : "Agregar"}
                  </button>}
              </div>
              {cart[product.id] > 0 && <p className="text-sm text-green-600 mt-2">{cart[product.id]} en carrito</p>}
              {product.stock > 0 && product.stock < 5 && <div className="flex items-center gap-1 mt-2 text-yellow-600">
                <AlertCircle className="w-4 h-4" /><p className="text-xs">¡Últimas unidades!</p>
              </div>}
            </div>
          </div>
        ))}
      </div>

      {checkout && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-start justify-center p-4 sm:p-10" role="presentation">
        <section role="dialog" aria-modal="true" aria-label="Entrega del pedido" className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 space-y-5">
          <div className="flex justify-between items-center"><h2 className="text-2xl font-semibold">Entrega del pedido</h2>
            <button onClick={() => setCheckout(false)} aria-label="Cerrar" className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5"/></button></div>
          <p className="text-gray-600">Elegí cómo querés recibir tus productos.</p>
          <div className="space-y-3">
            {([['registered','Envío a mi domicilio registrado'],['other','Envío a otro domicilio'],['pickup','Retiro en el local']] as const).map(([value,label]) =>
              <label key={value} className="flex gap-3 items-center border rounded-lg p-3 cursor-pointer">
                <input type="radio" name="delivery" checked={deliveryType===value} onChange={()=>setDeliveryType(value)} />{label}
              </label>)}
          </div>
          {deliveryType === 'registered' && <div className="p-3 bg-blue-50 rounded-lg text-sm">
            <strong>Dirección registrada:</strong> {client?.address || 'No hay dirección disponible en tu cuenta'}
          </div>}
          {deliveryType === 'other' && <label className="block text-sm font-medium">Dirección de entrega *
            <textarea rows={2} maxLength={255} value={deliveryAddress} onChange={e=>setDeliveryAddress(e.target.value)}
              placeholder="Calle, número, piso, departamento, localidad" className="block w-full border rounded-lg p-3 mt-1" />
          </label>}
          {deliveryType !== 'pickup' && <label className="block text-sm font-medium">Instrucciones para la entrega (opcional)
            <textarea rows={2} maxLength={2000} value={deliveryInstructions} onChange={e=>setDeliveryInstructions(e.target.value)}
              placeholder="Ej.: Tocar el timbre de la derecha" className="block w-full border rounded-lg p-3 mt-1" />
          </label>}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Resumen de compra</h3>
            {cartProducts.map(p => <div key={p.id} className="flex justify-between text-sm gap-3">
              <span>{cart[p.id]} × {p.name}</span><span>{money(p.price * cart[p.id])}</span>
            </div>)}
            <div className="border-t pt-3 flex justify-between font-semibold"><span>Total</span><span>{money(totalPrice)}</span></div>
          </div>
          {checkoutError && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg">{checkoutError}</p>}
          <div className="flex gap-3">
            <button type="button" disabled={processing} onClick={() => {setCheckout(false);setCartOpen(true);}}
              className="flex-1 border rounded-lg py-3 hover:bg-gray-50">Volver al carrito</button>
            <button type="button" disabled={processing || !totalItems || (deliveryType==='other'&&!deliveryAddress.trim()) || (deliveryType==='registered'&&!client?.address?.trim())}
              onClick={confirmPurchase} className="flex-1 bg-green-600 text-white rounded-lg py-3 hover:bg-green-700 disabled:opacity-50">
              {processing ? 'Registrando...' : 'Confirmar compra'}
            </button>
          </div>
        </section>
      </div>}
      {cartOpen && <div className="fixed inset-0 z-50" role="presentation">
        <button type="button" className="absolute inset-0 bg-black/40 w-full h-full cursor-default"
          onClick={() => setCartOpen(false)} aria-label="Cerrar carrito" />
        <aside role="dialog" aria-modal="true" aria-label="Mi carrito"
          className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-5 border-b">
            <div><h2 className="text-xl font-semibold text-gray-900">Mi carrito</h2>
              <p className="text-sm text-gray-500">{totalItems} {totalItems === 1 ? "producto" : "productos"}</p>
            </div>
            <button type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar carrito" className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {cartProducts.length === 0 ? <div className="text-center text-gray-500 py-16">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Tu carrito está vacío.</p>
              <button type="button" onClick={() => setCartOpen(false)} className="mt-4 text-blue-600 hover:underline">Seguir comprando</button>
            </div> : cartProducts.map(product => (
              <div key={product.id} className="flex gap-3 border-b pb-5">
                <img src={product.image} alt={product.name} className="w-20 h-20 rounded-lg object-contain bg-blue-50" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-gray-900">{product.name}</h3>
                    <button type="button" onClick={() => removeProduct(product.id)} aria-label={`Eliminar ${product.name} del carrito`}
                      className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <p className="text-sm text-gray-500">{money(product.price)} c/u</p>
                  <div className="flex items-center justify-between mt-3 gap-2">
                    {quantityControl(product)}
                    <span className="font-semibold text-gray-900">{money(product.price * (cart[product.id] || 0))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-5 space-y-4 bg-white">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total ({totalItems} productos)</span>
              <span className="text-2xl font-semibold text-gray-900">{money(totalPrice)}</span>
            </div>
            <button type="button" disabled={!totalItems} onClick={() => {setCartOpen(false);setCheckout(true);setCheckoutError("");}}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              Continuar compra
            </button>
          </div>
        </aside>
      </div>}
    </div>
  );
}
