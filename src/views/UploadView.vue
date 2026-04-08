<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useProyectosStore } from '@/stores/proyectos';

const store = useProyectosStore();
const router = useRouter();

const selectedFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0];
  }
};

const handleDrop = (e: DragEvent) => {
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    selectedFile.value = e.dataTransfer.files[0];
  }
};

const procesarArchivo = async () => {
  if (!selectedFile.value) return;
  try {
    const proyecto = await store.procesarPresupuesto(selectedFile.value);
    router.push(`/proyectos/${proyecto.id}`);
  } catch (err) {
    // El error ya es manejado por el store
  }
};
</script>

<template>
  <div class="row min-vh-75 align-items-center justify-content-center">
    <div class="col-12 col-md-8 col-lg-6">
      <div class="glass-panel p-5 text-center">
        <h2 class="mb-3 fw-bold">Procesar Presupuesto con IA</h2>
        <p class="text-muted mb-4">Sube la plantilla de presupuesto en PDF. La inteligencia artificial estructurará todos los costos automáticamente.</p>
        
        <div 
          class="upload-area p-5 mb-4 rounded border-2 border-dashed"
          :class="{ 'border-primary bg-primary bg-opacity-10': selectedFile, 'border-secondary': !selectedFile }"
          @dragover.prevent
          @drop.prevent="handleDrop"
          @click="fileInput?.click()"
          style="cursor: pointer; border-style: dashed !important;"
        >
          <input 
            type="file" 
            class="d-none" 
            ref="fileInput" 
            accept="application/pdf"
            @change="onFileChange"
          >
          <div v-if="!selectedFile">
            <i class="bi bi-cloud-arrow-up display-1 text-muted mb-3 d-block"></i>
            <h5>Arrastra tu PDF aquí o haz clic para buscar</h5>
          </div>
          <div v-else>
            <i class="bi bi-file-earmark-pdf-fill display-1 text-danger mb-3 d-block"></i>
            <h5 class="text-primary">{{ selectedFile.name }}</h5>
            <small class="text-muted">{{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</small>
          </div>
        </div>

        <div v-if="store.error" class="alert alert-danger">
          {{ store.error }}
        </div>

        <button 
          class="btn btn-primary btn-lg w-100 rounded-pill fw-bold" 
          :disabled="!selectedFile || store.loading"
          @click="procesarArchivo"
        >
          <span v-if="store.loading">
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Extrayendo Texto con IA... (Puede demorar)
          </span>
          <span v-else>
            <i class="bi bi-cpu-fill me-2"></i> Procesar Costos
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
