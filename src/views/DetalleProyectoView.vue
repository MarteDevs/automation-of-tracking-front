<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useProyectosStore } from '@/stores/proyectos';

const route = useRoute();
const store = useProyectosStore();

const nuevoAvance = ref({
  semana: 1,
  porcentaje_avance: 10,
  observaciones: '',
  rutas_fotografias: '',
  tipo_periodo: 'SEMANA' as 'SEMANA' | 'DIA',
  fecha_fin: '',
  dias_trabajados: 0
});

// Etiqueta dinámica según tipo
const labelPeriodo = computed(() => nuevoAvance.value.tipo_periodo === 'DIA' ? 'Día' : 'Semana');
const labelNPeriodo = computed(() => nuevoAvance.value.tipo_periodo === 'DIA' ? 'N° Día' : 'N° Semana');

const evidenciaFiles = ref<File[]>([]);

// --- Estados para feedback visual ---
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

const generandoPDF = ref(false);

// Refs para navegación con Enter
const inputSemana = ref<HTMLInputElement | null>(null);
const inputAvance = ref<HTMLInputElement | null>(null);
const inputFecha = ref<HTMLInputElement | null>(null);
const inputDias = ref<HTMLInputElement | null>(null);
const inputObs = ref<HTMLTextAreaElement | null>(null);
const fotoInput = ref<HTMLInputElement | null>(null);
const submitBtn = ref<HTMLButtonElement | null>(null);

const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const arr = Array.from(target.files);

    const tooBig = arr.filter(f => f.size > 5 * 1024 * 1024);
    if (tooBig.length > 0) {
      showToast(`Se omitieron ${tooBig.length} imágenes por superar 5MB.`, 'danger');
    }

    const validFiles = arr.filter(f => f.size <= 5 * 1024 * 1024);

    if (validFiles.length > 4) {
      showToast('Máximo 4 fotos. Se tomaron las primeras 4 válidas.', 'info');
      evidenciaFiles.value = validFiles.slice(0, 4);
    } else {
      evidenciaFiles.value = validFiles;
      if (validFiles.length > 0) {
        showToast(`${validFiles.length} imagen(es) seleccionada(s) y lista(s) para subir.`, 'info');
      }
    }
  } else {
    evidenciaFiles.value = [];
  }
};

const editSemanasVal = ref(1);
const editUnidadVal = ref('SEMANAS');
const editFechaVal = ref('');

const checkValidDateStr = (dateStr: string) => {
  if (!dateStr) return null;
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const p0 = parts[0] as string;
    const p1 = parts[1] as string;
    const p2 = parts[2] as string;
    let year = Number(p2);
    let month = Number(p1) - 1;
    let day = Number(p0);
    if (p0.length === 4) {
      year = Number(p0);
      day = Number(p2);
    }
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

const toLocalYYYYMMDD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

const computedFechaFinProyecto = computed(() => {
  const d = checkValidDateStr(store.proyectoActivo?.fecha || '');
  if (!d) return '---';
  const offset = editUnidadVal.value === 'DIAS' ? editSemanasVal.value : editSemanasVal.value * 7;
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
});

const computedDiasProyecto = computed(() => {
   return editUnidadVal.value === 'DIAS' ? editSemanasVal.value : editSemanasVal.value * 8;
});

const calcularAvanceAutomatico = () => {
    const d = checkValidDateStr(store.proyectoActivo?.fecha || '');
    if(!d) return;

    if (nuevoAvance.value.tipo_periodo === 'SEMANA') {
        const span = nuevoAvance.value.semana * 8;
        d.setDate(d.getDate() + span);
        nuevoAvance.value.fecha_fin = toLocalYYYYMMDD(d);
        nuevoAvance.value.dias_trabajados = nuevoAvance.value.semana * 8; // Días acumulados sugeridos
    } else {
        d.setDate(d.getDate() + Number(nuevoAvance.value.semana)); 
        nuevoAvance.value.fecha_fin = toLocalYYYYMMDD(d);
        nuevoAvance.value.dias_trabajados = nuevoAvance.value.semana; // Días acumulados sugeridos
    }
}

watch(() => nuevoAvance.value.semana, calcularAvanceAutomatico);
watch(() => nuevoAvance.value.tipo_periodo, calcularAvanceAutomatico, { immediate: true });

onMounted(async () => {
  const pId = Number(route.params.id);
  if (pId) {
    await store.fetchProyectoActivo(pId);
    if (store.proyectoActivo) {
      editSemanasVal.value = store.proyectoActivo.semanas_estimadas || 1;
      editUnidadVal.value = store.proyectoActivo.tipo_duracion || 'SEMANAS';
      
      // Convertir fecha BD (DD/MM/YYYY) a ISO (YYYY-MM-DD) para el input date
      const d = checkValidDateStr(store.proyectoActivo.fecha);
      if (d) editFechaVal.value = toLocalYYYYMMDD(d);
      
      calcularAvanceAutomatico();
    }
  }
});

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);
};

const totalManoObra = computed(() =>
  (store.proyectoActivo?.mano_de_obra ?? []).reduce((acc, mo) => acc + mo.total, 0)
);

const totalMateriales = computed(() =>
  (store.proyectoActivo?.materiales ?? []).reduce((acc, mat) => acc + mat.total, 0)
);

const totalGeneral = computed(() => totalManoObra.value + totalMateriales.value);

// Nuevos cálculos para el resumen financiero "Image 1"
// Forzado por regla de negocio a 15% Utilidad y 5% Otros para empatar con PDF original
const utilidadPorc = computed(() => 0.15);
const otrosPorc = computed(() => 0.05);

const utilidadMoneda = computed(() => totalGeneral.value * utilidadPorc.value);
const otrosMoneda = computed(() => totalGeneral.value * otrosPorc.value);
const costosIndirectosNum = computed(() => utilidadMoneda.value + otrosMoneda.value);
const subtotalConIndirectos = computed(() => totalGeneral.value + costosIndirectosNum.value);
const igvCalculado = computed(() => subtotalConIndirectos.value * 0.18);
const presupuestoTotalFinal = computed(() => subtotalConIndirectos.value + igvCalculado.value);

const guardarAvance = async () => {
  if (store.loading) return;
  const pId = Number(route.params.id);

  if (evidenciaFiles.value.length > 0) {
    showToast('Subiendo imágenes al servidor...', 'info');
    const rutaOficialServidor = await store.uploadImagenEvidencia(evidenciaFiles.value);
    nuevoAvance.value.rutas_fotografias = rutaOficialServidor;
    showToast(`✔ ${evidenciaFiles.value.length} imagen(es) guardada(s) correctamente.`, 'success');
  }

  await store.agregarAvance(pId, nuevoAvance.value);
  showToast(`✔ Reporte de ${labelPeriodo.value} ${nuevoAvance.value.semana} registrado con éxito.`, 'success');

  // Limpieza Form: avanza al siguiente período
  nuevoAvance.value = {
    semana: nuevoAvance.value.semana + 1,
    porcentaje_avance: Math.min(100, nuevoAvance.value.porcentaje_avance + 10),
    observaciones: '',
    rutas_fotografias: '',
    tipo_periodo: nuevoAvance.value.tipo_periodo, // Mantener el tipo elegido
    fecha_fin: '',
    dias_trabajados: 0
  };
  evidenciaFiles.value = [];
  const inputEl = document.getElementById('fotoInput') as HTMLInputElement;
  if (inputEl) inputEl.value = '';
};

const guardarSemanasEstimadas = async () => {
  const pId = Number(route.params.id);
  if (pId && editSemanasVal.value >= 1) {
    // Convertir de YYYY-MM-DD a DD/MM/YYYY para la BD
    const d = new Date(editFechaVal.value + 'T12:00:00'); // T12 para evitar temas de zona horaria
    const fechaBD = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    await store.actualizarConfiguracion(pId, editSemanasVal.value, editUnidadVal.value, fechaBD);
    showToast(`✔ Configuración guardada correctamente.`, 'success');
  }
};

const descargarPDF = async (avanceId: number) => {
  const pId = Number(route.params.id);
  if (!pId || !avanceId) return;
  generandoPDF.value = true;
  try {
    await store.descargarReportePdf(pId, avanceId);
    showToast('✔ Reporte PDF generado y descargado.', 'success');
  } catch {
    showToast('Error al generar el PDF.', 'danger');
  } finally {
    generandoPDF.value = false;
  }
};
// ── Tab activo controlado por Vue (con feedback visual animado) ──
const activeTab = ref<'rrhh' | 'mats' | 'avance'>('rrhh');

// --- Lógica de Eliminación con Modal Personalizado ---
const showConfirmModal = ref(false);
const pendingDeleteId = ref<number | null>(null);

const eliminarAvance = (avId: number) => {
  pendingDeleteId.value = avId;
  showConfirmModal.value = true;
};

const cerrarConfirmacion = () => {
  showConfirmModal.value = false;
  pendingDeleteId.value = null;
};

const ejecutarEliminacion = async () => {
  if (pendingDeleteId.value === null) return;
  
  const avId = pendingDeleteId.value;
  const pId = Number(route.params.id);
  
  cerrarConfirmacion(); // Cerramos el modal inmediatamente para feedback fluido
  
  try {
    await store.eliminarAvance(pId, avId);
    showToast('✔ Registro de seguimiento eliminado.', 'info');
  } catch {
    showToast('Error al intentar eliminar el registro.', 'danger');
  }
};
</script>

<template>
  <!-- ===== OVERLAY CONFIRMACIÓN ELIMINAR ===== -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="showConfirmModal" class="custom-modal-overlay">
        <div class="custom-modal-card glass-panel shadow-2xl">
          <div class="modal-icon-header">
            <div class="icon-circle bg-danger bg-opacity-20 text-danger">
              <i class="bi bi-exclamation-triangle-fill fs-3"></i>
            </div>
          </div>
          
          <div class="modal-content-body text-center px-4">
            <h4 class="fw-bold text-white mb-2">¿Eliminar registro?</h4>
            <p class="text-muted small mb-0">Esta acción eliminará permanentemente este reporte de seguimiento y sus datos asociados. No se puede deshacer.</p>
          </div>

          <div class="modal-footer-actions d-flex gap-2 p-4 mt-2">
            <button @click="cerrarConfirmacion" class="btn btn-secondary flex-fill fw-bold">
              Cancelar
            </button>
            <button @click="ejecutarEliminacion" class="btn btn-danger flex-fill fw-bold shadow-lg">
              Sí, Eliminar
            </button>
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
          style="border-radius:10px;animation:none;">
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

  <!-- ===== CONTENIDO PRINCIPAL ===== -->
  <div v-if="store.loading && !store.proyectoActivo" class="text-center py-5">
    <div class="spinner-border text-primary" role="status"></div>
  </div>

  <div v-else-if="store.proyectoActivo" class="glass-panel p-4 pb-5">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1 class="fw-bold mb-1">{{ store.proyectoActivo.nombre_proyecto }}</h1>
        <p class="text-muted"><i class="bi bi-calendar3"></i> Fecha Presupuestada: {{ store.proyectoActivo.fecha }}</p>
      </div>
      <div class="text-end glass-panel px-4 py-2 bg-primary bg-opacity-10 border-primary">
        <span class="d-block small text-muted">Costo Directo Total</span>
        <h3 class="mb-0 fw-bold text-primary">{{ formatCurrency(store.proyectoActivo.costo_total) }}</h3>
      </div>
    </div>

    <!-- ── Tabs Nav Vue ── -->
    <div class="vue-tabs mb-4">
      <button
        class="vue-tab-btn"
        :class="{ active: activeTab === 'rrhh' }"
        @click="activeTab = 'rrhh'"
      >
        <i class="bi bi-building"></i>
        Costos Fijos
        <span class="tab-badge">{{ store.proyectoActivo.mano_de_obra.length }}</span>
      </button>
      <button
        class="vue-tab-btn"
        :class="{ active: activeTab === 'mats' }"
        @click="activeTab = 'mats'"
      >
        <i class="bi bi-boxes"></i>
        Costos Variables
        <span class="tab-badge">{{ store.proyectoActivo.materiales.length }}</span>
      </button>
      <button
        class="vue-tab-btn"
        :class="{ active: activeTab === 'avance' }"
        @click="activeTab = 'avance'"
      >
        <i class="bi bi-bar-chart-line-fill"></i>
        Control de Avance
        <span class="tab-badge" :class="{ 'tab-badge-info': store.proyectoActivo.avances.length > 0 }">
          {{ store.proyectoActivo.avances.length }}
        </span>
      </button>
    </div>

    <!-- ── Tab Content con transiciones ── -->
    <div class="tab-content-wrapper">

      <!-- RRHH -->
      <Transition name="tab-slide">
      <div v-if="activeTab === 'rrhh'" class="tab-section">
        <div class="table-responsive glass-panel p-2">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Descripción / Rubro</th>
                <th>Und.</th>
                <th>Cant.</th>
                <th>P.Unit</th>
                <th>Días</th>
                <th>Costo Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="mo in store.proyectoActivo.mano_de_obra" :key="mo.id">
                <td><span class="badge bg-secondary">{{ mo.categoria || 'Mano de Obra' }}</span></td>
                <td class="fw-medium">{{ mo.descripcion }}</td>
                <td>{{ mo.unidad || '-' }}</td>
                <td>{{ mo.cantidad_trabajadores }}</td>
                <td>{{ formatCurrency(mo.precio_unitario) }}</td>
                <td>{{ mo.dias || '1' }}</td>
                <td class="text-success fw-bold">{{ formatCurrency(mo.total) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-top border-secondary">
                <td colspan="6" class="fw-bold text-end text-muted">Subtotal Costos Fijos:</td>
                <td class="fw-bold text-warning fs-6">{{ formatCurrency(totalManoObra) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      </Transition>

      <!-- MATERIALES -->
      <Transition name="tab-slide">
      <div v-if="activeTab === 'mats'" class="tab-section">
        <div class="table-responsive glass-panel p-2">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Insumo / Descripción</th>
                <th>Und.</th>
                <th>Cant.</th>
                <th>P.Unit</th>
                <th>Días</th>
                <th>Costo Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="mat in store.proyectoActivo.materiales" :key="mat.id">
                <td><span class="badge bg-info text-dark">{{ mat.categoria || 'Materiales' }}</span></td>
                <td class="fw-medium">{{ mat.descripcion }}</td>
                <td>{{ mat.unidad || '-' }}</td>
                <td>{{ mat.cantidad }}</td>
                <td>{{ formatCurrency(mat.precio_unitario || 0) }}</td>
                <td>{{ mat.dias || '1' }}</td>
                <td class="text-success fw-bold">{{ formatCurrency(mat.total) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-top border-secondary">
                <td colspan="6" class="fw-bold text-end text-muted">Subtotal Costos Variables:</td>
                <td class="fw-bold text-warning fs-6">{{ formatCurrency(totalMateriales) }}</td>
              </tr>
            </tfoot>
          </table>

          <!-- TOTAL GENERAL DETALLADO (Estilo Imagen 1) -->
          <div class="d-flex justify-content-end mt-4">
            <div class="glass-panel p-0 border-primary overflow-hidden" style="min-width: 400px; border-width: 1px;">
              <table class="table table-sm table-borderless mb-0 text-white">
                <tbody>
                  <tr class="border-bottom border-secondary border-opacity-25">
                    <td class="p-3 fw-bold bg-dark bg-opacity-25">COSTO DIRECTO</td>
                    <td class="p-3 text-end fw-bold">{{ formatCurrency(totalGeneral) }}</td>
                  </tr>
                  <tr class="border-bottom border-secondary border-opacity-25">
                    <td class="p-3">COSTOS INDIRECTOS</td>
                    <td class="p-3 text-end">{{ formatCurrency(costosIndirectosNum) }}</td>
                  </tr>
                  <tr class="border-bottom border-primary border-opacity-50">
                    <td class="p-3 fw-bold bg-dark bg-opacity-25">SUBTOTAL</td>
                    <td class="p-3 text-end fw-bold">{{ formatCurrency(subtotalConIndirectos) }}</td>
                  </tr>
                  <tr class="border-bottom border-secondary border-opacity-25">
                    <td class="p-3">IGV (18%)</td>
                    <td class="p-3 text-end">{{ formatCurrency(igvCalculado) }}</td>
                  </tr>
                  <tr class="bg-primary bg-opacity-20">
                    <td class="p-3 fw-bold fs-5 text-primary">PRESUPUESTO TOTAL</td>
                    <td class="p-3 text-end fw-bold fs-5 text-primary">{{ formatCurrency(presupuestoTotalFinal) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </Transition>

      <!-- AVANCES SEMANALES -->
      <Transition name="tab-slide">
      <div v-if="activeTab === 'avance'" class="tab-section">
        <div class="row">
          <div class="col-md-8">
            <div class="glass-panel p-3 mb-4 rounded border-start border-3 border-info d-flex flex-column flex-md-row align-items-md-center justify-content-between">
              <div>
                <h6 class="mb-1 text-info fw-bold"><i class="bi bi-graph-up-arrow me-1"></i> Configuración de Curva S</h6>
                <p class="mb-0 small text-muted">Duración programada total para calcular la curva logística matemática y su asimetría.</p>
                <div class="mt-2 text-muted small d-flex flex-wrap align-items-center gap-2">
                  <span><i class="bi bi-calendar-check text-info"></i> Inicio:</span>
                  <input type="date" v-model="editFechaVal" class="form-control form-control-sm border-info bg-dark text-white p-0 px-1" style="width: 130px; height: 26px; font-size: 0.8rem;">
                  <span class="mx-1">|</span>
                  <span>Fin Estimado: <strong class="text-white">{{ computedFechaFinProyecto }}</strong></span>
                  <span class="mx-2">|</span>
                  <span>Tot. Jornadas: <strong class="text-white">{{ computedDiasProyecto }}</strong></span>
                </div>
              </div>
              <div class="d-flex align-items-center mt-3 mt-md-0 gap-2 ms-md-4">
                <input type="number" class="form-control form-control-sm text-center" style="width: 70px;" v-model="editSemanasVal" min="1">
                <select v-model="editUnidadVal" class="form-select form-select-sm" style="width: 100px;">
                   <option value="SEMANAS">Semanas</option>
                   <option value="DIAS">Días</option>
                </select>
                <button class="btn btn-sm btn-info text-dark fw-bold" @click="guardarSemanasEstimadas">
                  <i class="bi bi-floppy me-1"></i> Guardar
                </button>
              </div>
            </div>

            <h5 class="mb-3">Historial de Avance Real</h5>
            <div v-if="store.proyectoActivo.avances.length === 0" class="alert alert-secondary glass-panel">Sin avances registrados actualmente.</div>

            <div v-for="av in store.proyectoActivo.avances" :key="av.id" class="card mb-3 glass-panel border-start border-4"
              :class="av.tipo_periodo === 'DIA' ? 'border-warning' : 'border-info'">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <h6 class="fw-bold mb-0">
                    <span class="badge me-2" :class="av.tipo_periodo === 'DIA' ? 'bg-warning text-dark' : 'bg-info text-dark'">
                      {{ av.tipo_periodo === 'DIA' ? 'DÍA' : 'SEMANA' }}
                    </span>
                    Reporte {{ av.tipo_periodo === 'DIA' ? 'Día' : 'Semana' }} {{ av.semana }}
                  </h6>
                  <span class="badge bg-success fw-bold">{{ av.porcentaje_avance }}% Completado</span>
                </div>
                <p class="mb-1 mt-2 text-muted small">
                  <strong>Fecha del Avance:</strong> {{ av.fecha_fin || 'No registrada' }} <span class="mx-2 text-secondary">|</span> 
                  <strong>Días Trabajados:</strong> {{ av.dias_trabajados || '0' }}
                </p>
                <p class="mb-1 mt-2 text-muted small">{{ av.observaciones || "Sin observaciones." }}</p>
                <div v-if="av.rutas_fotografias" class="mt-2 text-success small">
                  <i class="bi bi-image-fill me-1"></i>
                  {{ av.rutas_fotografias.split(',').length }} fotografía(s) adjuntada(s)
                </div>

                <div class="mt-3 d-flex justify-content-end align-items-center gap-2 border-top border-secondary pt-2">
                  <button @click="eliminarAvance(av.id!)" class="btn btn-sm btn-outline-danger" title="Eliminar Seguimiento">
                    <i class="bi bi-trash3"></i>
                  </button>
                  <button @click="descargarPDF(av.id!)" :disabled="generandoPDF"
                    class="btn btn-sm btn-outline-light d-inline-flex align-items-center">
                    <span v-if="generandoPDF" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-file-earmark-pdf-fill text-danger fs-5 me-2"></i>
                    {{ generandoPDF ? 'Generando...' : 'Generar Reporte PDF' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-4">
            <div class="glass-panel p-4">
              <h5 class="mb-3"><i class="bi bi-plus-circle me-1"></i> Registrar Avance</h5>
              <form @submit.prevent="guardarAvance">
                <div class="mb-3">
                  <!-- Toggle Tipo de Periodo -->
                  <label class="form-label small fw-bold">Tipo de Control</label>
                  <div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm flex-fill fw-bold"
                      :class="nuevoAvance.tipo_periodo === 'SEMANA' ? 'btn-info text-dark' : 'btn-outline-secondary'"
                      @click="nuevoAvance.tipo_periodo = 'SEMANA'; nuevoAvance.semana = 1">
                      <i class="bi bi-calendar-week me-1"></i> Por Semanas
                    </button>
                    <button type="button" class="btn btn-sm flex-fill fw-bold"
                      :class="nuevoAvance.tipo_periodo === 'DIA' ? 'btn-warning text-dark' : 'btn-outline-secondary'"
                      @click="nuevoAvance.tipo_periodo = 'DIA'; nuevoAvance.semana = 1">
                      <i class="bi bi-calendar-day me-1"></i> Por Días
                    </button>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label small">{{ labelNPeriodo }}</label>
                  <input type="number" class="form-control" v-model="nuevoAvance.semana" required
                    ref="inputSemana" @keydown.enter.prevent="inputAvance?.focus()">
                </div>
                <div class="mb-3">
                  <label class="form-label small">% de Avance Físico Actual</label>
                  <input type="number" class="form-control" v-model="nuevoAvance.porcentaje_avance" min="0" max="100" required
                    ref="inputAvance" @keydown.enter.prevent="inputFecha?.focus()">
                </div>
                <div class="mb-3 d-flex gap-2">
                  <div class="flex-fill">
                    <label class="form-label small">Fecha del Avance</label>
                    <input type="date" class="form-control" v-model="nuevoAvance.fecha_fin" required
                      ref="inputFecha" @keydown.enter.prevent="inputDias?.focus()">
                  </div>
                  <div class="flex-fill">
                    <label class="form-label small">Días Trabajados</label>
                    <input type="number" step="0.5" class="form-control" v-model="nuevoAvance.dias_trabajados" min="0" required
                      ref="inputDias" @keydown.enter.prevent="inputObs?.focus()">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label small">Observaciones Técnicas</label>
                  <textarea class="form-control" rows="2" v-model="nuevoAvance.observaciones"
                    ref="inputObs" @keydown.enter.prevent="fotoInput?.focus()"></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label small">Adjuntar Fotografías (Máx 4, JPG/JPEG/PNG, hasta 5MB c/u)</label>
                  <input type="file" id="fotoInput" ref="fotoInput" class="form-control text-muted" accept=".png, .jpg, .jpeg, image/png, image/jpeg" multiple @change="onFileSelected"
                    @keydown.enter.prevent="submitBtn?.focus()">
                  <div v-if="evidenciaFiles.length > 0" class="mt-1 text-info small">
                    <i class="bi bi-paperclip"></i> {{ evidenciaFiles.length }} archivo(s) listo(s) para subir
                  </div>
                </div>
                <button type="submit" ref="submitBtn" class="btn btn-success w-100" :disabled="store.loading">
                  <span v-if="store.loading" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-floppy me-1"></i>
                  {{ store.loading ? 'Guardando...' : 'Firmar Avance y Guardar' }}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      </Transition>

    </div>
  </div>
</template>

<style scoped>
/* ── Toast animations ── */
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.35s ease;
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

/* ── Vue Tab Nav ── */
.vue-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 0;
}

.vue-tab-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  border: none;
  color: rgba(148, 163, 184, 0.75);
  font-size: 0.875rem;
  font-weight: 500;
  padding: 10px 18px;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
  outline: none;
}
.vue-tab-btn::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: transparent;
  transition: background 0.25s ease;
  border-radius: 2px 2px 0 0;
}
.vue-tab-btn:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.05);
}
.vue-tab-btn.active {
  color: #fff;
  font-weight: 600;
  background: rgba(59, 130, 246, 0.12);
}
.vue-tab-btn.active::after {
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
}

/* ── Tab Badge ── */
.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(200, 200, 200, 0.8);
  transition: background 0.25s ease, color 0.25s ease;
}
.vue-tab-btn.active .tab-badge {
  background: rgba(59, 130, 246, 0.35);
  color: #93c5fd;
}
.tab-badge-info {
  background: rgba(16, 185, 129, 0.25) !important;
  color: #6ee7b7 !important;
}

/* ── Tab Content Wrapper ── */
.tab-content-wrapper {
  min-height: 200px;
  position: relative;
}

/* ── Tab Slide Transition ── */
.tab-slide-leave-to {
  opacity: 0;
}

/* ── Custom Modal Styles ── */
.custom-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.custom-modal-card {
  width: 100%;
  max-width: 400px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  overflow: hidden;
  animation: modal-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-pop {
  from { transform: scale(0.9) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.modal-icon-header {
  display: flex;
  justify-content: center;
  padding-top: 30px;
  padding-bottom: 20px;
}

.icon-circle {
  width: 65px;
  height: 65px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(220, 53, 69, 0.2);
}

/* Modal Fade Transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
