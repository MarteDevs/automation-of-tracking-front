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
  rutas_facturas?: string;
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
  ruta_foto_final?: string;
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
    async fetchPdfBlob(proyectoId: number, avanceId: number, regenerar: boolean = false): Promise<Blob> {
      // Usamos fetch() nativo en lugar de Axios/XHR para manejar
      // respuestas binarias grandes (>5MB) sin problemas de buffering
      const baseUrl = `/api/v1/proyectos/${proyectoId}/avances/${avanceId}/descargar-pdf`;
      const url = regenerar ? `${baseUrl}?regenerar=true` : baseUrl;
      console.log(`[DEBUG PDF] Solicitando BLOB via fetch() nativo: ${url}`);

      const token = localStorage.getItem('token');
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/pdf'
          }
        });
      } catch (networkErr: any) {
        console.error(`[DEBUG PDF ERROR] Error de red al conectar:`, networkErr);
        throw networkErr;
      }

      console.log(`[DEBUG PDF] HTTP Status: ${response.status} | Content-Type: ${response.headers.get('content-type')} | Content-Length: ${response.headers.get('content-length')}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEBUG PDF ERROR] Servidor respondió ${response.status}:`, errorText);
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      console.log(`[DEBUG PDF] ✅ Blob recibido correctamente: ${blob.size} bytes, tipo: ${blob.type}`);

      if (blob.size === 0) {
        console.error(`[DEBUG PDF ERROR] El blob está vacío (0 bytes)`);
        throw new Error('El servidor devolvió un PDF vacío.');
      }

      return new Blob([blob], { type: 'application/pdf' });
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
      // Usamos fetch() nativo para evitar problemas de buffering con archivos grandes
      const url = `/api/v1/proyectos/${proyectoId}/balance-pdf`;
      console.log(`[DEBUG PDF] Solicitando Balance BLOB via fetch() nativo: ${url}`);

      const token = localStorage.getItem('token');
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/pdf'
          }
        });
      } catch (networkErr: any) {
        console.error(`[DEBUG BALANCE PDF ERROR] Error de red:`, networkErr);
        throw networkErr;
      }

      console.log(`[DEBUG PDF] Balance HTTP Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      console.log(`[DEBUG PDF] ✅ Balance Blob recibido: ${blob.size} bytes`);
      return new Blob([blob], { type: 'application/pdf' });
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
    async subirFotoFinal(proyecto_id: number, rutaNueva: string) {
      if (!proyecto_id || !rutaNueva) return;
      this.error = null;
      try {
        // Concatenar con lo que ya existe
        const actual = this.proyectoActivo?.ruta_foto_final || '';
        const lista = actual ? actual.split(',').filter(x => x) : [];
        lista.push(rutaNueva);
        const rutaFinalConcatenada = lista.join(',');

        const response = await api.put<Proyecto>(`/proyectos/${proyecto_id}/foto-final`, {
          ruta_foto: rutaFinalConcatenada
        });
        if (this.proyectoActivo && this.proyectoActivo.id === proyecto_id) {
          this.proyectoActivo.ruta_foto_final = response.data.ruta_foto_final;
          this.proyectoActivo.ruta_pdf = undefined;
        }
        return response.data;
      } catch (err: any) {
        this.error = 'No se pudo actualizar la Fotografía Final del Proyecto.';
        throw err;
      }
    },
    async eliminarFotoFinal(proyecto_id: number, rutaAEliminar: string) {
      if (!proyecto_id) return;
      this.error = null;
      try {
        const actual = this.proyectoActivo?.ruta_foto_final || '';
        const lista = actual.split(',').filter(x => x && x !== rutaAEliminar);
        const nuevaRuta = lista.join(',');

        const response = await api.put<Proyecto>(`/proyectos/${proyecto_id}/foto-final`, {
          ruta_foto: nuevaRuta
        });
        if (this.proyectoActivo && this.proyectoActivo.id === proyecto_id) {
          this.proyectoActivo.ruta_foto_final = response.data.ruta_foto_final;
          this.proyectoActivo.ruta_pdf = undefined;
        }
        return response.data;
      } catch (err: any) {
        this.error = 'No se pudo eliminar la imagen de cierre.';
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
