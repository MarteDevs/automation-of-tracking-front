<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useProyectosStore } from '@/stores/proyectos';

const route = useRoute();
const store = useProyectosStore();

// Form para nuevo avance
const nuevoAvance = ref({
  semana: 1,
  porcentaje_avance: 10,
  observaciones: '',
  rutas_fotografias: '',
  tipo_periodo: 'SEMANA' as 'SEMANA' | 'DIA'
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

onMounted(async () => {
  const pId = Number(route.params.id);
  if (pId) {
    await store.fetchProyectoActivo(pId);
    if (store.proyectoActivo) {
      editSemanasVal.value = store.proyectoActivo.semanas_estimadas || 1;
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
    tipo_periodo: nuevoAvance.value.tipo_periodo // Mantener el tipo elegido
  };
  evidenciaFiles.value = [];
  const inputEl = document.getElementById('fotoInput') as HTMLInputElement;
  if (inputEl) inputEl.value = '';
};

const guardarSemanasEstimadas = async () => {
  const pId = Number(route.params.id);
  if (pId && editSemanasVal.value >= 1) {
    await store.actualizarConfiguracion(pId, editSemanasVal.value);
    showToast(`✔ Plazo guardado: ${editSemanasVal.value} semanas.`, 'success');
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

const eliminarAvance = async (avId: number) => {
  if (!confirm('¿Estás seguro de que deseas eliminar este registro de seguimiento? Esta acción no se puede deshacer.')) return;
  
  const pId = Number(route.params.id);
  try {
    await store.eliminarAvance(pId, avId);
    showToast('✔ Registro de seguimiento eliminado.', 'info');
  } catch {
    showToast('Error al intentar eliminar el registro.', 'danger');
  }
};
</script>

<template>
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
        <i class="bi bi-people-fill"></i>
        Personal &amp; Mano de Obra
        <span class="tab-badge">{{ store.proyectoActivo.mano_de_obra.length }}</span>
      </button>
      <button
        class="vue-tab-btn"
        :class="{ active: activeTab === 'mats' }"
        @click="activeTab = 'mats'"
      >
        <i class="bi bi-boxes"></i>
        Materiales, EPP y Equipos
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
                <th>Cargo / Descripción</th>
                <th>Cant. Trabajadores</th>
                <th>Precio Unit.</th>
                <th>Total a Mano De Obra</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="mo in store.proyectoActivo.mano_de_obra" :key="mo.id">
                <td class="fw-medium">{{ mo.descripcion }}</td>
                <td>{{ mo.cantidad_trabajadores }}</td>
                <td>{{ formatCurrency(mo.precio_unitario) }}</td>
                <td class="text-success fw-bold">{{ formatCurrency(mo.total) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-top border-secondary">
                <td colspan="3" class="fw-bold text-end text-muted">Subtotal Mano de Obra:</td>
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
                <th>Insumo / Descripción</th>
                <th>Ctd.</th>
                <th>Unidad</th>
                <th>Costo Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="mat in store.proyectoActivo.materiales" :key="mat.id">
                <td class="fw-medium">{{ mat.descripcion }}</td>
                <td>{{ mat.cantidad }}</td>
                <td><span class="badge bg-secondary">{{ mat.unidad }}</span></td>
                <td class="text-success fw-bold">{{ formatCurrency(mat.total) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-top border-secondary">
                <td colspan="3" class="fw-bold text-end text-muted">Subtotal Materiales:</td>
                <td class="fw-bold text-warning fs-6">{{ formatCurrency(totalMateriales) }}</td>
              </tr>
            </tfoot>
          </table>

          <!-- TOTAL GENERAL -->
          <div class="d-flex justify-content-end mt-3">
            <div class="glass-panel px-4 py-3 border-primary bg-primary bg-opacity-10 text-end" style="min-width: 280px;">
              <span class="d-block small text-muted mb-1">Mano de Obra + Materiales</span>
              <div class="d-flex justify-content-between align-items-center gap-4">
                <span class="fw-bold text-white">Total General a Pagar:</span>
                <span class="fw-bold text-primary fs-5">{{ formatCurrency(totalGeneral) }}</span>
              </div>
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
              </div>
              <div class="d-flex align-items-center mt-3 mt-md-0 gap-2 ms-md-4">
                <input type="number" class="form-control form-control-sm text-center" style="width: 70px;" v-model="editSemanasVal" min="1">
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
                  <input type="number" class="form-control" v-model="nuevoAvance.semana" required>
                </div>
                <div class="mb-3">
                  <label class="form-label small">% de Avance Físico Actual</label>
                  <input type="number" class="form-control" v-model="nuevoAvance.porcentaje_avance" min="0" max="100" required>
                </div>
                <div class="mb-3">
                  <label class="form-label small">Observaciones Técnicas</label>
                  <textarea class="form-control" rows="2" v-model="nuevoAvance.observaciones"></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label small">Adjuntar Fotografías (Máx 4, JPG/PNG, hasta 5MB c/u)</label>
                  <input type="file" id="fotoInput" class="form-control text-muted" accept="image/png, image/jpeg" multiple @change="onFileSelected">
                  <div v-if="evidenciaFiles.length > 0" class="mt-1 text-info small">
                    <i class="bi bi-paperclip"></i> {{ evidenciaFiles.length }} archivo(s) listo(s) para subir
                  </div>
                </div>
                <button type="submit" class="btn btn-success w-100" :disabled="store.loading">
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
.tab-slide-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.tab-slide-leave-active {
  transition: opacity 0.15s ease;
  position: absolute;
  width: 100%;
}
.tab-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.tab-slide-leave-to {
  opacity: 0;
}
</style>
