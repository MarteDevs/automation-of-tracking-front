import { defineStore } from 'pinia';
import api from '../api/axios';

// --- Interfaces TS ---
export interface ManoObra {
  id?: number;
  descripcion: string;
  cantidad_trabajadores: number;
  precio_unitario: number;
  total: number;
}

export interface MaterialEquipo {
  id?: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  total: number;
}

export interface AvanceSemanal {
  id?: number;
  semana: number;
  porcentaje_avance: number;
  observaciones?: string;
  rutas_fotografias?: string;
}

export interface Proyecto {
  id: number;
  nombre_proyecto: string;
  fecha: string;
  costo_total: number;
  utilidad_porcentaje: number;
  mano_de_obra: ManoObra[];
  materiales: MaterialEquipo[];
  avances: AvanceSemanal[];
}

export const useProyectosStore = defineStore('proyectos', {
  state: () => ({
    proyectos: [] as Proyecto[],
    proyectoActivo: null as Proyecto | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchProyectos() {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get<Proyecto[]>('/proyectos/');
        this.proyectos = response.data;
        return response.data;
      } catch (err: any) {
        this.error = err.response?.data?.detail || 'Error remoto al conectarse al Backend.';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async fetchProyectoActivo(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get<Proyecto>(`/proyectos/${id}`);
        this.proyectoActivo = response.data;
        return response.data;
      } catch (err: any) {
        this.error = 'No se pudo cargar el análisis completo de este proyecto.';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async procesarPresupuesto(file: File) {
      this.loading = true;
      this.error = null;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await api.post<Proyecto>('/procesar-presupuesto/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        this.proyectos.push(response.data);
        return response.data;
      } catch (err: any) {
        this.error = err.response?.data?.detail || 'Fallo contundente de compatibilidad de OpenAI / Conexion.';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async agregarAvance(proyectoId: number, avanceData: Omit<AvanceSemanal, 'id'>) {
      this.error = null;
      try {
        const response = await api.post<AvanceSemanal>(`/proyectos/${proyectoId}/avances/`, avanceData);
        if (this.proyectoActivo && this.proyectoActivo.id === proyectoId) {
            this.proyectoActivo.avances.push(response.data);
        }
        return response.data;
      } catch (err: any) {
         this.error = err.response?.data?.detail || 'Base de datos no pudo transaccionar tu avance.';
         throw err;
      }
    },
    async descargarReportePdf(proyectoId: number, avanceId: number) {
      try {
        const response = await api.get(`/proyectos/${proyectoId}/avances/${avanceId}/descargar-pdf`, {
          responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Avance_Reporte.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      } catch (err: any) {
        this.error = 'Falló la generación del PDF. Verifique que la IA y la Base de datos están conectadas.';
        throw err;
      }
    }
  }
});
