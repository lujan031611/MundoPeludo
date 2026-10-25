import { useEffect,useState } from "react";
export interface Producto {id:number;name:string;price:number;stock:number;category:string;description:string;imageUrl?:string}
export function useProductos(){
  const [products,setProducts]=useState<Producto[]>([]);
  const [error,setError]=useState('');
  const reload=async()=>{
    const response=await fetch('http://localhost:3000/api/productos');
    if(!response.ok)throw new Error('No se pudieron cargar productos');
    setProducts(await response.json());setError('');
  };
  useEffect(()=>{reload().catch(e=>setError(e.message));},[]);
  return {products,error,reload};
}
