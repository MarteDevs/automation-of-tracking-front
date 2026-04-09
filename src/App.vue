<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-layout">
    <nav class="app-navbar navbar navbar-expand-lg navbar-dark sticky-top">
      <div class="container-fluid px-4">

        <!-- Logo + Nombre -->
        <RouterLink class="navbar-brand d-flex align-items-center gap-2" to="/">
          <div class="brand-logo">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <!-- Flame/Welding icon -->
              <path d="M12 2C12 2 7 7 7 12.5C7 15.5 9 18 12 18C15 18 17 15.5 17 12.5C17 10 15.5 8 14 6.5C14 6.5 14 9 12 9C12 9 11 7 12 2Z" fill="url(#flameGrad)"/>
              <path d="M12 14C12 14 10 13 10 11.5C10 11.5 11 12 12 11.5C13 11 13 10 13 10C13 10 14 11 14 12.5C14 13.5 13.1 14.5 12 14Z" fill="#fff" opacity="0.9"/>
              <!-- Arc/electrode line -->
              <line x1="6" y1="20" x2="18" y2="20" stroke="url(#arcGrad)" stroke-width="2" stroke-linecap="round"/>
              <defs>
                <linearGradient id="flameGrad" x1="7" y1="2" x2="17" y2="18" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#f59e0b"/>
                  <stop offset="60%" stop-color="#ef4444"/>
                  <stop offset="100%" stop-color="#3b82f6"/>
                </linearGradient>
                <linearGradient id="arcGrad" x1="6" y1="20" x2="18" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#3b82f6"/>
                  <stop offset="100%" stop-color="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-title">Derek<span class="brand-accent"> Welding</span></span>
            <span class="brand-sub">Control de Proyectos</span>
          </div>
        </RouterLink>

        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto gap-2 align-items-center">
            <li class="nav-item">
              <RouterLink class="nav-link nav-pill" to="/">
                <i class="bi bi-grid-1x2-fill me-1"></i> Dashboard
              </RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="btn btn-upload px-3 rounded-pill fw-medium d-flex align-items-center gap-1" to="/upload">
                <i class="bi bi-cloud-arrow-up-fill"></i> Subir Presupuesto
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
/* ── Navbar ── */
.app-navbar {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  box-shadow: 0 4px 30px rgba(0,0,0,0.4);
  padding: 10px 0;
}

/* ── Brand Logo ── */
.brand-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(139,92,246,0.2) 100%);
  border: 1px solid rgba(59,130,246,0.4);
  border-radius: 10px;
  box-shadow: 0 0 12px rgba(59,130,246,0.3);
  transition: box-shadow 0.3s ease;
}
.navbar-brand:hover .brand-logo {
  box-shadow: 0 0 20px rgba(59,130,246,0.6);
}

/* ── Brand Text ── */
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}
.brand-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.3px;
}
.brand-accent {
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.brand-sub {
  font-size: 0.65rem;
  color: rgba(148, 163, 184, 0.8);
  font-weight: 400;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* ── Nav Links ── */
.nav-pill {
  color: rgba(148, 163, 184, 0.9) !important;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 0.88rem;
  font-weight: 500;
  transition: all 0.2s ease;
}
.nav-pill:hover {
  color: #fff !important;
  background: rgba(255,255,255,0.07);
}
.nav-pill.router-link-active {
  color: #fff !important;
  background: rgba(59,130,246,0.15);
  border: 1px solid rgba(59,130,246,0.35);
}

/* ── Upload Button ── */
.btn-upload {
  background: linear-gradient(135deg, #3b82f6, #6d28d9);
  border: none;
  color: #fff;
  font-size: 0.88rem;
  padding: 7px 16px;
  transition: all 0.25s ease;
  box-shadow: 0 4px 14px rgba(59,130,246,0.35);
}
.btn-upload:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(59,130,246,0.5);
  color: #fff;
}

/* ── Layout ── */
.app-layout {
  min-height: 100vh;
}
</style>
