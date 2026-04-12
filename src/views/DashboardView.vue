<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useProyectosStore } from '@/stores/proyectos';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const store = useProyectosStore();

// --- Feedback Visual (Toasts) ---
type ToastType = 'success' | 'danger' | 'info';
interface Toast { id: number; message: string; type: ToastType; }
const toasts = ref<Toast[]>([]);
let toastCounter = 0;

const showToast = (message: string, type: ToastType = 'success') => {
  const id = ++toastCounter;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 3500);
};

// --- Lógica de PDF ---
const generandoPDF = ref(false);
const showPdfModal = ref(false);
const currentPdfUrl = ref('');
const pdfModalTitle = ref('');

const verBalanceGlobal = async (proyecto: any) => {
  generandoPDF.value = true;
  try {
    const blob = await store.fetchBalancePdfBlob(proyecto.id);
    if (currentPdfUrl.value) window.URL.revokeObjectURL(currentPdfUrl.value);
    currentPdfUrl.value = window.URL.createObjectURL(blob);
    
    pdfModalTitle.value = `Balance Global - ${proyecto.nombre_proyecto}`;
    showPdfModal.value = true;

    // Refrescar estado del botón descargar si era nuevo
    if (!proyecto.ruta_pdf) await store.fetchProyectos();
  } catch {
    showToast('Error al visualizar el Balance Global.', 'danger');
  } finally {
    generandoPDF.value = false;
  }
};

const descargarBalanceGlobal = async (proyecto: any) => {
  generandoPDF.value = true;
  try {
    await store.descargarBalanceGlobalPdf(proyecto.id);
    showToast('✔ Balance Global procesado correctamente.', 'success');
    await store.fetchProyectos();
  } catch {
    showToast('Error al generar el Balance Global.', 'danger');
  } finally {
    generandoPDF.value = false;
  }
};

const cerrarVisorPDF = () => {
  showPdfModal.value = false;
  if (currentPdfUrl.value) {
    window.URL.revokeObjectURL(currentPdfUrl.value);
    currentPdfUrl.value = '';
  }
};

// --- Auxiliares para el Template ---
const obtenerUltimoAvance = (proyecto: any) => {
  if (!proyecto.avances || proyecto.avances.length === 0) return null;
  // Ordenar por semana/día descendente y tomar el primero
  return [...proyecto.avances].sort((a, b) => b.semana - a.semana)[0];
};

const isProjectCompleted = (proyecto: any) => {
  if (!proyecto.avances || proyecto.avances.length === 0) return false;
  return Math.max(...proyecto.avances.map((a: any) => a.porcentaje_avance || 0)) >= 100;
};

const verUltimoReporteSemanal = async (proyecto: any) => {
  const ultimo = obtenerUltimoAvance(proyecto);
  if (!ultimo) return;
  
  generandoPDF.value = true;
  try {
    const blob = await store.fetchPdfBlob(proyecto.id, ultimo.id);
    if (currentPdfUrl.value) window.URL.revokeObjectURL(currentPdfUrl.value);
    currentPdfUrl.value = window.URL.createObjectURL(blob);
    
    pdfModalTitle.value = `Reporte ${ultimo.tipo_periodo === 'SEMANA' ? 'Semana' : 'Día'} ${ultimo.semana} - ${proyecto.nombre_proyecto}`;
    showPdfModal.value = true;

    if (!ultimo.ruta_pdf) await store.fetchProyectos();
  } catch {
    showToast('Error al visualizar el reporte semanal.', 'danger');
  } finally {
    generandoPDF.value = false;
  }
};

const descargarUltimoReporteSemanal = async (proyecto: any) => {
  const ultimo = obtenerUltimoAvance(proyecto);
  if (!ultimo) return;
  
  generandoPDF.value = true;
  try {
    await store.descargarReportePdf(proyecto.id, ultimo.id);
    showToast('✔ Reporte semanal procesado.', 'success');
    await store.fetchProyectos();
  } catch {
    showToast('Error al generar el reporte semanal.', 'danger');
  } finally {
    generandoPDF.value = false;
  }
};

// --- Lógica de Eliminación ---
const showConfirmModal = ref(false);
const pendingDeleteId = ref<number | null>(null);

const abrirModalEliminar = (id: number) => {
  pendingDeleteId.value = id;
  showConfirmModal.value = true;
};

const cerrarModal = () => {
  showConfirmModal.value = false;
  pendingDeleteId.value = null;
};

const confirmarEliminacion = async () => {
  if (pendingDeleteId.value === null) return;
  const id = pendingDeleteId.value;
  cerrarModal();
  
  try {
    await store.eliminarProyecto(id);
    showToast('✔ Proyecto eliminado correctamente.', 'success');
  } catch {
    showToast('Error al intentar eliminar el proyecto.', 'danger');
  }
};

onMounted(async () => {
  await store.fetchProyectos();
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
};

// ── FILTROS ──
const busquedaNombre = ref('');
const filtroMes = ref('');
const filtroAnio = ref('');
const ordenarPor = ref('reciente');

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Parsear fecha en formato dd/mm/yyyy o yyyy-mm-dd
const parseFecha = (fechaStr: string): Date | null => {
  if (!fechaStr) return null;
  const parts = fechaStr.split(/[-/]/);
  if (parts.length !== 3) return null;
  const p0 = parts[0]!, p1 = parts[1]!, p2 = parts[2]!;
  if (p0.length === 4) return new Date(Number(p0), Number(p1) - 1, Number(p2));
  return new Date(Number(p2), Number(p1) - 1, Number(p0));
};

// Años únicos disponibles (descendente)
const aniosDisponibles = computed(() => {
  const set = new Set<number>();
  store.proyectos.forEach(p => {
    const d = parseFecha(p.fecha);
    if (d) set.add(d.getFullYear());
  });
  return Array.from(set).sort((a, b) => b - a);
});

// Meses únicos disponibles para el año seleccionado (o todos)
const mesesDisponibles = computed(() => {
  const set = new Set<number>();
  store.proyectos.forEach(p => {
    const d = parseFecha(p.fecha);
    if (!d) return;
    if (filtroAnio.value && d.getFullYear() !== Number(filtroAnio.value)) return;
    set.add(d.getMonth());
  });
  return Array.from(set).sort((a, b) => a - b);
});

// Proyectos filtrados y ordenados
const proyectosFiltrados = computed(() => {
  let lista = [...store.proyectos];

  // Filtro nombre
  if (busquedaNombre.value.trim()) {
    const q = busquedaNombre.value.trim().toLowerCase();
    lista = lista.filter(p => p.nombre_proyecto.toLowerCase().includes(q));
  }

  // Filtro año
  if (filtroAnio.value) {
    lista = lista.filter(p => {
      const d = parseFecha(p.fecha);
      return d && d.getFullYear() === Number(filtroAnio.value);
    });
  }

  // Filtro mes
  if (filtroMes.value !== '') {
    lista = lista.filter(p => {
      const d = parseFecha(p.fecha);
      return d && d.getMonth() === Number(filtroMes.value);
    });
  }

  // Ordenar
  lista.sort((a, b) => {
    if (ordenarPor.value === 'reciente') {
      return (parseFecha(b.fecha)?.getTime() ?? 0) - (parseFecha(a.fecha)?.getTime() ?? 0);
    } else if (ordenarPor.value === 'antiguo') {
      return (parseFecha(a.fecha)?.getTime() ?? 0) - (parseFecha(b.fecha)?.getTime() ?? 0);
    } else if (ordenarPor.value === 'mayor_costo') {
      return b.costo_total - a.costo_total;
    } else if (ordenarPor.value === 'menor_costo') {
      return a.costo_total - b.costo_total;
    }
    return 0;
  });

  return lista;
});

const hayFiltrosActivos = computed(() =>
  busquedaNombre.value.trim() !== '' || filtroMes.value !== '' || filtroAnio.value !== ''
);

const limpiarFiltros = () => {
  busquedaNombre.value = '';
  filtroMes.value = '';
  filtroAnio.value = '';
  ordenarPor.value = 'reciente';
};

const exportarExcel = async () => {
  if (proyectosFiltrados.value.length === 0) {
    showToast('No hay proyectos para exportar.', 'info');
    return;
  }
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Resumen', {
    properties: { tabColor: { argb: 'FF0284C7' } }
  });

  // Título principal gigante
  worksheet.mergeCells('A1:L1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'REPORTE GERENCIAL DE PROYECTOS';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 35;

  // Fila de separación
  worksheet.addRow([]);

  // Configuración de anchos de columna (sin 'header' para que no sobrescriba la fila 1)
  worksheet.columns = [
    { key: 'id', width: 8 },
    { key: 'nombre', width: 45 },
    { key: 'fecha', width: 15 },
    { key: 'estado', width: 18 },
    { key: 'duracion', width: 15 },
    { key: 'mo', width: 26 },
    { key: 'mat', width: 30 },
    { key: 'cd', width: 20 },
    { key: 'ind', width: 25 },
    { key: 'sub', width: 20 },
    { key: 'igv', width: 18 },
    { key: 'total', width: 35 }
  ];

  // Aplicar estilos a la fila de cabeceras (Fila 3)
  const headerRow = worksheet.getRow(3);
  headerRow.values = [
    'ID', 'NOMBRE DEL PROYECTO', 'FECHA BASE', 'ESTADO', 'DURACIÓN',
    'TOTAL COSTOS FIJOS (S/)', 'TOTAL COSTOS VARIABLES (S/)', 'COSTO DIRECTO (S/)',
    'COSTOS INDIRECTOS (S/)', 'SUBTOTAL (S/)', 'IGV (18%)', 'PRESUPUESTO TOTAL DEL PROYECTO'
  ];
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 35;

  // Agregar datos
  proyectosFiltrados.value.forEach((p, index) => {
    const mano_obra = (p.mano_de_obra || []).reduce((acc: number, mo: any) => acc + (mo.total || 0), 0);
    const materiales = (p.materiales || []).reduce((acc: number, mat: any) => acc + (mat.total || 0), 0);
    
    // Cálculos financieros
    const costo_directo = mano_obra + materiales;
    const utilidad_moneda = costo_directo * 0.10;
    const otros_moneda = costo_directo * 0.05;
    const costos_indirectos = utilidad_moneda + otros_moneda;
    const subtotal = costo_directo + costos_indirectos;
    const igv = subtotal * 0.18;
    const presupuesto_total = subtotal + igv;
    
    // Encontrar si está completado usando tu función existente
    const estado = isProjectCompleted(p) ? 'COMPLETADO' : 'EN EJECUCIÓN';
    
    const row = worksheet.addRow({
      id: p.id,
      nombre: p.nombre_proyecto,
      fecha: p.fecha,
      estado: estado,
      duracion: p.semanas_estimadas ? `${p.semanas_estimadas} ${p.tipo_duracion || 'SEM.'}` : '-',
      mo: mano_obra,
      mat: materiales,
      cd: costo_directo,
      ind: costos_indirectos,
      sub: subtotal,
      igv: igv,
      total: presupuesto_total
    });

    row.font = { name: 'Arial', size: 10 };
    
    // Color de zebra filas pares
    if (index % 2 !== 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }

    // Alineamientos de las primeras columnas
    ['A', 'C', 'D', 'E'].forEach(col => {
        row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
    });
    row.getCell('B').alignment = { vertical: 'middle' };

    // Formato de Moneda para datos financieros
    ['F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(col => {
        const cell = row.getCell(col);
        cell.numFmt = '"S/"#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
    
    // Resaltar PRESUPUESTO TOTAL (La última columna)
    const totalCell = row.getCell('L');
    totalCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });

  // Pintar todos los bordes
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 3) {
      row.eachCell((cell) => {
        cell.border = {
          top: {style:'thin', color: {argb:'FFCBD5E1'}},
          left: {style:'thin', color: {argb:'FFCBD5E1'}},
          bottom: {style:'thin', color: {argb:'FFCBD5E1'}},
          right: {style:'thin', color: {argb:'FFCBD5E1'}}
        };
      });
    }
  });

  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  
  // Guardar y Descargar como Blob -> Archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Reporte_Proyectos_Resumen_${dateStr}.xlsx`);

  showToast('✔ Excel gerencial generado con formato moderno.', 'success');
};
</script>

<template>
  <!-- ===== VISOR DE PDF MODAL ===== -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="showPdfModal" class="custom-modal-overlay">
        <div class="glass-panel shadow-2xl d-flex flex-column" style="width: 95vw; height: 95vh; max-width: 1400px; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; overflow: hidden;">
          <!-- Header del Visor -->
          <div class="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary border-opacity-25 bg-dark bg-opacity-20">
            <h5 class="mb-0 fw-bold text-white d-flex align-items-center gap-2">
              <i class="bi bi-file-earmark-pdf text-danger fs-4"></i>
              {{ pdfModalTitle }}
            </h5>
            <button @click="cerrarVisorPDF" class="btn btn-link text-white p-0 text-decoration-none">
              <i class="bi bi-x-lg fs-4"></i>
            </button>
          </div>
          
          <!-- Cuerpo con el Iframe -->
          <div class="flex-grow-1 bg-white overflow-hidden" style="position: relative;">
            <iframe 
              v-if="currentPdfUrl"
              :src="currentPdfUrl" 
              class="w-100 h-100 border-0"
              title="Visor de PDF"
            ></iframe>
            <div v-else class="w-100 h-100 d-flex align-items-center justify-content-center bg-dark">
                <div class="spinner-border text-info" role="status"></div>
            </div>
          </div>
          
          <!-- Footer con instruccion -->
          <div class="p-2 text-center bg-dark bg-opacity-40 border-top border-secondary border-opacity-25">
            <small class="text-muted">Use los controles del visor para imprimir, descargar o ajustar el zoom.</small>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ===== OVERLAY GENERANDO PDF ===== -->
  <Teleport to="body">
    <div v-if="generandoPDF"
      style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
      <div class="spinner-border text-danger" style="width:3.5rem;height:3.5rem;" role="status"></div>
      <span class="fw-bold text-white fs-5">Generando Reporte PDF con IA...</span>
      <small class="text-muted">Esto puede tardar unos segundos, por favor espere.</small>
    </div>
  </Teleport>

  <!-- ===== TOASTS ===== -->
  <Teleport to="body">
    <div style="position:fixed;bottom:24px;right:24px;z-index:9998;display:flex;flex-direction:column;gap:10px;min-width:300px;">
      <transition-group name="toast-fade">
        <div v-for="t in toasts" :key="t.id"
          :class="`alert alert-${t.type} shadow-lg mb-0 d-flex align-items-center gap-2 py-2 px-3`"
          style="border-radius:10px;">
          <i :class="{
            'bi bi-check-circle-fill': t.type === 'success',
            'bi bi-exclamation-triangle-fill': t.type === 'danger',
            'bi bi-info-circle-fill': t.type === 'info'
          }"></i>
          <span class="small fw-medium">{{ t.message }}</span>
        </div>
      </transition-group>
    </div>
  </Teleport>

  <!-- ===== MODAL CONFIRMACIÓN ELIMINAR PROYECTO ===== -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="showConfirmModal" class="custom-modal-overlay">
        <div class="custom-modal-card glass-panel shadow-2xl">
          <div class="modal-icon-header">
            <div class="icon-circle bg-danger bg-opacity-20 text-danger">
              <i class="bi bi-trash3-fill fs-3"></i>
            </div>
          </div>
          
          <div class="modal-content-body text-center px-4">
            <h4 class="fw-bold text-white mb-2">¿Eliminar Proyecto?</h4>
            <p class="text-muted small mb-0">Esta acción es irreversible. Se eliminarán todos los avances, costos y datos relacionados con este proyecto.</p>
          </div>

          <div class="modal-footer-actions d-flex gap-2 p-4 mt-2">
            <button @click="cerrarModal" class="btn btn-secondary flex-fill fw-bold">
              Cancelar
            </button>
            <button @click="confirmarEliminacion" class="btn btn-danger flex-fill fw-bold shadow-lg">
              Sí, Eliminar Todo
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <div>
    <div class="d-flex justify-content-between align-items-center mb-4 mt-2 px-2">
      <h2 class="mb-0 fw-bold"><i class="bi bi-grid text-primary me-2"></i> Mis Proyectos</h2>
      <div class="d-flex gap-2">
        <button @click="exportarExcel" class="btn btn-outline-success bg-success bg-opacity-10 d-none d-md-flex align-items-center gap-2 fw-semibold px-3 shadow-sm transition-all border-success border-opacity-50">
          <i class="bi bi-file-earmark-excel-fill text-success"></i> Exportar
        </button>
        <RouterLink to="/upload" class="btn btn-primary d-none d-md-inline-block shadow-sm">
          <i class="bi bi-plus-lg me-1"></i> Control
        </RouterLink>
      </div>
    </div>

    <!-- ── BARRA DE FILTROS ── -->
    <div class="filter-bar glass-panel p-3 mb-4">
      <div class="row g-2 align-items-center">
        <!-- Búsqueda por nombre -->
        <div class="col-12 col-md-4">
          <div class="input-group input-group-sm">
            <span class="input-group-text bg-transparent border-secondary text-muted">
              <i class="bi bi-search"></i>
            </span>
            <input
              v-model="busquedaNombre"
              type="text"
              class="form-control form-control-sm filter-input"
              placeholder="Buscar por nombre..."
            />
          </div>
        </div>

        <!-- Filtro Año -->
        <div class="col-6 col-md-2">
          <select v-model="filtroAnio" class="form-select form-select-sm filter-input" @change="filtroMes = ''">
            <option value="">Todos los años</option>
            <option v-for="anio in aniosDisponibles" :key="anio" :value="String(anio)">{{ anio }}</option>
          </select>
        </div>

        <!-- Filtro Mes -->
        <div class="col-6 col-md-2">
          <select v-model="filtroMes" class="form-select form-select-sm filter-input">
            <option value="">Todos los meses</option>
            <option v-for="m in mesesDisponibles" :key="m" :value="String(m)">{{ MESES[m] }}</option>
          </select>
        </div>

        <!-- Ordenar -->
        <div class="col-8 col-md-3">
          <select v-model="ordenarPor" class="form-select form-select-sm filter-input">
            <option value="reciente">Más reciente primero</option>
            <option value="antiguo">Más antiguo primero</option>
            <option value="mayor_costo">Mayor costo</option>
            <option value="menor_costo">Menor costo</option>
          </select>
        </div>

        <!-- Limpiar filtros -->
        <div class="col-4 col-md-1 text-end">
          <button
            v-if="hayFiltrosActivos"
            @click="limpiarFiltros"
            class="btn btn-sm btn-outline-secondary w-100"
            title="Limpiar filtros"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <!-- Contador resultados -->
      <div class="mt-2 d-flex align-items-center gap-2">
        <span class="small text-muted">
          <i class="bi bi-funnel-fill text-primary me-1"></i>
          {{ proyectosFiltrados.length }} proyecto(s) encontrado(s)
        </span>
        <span v-if="hayFiltrosActivos" class="badge bg-primary bg-opacity-25 text-primary small">Filtros activos</span>
      </div>
    </div>

    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <div v-else-if="store.error" class="alert alert-danger glass-panel" role="alert">
      {{ store.error }}
    </div>

    <div v-else-if="store.proyectos.length === 0" class="text-center py-5 glass-panel h-100">
      <i class="bi bi-inbox fs-1 text-muted"></i>
      <h4 class="mt-3">No hay proyectos procesados aún</h4>
      <p class="text-muted">Despliega tu primer presupuesto PDF utilizando inteligencia artificial.</p>
    </div>

    <div v-else-if="proyectosFiltrados.length === 0" class="text-center py-5 glass-panel">
      <i class="bi bi-search fs-1 text-muted"></i>
      <h4 class="mt-3 text-muted">Sin resultados</h4>
      <p class="text-muted small">Ningún proyecto coincide con los filtros aplicados.</p>
      <button @click="limpiarFiltros" class="btn btn-sm btn-outline-primary mt-1">Limpiar filtros</button>
    </div>

    <div v-else class="row g-4">
      <div class="col-12 col-md-6 col-lg-4" v-for="proyecto in proyectosFiltrados" :key="proyecto.id">
        <div class="card glass-panel h-100 p-2 overflow-hidden position-relative border-top-0 border-start-0 border-end-0 border-bottom border-4 text-decoration-none"
             :class="isProjectCompleted(proyecto) ? 'border-success' : 'border-primary'">
          <div class="card-body">
            <div class="position-relative">
              <button @click.prevent="abrirModalEliminar(proyecto.id)" class="btn btn-link text-danger p-0 border-0 text-decoration-none opacity-50 hover-opacity-100 position-absolute top-0 end-0" title="Eliminar Proyecto">
                <i class="bi bi-trash3 fs-5"></i>
              </button>
              <h5 class="card-title fw-bold pe-4 mb-2" style="line-height:1.35; word-break:break-word;">
                {{ proyecto.nombre_proyecto }}
              </h5>
              <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                <p class="text-muted small mb-0"><i class="bi bi-calendar3"></i> {{ proyecto.fecha }}</p>
                <div v-if="isProjectCompleted(proyecto)" class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 px-2 py-1 shadow-sm d-flex align-items-center gap-1">
                  <i class="bi bi-check-circle-fill"></i> COMPLETADO
                </div>
              </div>
            </div>
            
            <div class="d-flex justify-content-between mt-3 px-1">
              <div v-if="obtenerUltimoAvance(proyecto)" class="d-flex flex-column gap-1">
                <span class="text-muted" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px;">Último Avance ({{ obtenerUltimoAvance(proyecto).semana }})</span>
                <button @click.prevent="verUltimoReporteSemanal(proyecto)" 
                  class="btn btn-sm d-flex align-items-center gap-2 px-3 rounded-pill transition-all" 
                  :class="obtenerUltimoAvance(proyecto).ruta_pdf ? 'btn-outline-warning' : 'btn-outline-secondary opacity-50'"
                  title="Ver Último Reporte Semanal" :disabled="generandoPDF">
                  <i class="bi bi-eye-fill"></i>
                  <span style="font-size: 0.75rem;">Ver Reporte</span>
                </button>
              </div>
              <div v-else class="text-muted small">Sin reportes aún</div>

              <div class="d-flex flex-column gap-1 align-items-end" v-if="false">
                <span class="text-muted" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px;">Balance Global</span>
                <button @click.prevent="verBalanceGlobal(proyecto)" 
                  class="btn btn-sm d-flex align-items-center gap-2 px-3 rounded-pill transition-all" 
                  :class="proyecto.ruta_pdf ? 'btn-outline-info' : 'btn-outline-secondary opacity-50'"
                  title="Previsualizar Balance" :disabled="generandoPDF">
                  <i class="bi bi-eye-fill"></i>
                  <span style="font-size: 0.75rem;">Ver Balance</span>
                </button>
              </div>
            </div>
          </div>
          <div class="card-footer bg-transparent border-0 pt-0 text-end pb-3">
            <RouterLink :to="`/proyectos/${proyecto.id}`" class="btn btn-sm btn-outline-light rounded-pill px-4">
              Ir al Proyecto <i class="bi bi-arrow-right-short"></i>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Filter Bar ── */
.filter-bar {
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
}

.filter-input {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: #e2e8f0 !important;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.filter-input:focus {
  border-color: rgba(59, 130, 246, 0.5) !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12) !important;
  background: rgba(255, 255, 255, 0.08) !important;
}
.filter-input option {
  background: #1e293b;
  color: #e2e8f0;
}
.input-group-text {
  border-color: rgba(255, 255, 255, 0.12) !important;
  border-right: none !important;
}
.filter-input.form-control {
  border-left: none !important;
}

/* ── Toast animations ── */
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.35s ease;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

/* ── Custom Modal Styles ── */
.custom-modal-overlay {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.custom-modal-card {
  width: 100%; max-width: 400px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px; overflow: hidden;
  animation: modal-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes modal-pop {
  from { transform: scale(0.9) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
.modal-icon-header {
  display: flex; justify-content: center; padding-top: 30px; padding-bottom: 20px;
}
.icon-circle {
  width: 65px; height: 65px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(220, 53, 69, 0.2);
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.hover-opacity-100:hover {
  opacity: 1 !important;
}
</style>
