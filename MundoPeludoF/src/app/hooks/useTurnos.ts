import { useCallback, useEffect, useState } from "react";
export interface Turno {id:number;petId:number;serviceId:number;date:string;time:string;notes:string;pet:string;service:string;duration:number;client:string;status:'activo'|'cancelado'}
export function useTurnos() {
  const [turnos,setTurnos]=useState<Turno[]>([]);
  const [error,setError]=useState("");
  const reload=useCallback(async()=>{
    try {
      const response=await fetch('http://localhost:3000/api/turnos',{cache:'no-store'});
      if(!response.ok) throw new Error('No se pudieron cargar los turnos');
      setTurnos(await response.json());
      setError("");
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Error al cargar turnos');
      throw e;
    }
  },[]);
  useEffect(()=>{
    const refresh=()=>{void reload().catch(()=>{});};
    refresh();
    window.addEventListener('focus',refresh);
    const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
    document.addEventListener('visibilitychange',onVisible);
    const timer=window.setInterval(refresh,15000);
    return ()=>{
      window.removeEventListener('focus',refresh);
      document.removeEventListener('visibilitychange',onVisible);
      window.clearInterval(timer);
    };
  },[reload]);
  return {turnos,error,reload};
}
export function toIsoDate(display:string) {
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [day,month,year]=display.split(' ');
  const m=months.indexOf(month)+1;
  return m&&day&&year?`${year}-${String(m).padStart(2,'0')}-${day.padStart(2,'0')}`:'';
}
export function esBano(nombre?:string|null) { const n=(nombre??'').trim().toLocaleLowerCase('es'); return n==='baño' || n==='bano'; }
export function slotAvailable(date:string,time:string,duration:number,turnos:Turno[],servicio?:string) {
  if(!date || !servicio?.trim() || !Number.isFinite(duration) || duration<=0)return false;
  const start=Number(time.slice(0,2))*60+Number(time.slice(3,5));
  return !turnos.some(t=>{
    const fechaGuardada=String(t.date).slice(0,10);
    if(t.status==='cancelado' || fechaGuardada!==date || esBano(t.service)!==esBano(servicio))return false;
    const other=Number(t.time.slice(0,2))*60+Number(t.time.slice(3,5));
    return start<other+Number(t.duration) && other<start+duration;
  });
}
