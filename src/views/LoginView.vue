<template>
  <div class="login-container d-flex justify-content-center align-items-center vh-100">
    <div class="card p-5 glass-card" style="width: 400px; max-width: 90vw;">
      <div class="text-center mb-4">
        <h2 class="text-white fw-bold">Acceso Restringido</h2>
        <span class="text-secondary small">Sistema de Control de Soldadura</span>
      </div>
      
      <div v-if="error" class="alert alert-danger text-center small py-2">{{ error }}</div>
      
      <form @submit.prevent="handleLogin">
        <div class="mb-3">
          <label class="form-label text-light small fw-bold">Usuario</label>
          <input type="text" class="form-control text-light font-monospace bg-dark border-secondary" v-model="username" required autocomplete="off">
        </div>
        <div class="mb-4">
          <label class="form-label text-light small fw-bold">Contraseña</label>
          <input type="password" class="form-control text-light font-monospace bg-dark border-secondary" v-model="password" required>
        </div>
        
        <button type="submit" class="btn btn-primary w-100 fw-bold shadow-sm" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          <span v-else>Iniciar Sesión Cifrada</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api/axios';

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();

const handleLogin = async () => {
  loading.value = true;
  error.value = '';
  
  // FastAPI OAuth2PasswordBearer strict format expects URLSearchParams (Form Data x-www-form-urlencoded)
  const formData = new URLSearchParams();
  formData.append('username', username.value);
  formData.append('password', password.value);
  
  try {
    const response = await api.post('/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    // Almacenamos el JWT en LocalStorage permanentemente para la sesion
    localStorage.setItem('token', response.data.access_token);
    
    // Redirigir al inicio central
    router.push('/');
  } catch (err: any) {
    if (err.response?.status === 400 || err.response?.status === 401) {
      error.value = 'Credenciales Incorrectas o no Autorizadas.';
    } else {
      error.value = 'Error del Servidor Central.';
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  background: radial-gradient(circle at bottom, #0d1b2a, #0b0c10);
}

.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 15px 35px rgba(0,0,0,0.5);
}

.form-control:focus {
  background-color: #1a1e24;
  border-color: #3b82f6;
  box-shadow: 0 0 0 0.25rem rgba(59, 130, 246, 0.25);
  color: white;
}
</style>
