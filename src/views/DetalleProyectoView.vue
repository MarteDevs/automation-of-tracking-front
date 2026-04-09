<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useProyectosStore } from '@/stores/proyectos';

const route = useRoute();
const store = useProyectosStore();

// Form para nuevo avance
const nuevoAvance = ref({
  semana: 1,
  porcentaje_avance: 10,
  observaciones: '',
  rutas_fotografias: ''
});

const evidenciaFile = ref<File | null>(null);

const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    evidenciaFile.value = target.files[0] || null;
  }
};

onMounted(async () => {
  const pId = Number(route.params.id);
  if (pId) {
    await store.fetchProyectoActivo(pId);
  }
});

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);
};

const guardarAvance = async () => {
  if (store.loading) return;
  const pId = Number(route.params.id);
  
  if (evidenciaFile.value) {
    const rutaOficialServidor = await store.uploadImagenEvidencia(evidenciaFile.value);
    nuevoAvance.value.rutas_fotografias = rutaOficialServidor;
  }

  await store.agregarAvance(pId, nuevoAvance.value);
  
  // Limpieza Form
  nuevoAvance.value = { semana: nuevoAvance.value.semana + 1, porcentaje_avance: Math.min(100, nuevoAvance.value.porcentaje_avance + 10), observaciones: '', rutas_fotografias: '' };
  evidenciaFile.value = null;
  const inputEl = document.getElementById('fotoInput') as HTMLInputElement;
  if (inputEl) inputEl.value = '';
};

const descargarPDF = async (avanceId: number) => {
  const pId = Number(route.params.id);
  if(!pId || !avanceId) return;
  
  // Opcionalmente se puede bloquear la UI, pero como descarga directo, lo hacemos silencioso
  await store.descargarReportePdf(pId, avanceId);
};
</script>

<template>
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

    <!-- Bootstrap Tabs Nav -->
    <ul class="nav nav-tabs border-bottom-0 mb-4" id="projectTabs" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active bg-transparent text-white fw-bold border-0 border-bottom border-primary" id="rrhh-tab" data-bs-toggle="tab" data-bs-target="#rrhh" type="button" role="tab">Personal & Mano de Obra</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link bg-transparent text-muted border-0" id="mats-tab" data-bs-toggle="tab" data-bs-target="#mats" type="button" role="tab">Materiales, EPP y Equipos</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link bg-transparent text-muted border-0" id="avance-tab" data-bs-toggle="tab" data-bs-target="#avance" type="button" role="tab">Control de Avance Semanal</button>
      </li>
    </ul>

    <!-- Tabs Content -->
    <div class="tab-content" id="myTabContent">
      
      <!-- RRHH -->
      <div class="tab-pane fade show active" id="rrhh" role="tabpanel">
        <div class="table-responsive glass-panel p-2">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th>Cargo / Descripción</th>
                <th>Cant. Obra</th>
                <th>Precio Unit.</th>
                <th>Total C/Leyes Soc.</th>
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
          </table>
        </div>
      </div>

      <!-- MATERIALES -->
      <div class="tab-pane fade" id="mats" role="tabpanel">
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
          </table>
        </div>
      </div>

      <!-- AVANCES SEMANALES -->
      <div class="tab-pane fade" id="avance" role="tabpanel">
        <div class="row">
          <div class="col-md-8">
            <h5 class="mb-3">Historial de Avance</h5>
            <div v-if="store.proyectoActivo.avances.length === 0" class="alert alert-secondary glass-panel">Sin avances registrados actualmente.</div>
            
            <div v-for="av in store.proyectoActivo.avances" :key="av.id" class="card mb-3 glass-panel border-start border-4 border-info">
              <div class="card-body">
                <div class="d-flex justify-content-between">
                  <h6 class="fw-bold">Reporte Semana {{ av.semana }}</h6>
                  <span class="badge bg-info fw-bold">{{ av.porcentaje_avance }}% Completado</span>
                </div>
                <p class="mb-1 mt-2 text-muted small">{{ av.observaciones || "Sin observaciones." }}</p>
                <div v-if="av.rutas_fotografias" class="mt-2 text-primary small">
                  <i class="bi bi-image"></i> Fotografías Adjuntadas / URL: {{ av.rutas_fotografias }}
                </div>
                
                <div class="mt-3 text-end border-top border-secondary pt-2">
                  <button @click="descargarPDF(av.id!)" class="btn btn-sm btn-outline-light d-inline-flex align-items-center">
                    <i class="bi bi-file-earmark-pdf-fill text-danger fs-5 me-2"></i> Generar Reporte PDF
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
                  <label class="form-label small">N° Semana</label>
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
                 <div class="mb-4">
                  <label class="form-label small">Adjuntar Fotografía Real (JPG / PNG)</label>
                  <input type="file" id="fotoInput" class="form-control text-muted" accept="image/png, image/jpeg" @change="onFileSelected">
                </div>
                <button type="submit" class="btn btn-success w-100" :disabled="store.loading">
                  <span v-if="store.loading" class="spinner-border spinner-border-sm me-2"></span>
                  Firmar Avance y Guardar
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
