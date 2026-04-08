<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-layout">
    <nav class="navbar navbar-expand-lg navbar-dark glass-panel mb-4 mx-3 mt-3 sticky-top">
      <div class="container-fluid">
        <RouterLink class="navbar-brand fw-bold text-white shadow-sm" to="/">
          <i class="bi bi-heptagon-half text-primary me-2"></i> Derek Welding Control
        </RouterLink>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto gap-2 align-items-center">
            <li class="nav-item">
              <RouterLink class="nav-link" to="/">Dashboard</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="btn btn-primary px-3 rounded-pill fw-medium" to="/upload">
                <i class="bi bi-cloud-arrow-up-fill me-1"></i> Subir Presupuesto (PDF)
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    
    <main class="container-fluid px-4 pb-5">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
}
.nav-link.router-link-active {
  color: #fff !important;
  font-weight: 600;
  border-bottom: 2px solid var(--bs-primary);
}
</style>
