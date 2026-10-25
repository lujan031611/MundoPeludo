import { useCallback, useEffect, useState } from "react";
import type { DiaAtencion } from "../../service/api";

export interface Turno {
  id: number;
  petId: number;
  serviceId: number;
  date: string;
  time: string;
  notes: string;
  pet: string;
  service: string;
  duration: number;
  client: string;
  status: 'activo' | 'cancelado';
}

export function useTurnos() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3000/api/turnos', { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudieron cargar los turnos');
      setTurnos(await response.json());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar turnos');
      throw e;
    }
  }, []);

  useEffect(() => {
    const refresh = () => { void reload().catch(() => {}); };
    refresh();
    window.addEventListener('focus', refresh);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [reload]);

  return { turnos, error, reload };
}

export function toIsoDate(display: string) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const [day, month, year] = display.split(' ');
  const m = months.indexOf(month) + 1;
  return m && day && year ? `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}` : '';
}

export function esBano(nombre?: string | null) {
  const n = (nombre ?? '').trim().toLocaleLowerCase('es');
  return n === 'baño' || n === 'bano';
}

export function slotAvailable(date: string, time: string, duration: number, turnos: Turno[], servicio?: string) {
  if (!date || !servicio?.trim() || !Number.isFinite(duration) || duration <= 0) return false;
  const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return !turnos.some(t => {
    const fechaGuardada = String(t.date).slice(0, 10);
    if (t.status === 'cancelado' || fechaGuardada !== date) return false;
    const other = Number(t.time.slice(0, 2)) * 60 + Number(t.time.slice(3, 5));
    return start < other + Number(t.duration) && other < start + duration;
  });
}

// Genera los horarios disponibles según la configuración del día y la duración del servicio
export function generarSlotsDelDia(
  configDia?: DiaAtencion,
  duracionServicio: number = 30,
  intervaloMinutos: number = 30
): string[] {
  if (!configDia || !configDia.activo || !configDia.hora_apertura || !configDia.hora_cierre) {
    return [];
  }

  const slots: string[] = [];
  const [hIni, mIni] = String(configDia.hora_apertura).slice(0, 5).split(':').map(Number);
  const [hFin, mFin] = String(configDia.hora_cierre).slice(0, 5).split(':').map(Number);
  const iniMin = hIni * 60 + mIni;
  const finMin = hFin * 60 + mFin;
  const paso = intervaloMinutos > 0 ? intervaloMinutos : 30;

  for (let min = iniMin; min + duracionServicio <= finMin; min += paso) {
    const hh = String(Math.floor(min / 60)).padStart(2, '0');
    const mm = String(min % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }

  return slots;
}
