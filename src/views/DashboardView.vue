<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useProyectosStore } from '@/stores/proyectos';

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
</script>

<template>
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
      <RouterLink to="/upload" class="btn btn-primary d-none d-md-inline-block">
        + Nuevo Control
      </RouterLink>
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

    <div v-else class="row g-4">
      <div class="col-12 col-md-6 col-lg-4" v-for="proyecto in store.proyectos" :key="proyecto.id">
        <div class="card glass-panel h-100 p-2 overflow-hidden position-relative border-top-0 border-start-0 border-end-0 border-bottom border-primary border-4 text-decoration-none">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="card-title fw-bold text-truncate" :title="proyecto.nombre_proyecto">
                  {{ proyecto.nombre_proyecto }}
                </h5>
                <p class="text-muted small mb-3"><i class="bi bi-calendar3"></i> {{ proyecto.fecha }}</p>
              </div>
              <button @click.prevent="abrirModalEliminar(proyecto.id)" class="btn btn-link text-danger p-0 border-0 text-decoration-none opacity-50 hover-opacity-100" title="Eliminar Proyecto">
                <i class="bi bi-trash3 fs-5"></i>
              </button>
            </div>
            
            <div class="d-flex justify-content-between mt-4">
              <div>
                <span class="d-block text-muted small">Costo Total</span>
                <strong class="fs-5 text-success">{{ formatCurrency(proyecto.costo_total) }}</strong>
              </div>
              <div class="text-end">
                <span class="d-block text-muted small">Utilidad Esperada</span>
                <strong class="fs-5 text-info">{{ proyecto.utilidad_porcentaje }}%</strong>
              </div>
            </div>
          </div>
          <div class="card-footer bg-transparent border-0 pt-0 text-end">
            <RouterLink :to="`/proyectos/${proyecto.id}`" class="btn btn-sm btn-outline-light rounded-pill px-3 mt-2">
              Ver Detalles <i class="bi bi-arrow-right-short"></i>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
