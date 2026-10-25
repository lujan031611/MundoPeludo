import { useEffect, useState } from "react";
export type Servicio = { id_servicio: number; descripcion: string; duracion_minutos: number };
export type Feriado = { id_feriado: number; nombre: string; dia_mes: string };
export type Especie = { id_especie: number; tipo_especie: string };
export type Raza = { id_raza: number; id_especie: number; tipo_raza: string };
const API = "http://localhost:3000/api/catalogos";
export function useCatalogo<T>(recurso: string) {
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`${API}/${recurso}`)
      .then(async response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then(rows => { if (active) { setData(rows); setError(""); } })
      .catch(() => { if (active) { setData([]); setError("No se pudieron cargar los datos desde MySQL."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [recurso]);
  return { data, error, loading };
}
export function esFeriadoFijo(fecha: Date, feriados: Feriado[]) {
  const diaMes = `${String(fecha.getDate()).padStart(2, "0")}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
  return feriados.some(f => f.dia_mes === diaMes);
}
