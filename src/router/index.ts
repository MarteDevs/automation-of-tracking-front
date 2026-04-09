import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      name: 'home',
      component: DashboardView,
      meta: { requiresAuth: true }
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('../views/UploadView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/proyectos/:id',
      name: 'detalle-proyecto',
      component: () => import('../views/DetalleProyectoView.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

// === CUSTODIO DE NAVEGACION WEB (Navigation Guard) ===
router.beforeEach((to, from, next) => {
  const isAuth = !!localStorage.getItem('token');
  
  if (to.meta.requiresAuth && !isAuth) {
    // Intenta entrar sin token -> Desviado al login
    next({ name: 'login' });
  } else if (to.name === 'login' && isAuth) {
    // Intenta ir al login cuando ya esta logeado -> devuelto al dashboard
    next({ name: 'home' });
  } else {
    // Continua el pase
    next();
  }
})

export default router
