import { defineStore } from 'pinia';
import api from '../api/axios';

// --- Interfaces TS ---
export interface ManoObra {
  id?: number;
  categoria?: string;
  descripcion: string;
  unidad?: string;
  cantidad_trabajadores: number;
  precio_unitario: number;
  dias?: number;
  total: number;
}

export interface MaterialEquipo {
  id?: number;
  categoria?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario?: number;
  dias?: number;
  total: number;
}

export interface ConsumoMaterial {
  id?: number;
  avance_id?: number;
  nombre_material: string;
  cantidad_usada: number;
  unidad?: string;
}

export interface AvanceSemanal {
  id?: number;
  semana: number;
  porcentaje_avance: number;
  observaciones?: string;
  rutas_fotografias?: string;
  tipo_periodo: string; // 'SEMANA' | 'DIA'
  fecha_fin?: string;
  dias_trabajados?: number;
  consumos_materiales?: ConsumoMaterial[];
  consumos?: ConsumoMaterial[];
  ruta_pdf?: string;
}

export interface Proyecto {
  id: number;
  nombre_proyecto: string;
  fecha: string;
  costo_total: number;
  utilidad_porcentaje: number;
  otros_porcentaje: number;
  semanas_estimadas: number; // NUEVO
  tipo_duracion: string; // 'SEMANAS' | 'DIAS'
  mano_de_obra: ManoObra[];
  materiales: MaterialEquipo[];
  avances: AvanceSemanal[];
  ruta_pdf?: string;
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
          timeout: 180000, 
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
        const blob = await this.fetchPdfBlob(proyectoId, avanceId);
        
        // Generar nombre dinámico basado en el proyecto activo
        let filename = 'Reporte_Avance.pdf';
        if (this.proyectoActivo) {
          const nomLimpio = this.proyectoActivo.nombre_proyecto.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
          const avance = this.proyectoActivo.avances.find(a => a.id === avanceId);
          const label = (avance?.tipo_periodo === 'SEMANA') ? 'Semana' : 'Dia';
          const num = avance?.semana || 'X';
          filename = `${nomLimpio}_${label}_${num}.pdf`;
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        // Sugerencia: no revocar inmediatamente si quieres que se vea, 
        // pero para descarga directa está bien así.
      } catch (err: any) {
        this.error = 'Falló la generación del PDF. Verifique que la IA y la Base de datos están conectadas.';
        throw err;
      }
    },
    async fetchPdfBlob(proyectoId: number, avanceId: number): Promise<Blob> {
      const response = await api.get(`/proyectos/${proyectoId}/avances/${avanceId}/descargar-pdf`, {
        responseType: 'blob'
      });
      return new Blob([response.data], { type: 'application/pdf' });
    },
    async descargarBalanceGlobalPdf(proyectoId: number) {
      this.error = null;
      try {
        const blob = await this.fetchBalancePdfBlob(proyectoId);
        const nomLimpio = this.proyectoActivo?.nombre_proyecto.replace(/[^A-Za-z0-9_-]/g, "_") || 'Proyecto';
        const filename = `Balance_Global_${nomLimpio}.pdf`;

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      } catch (err: any) {
        this.error = 'Falló la descarga del Balance Global.';
        throw err;
      }
    },
    async fetchBalancePdfBlob(proyectoId: number): Promise<Blob> {
        const response = await api.get(`/proyectos/${proyectoId}/balance-pdf`, { responseType: 'blob' });
        return new Blob([response.data], { type: 'application/pdf' });
    },
    async uploadImagenEvidencia(files: File[]) {
      this.error = null;
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      try {
        const response = await api.post('/upload-imagen/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.ruta_fotografias;
      } catch (err: any) {
         this.error = err.response?.data?.detail || 'Fallo de acceso al directorio en el servidor para almacenar foto.';
         throw err;
      }
    },
    async actualizarConfiguracion(proyectoId: number, semanas: number, tipo_duracion: string, fecha: string) {
      if (semanas < 1) return;
      try {
        const response = await api.put<Proyecto>(`/proyectos/${proyectoId}/configuracion`, {
          semanas_estimadas: semanas,
          tipo_duracion: tipo_duracion,
          fecha: fecha
        });
        if (this.proyectoActivo && this.proyectoActivo.id === proyectoId) {
          this.proyectoActivo.semanas_estimadas = response.data.semanas_estimadas;
          this.proyectoActivo.tipo_duracion = response.data.tipo_duracion;
          this.proyectoActivo.fecha = response.data.fecha;
        }
        return response.data;
      } catch (err: any) {
        this.error = 'No se pudo guardar la configuración de Semanas.';
        throw err;
      }
    },
    async eliminarAvance(proyectoId: number, avanceId: number) {
      try {
        await api.delete(`/proyectos/${proyectoId}/avances/${avanceId}`);
        if (this.proyectoActivo && this.proyectoActivo.id === proyectoId) {
          this.proyectoActivo.avances = this.proyectoActivo.avances.filter(a => a.id !== avanceId);
        }
      } catch (err: any) {
        this.error = 'No se pudo eliminar el registro de seguimiento seleccionado.';
        throw err;
      }
    },
    async eliminarProyecto(id: number) {
      try {
        await api.delete(`/proyectos/${id}`);
        this.proyectos = this.proyectos.filter(p => p.id !== id);
      } catch (err: any) {
        this.error = 'No se pudo eliminar el proyecto solicitado.';
        throw err;
      }
    }
  }
});
