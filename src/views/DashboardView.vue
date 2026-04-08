<script setup lang="ts">
import { onMounted } from 'vue';
import { useProyectosStore } from '@/stores/proyectos';

const store = useProyectosStore();

onMounted(async () => {
  await store.fetchProyectos();
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
};
</script>

<template>
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
            <h5 class="card-title fw-bold text-truncate" :title="proyecto.nombre_proyecto">
              {{ proyecto.nombre_proyecto }}
            </h5>
            <p class="text-muted small mb-3"><i class="bi bi-calendar3"></i> {{ proyecto.fecha }}</p>
            
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
