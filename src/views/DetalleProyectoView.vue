<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useProyectosStore } from '@/stores/proyectos';

const route = useRoute();
const store = useProyectosStore();

const nuevoAvance = ref({
  semana: 1,
  porcentaje_avance: 10,
  observaciones: '',
  rutas_fotografias: '',
  rutas_facturas: '',
  tipo_periodo: 'SEMANA' as 'SEMANA' | 'DIA' | 'HORA',
  fecha_fin: '',
  dias_trabajados: 0,
  consumos_materiales: [] as { 
    nombre_material: string, 
    cantidad_usada: number | null, 
    unidad: string, 
    busqueda?: string, 
    showDropdown?: boolean,
    highlightedIndex?: number
  }[]
});

const esPorHora = ref(false);

// Etiqueta dinámica según tipo
const labelPeriodo = computed(() => {
  if (nuevoAvance.value.tipo_periodo === 'HORA') return 'Hora';
  return nuevoAvance.value.tipo_periodo === 'DIA' ? 'Día' : 'Semana';
});

const labelNPeriodo = computed(() => {
  if (nuevoAvance.value.tipo_periodo === 'HORA') return 'N° Hora';
  return nuevoAvance.value.tipo_periodo === 'DIA' ? 'N° Día' : 'N° Semana';
});

const labelUnidadTrabajo = computed(() => esPorHora.value ? 'Horas Trabajadas' : 'Días Trabajados');

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
const evidenciaFiles = ref<File[]>([]);
const facturasFiles = ref<File[]>([]);
const fotoFinalFile = ref<File | null>(null);

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
const showPdfModal = ref(false);
const currentPdfUrl = ref('');
const pdfModalTitle = ref('');

// Refs para navegación con Enter
const inputSemana = ref<HTMLInputElement | null>(null);
const inputAvance = ref<HTMLInputElement | null>(null);
const inputFecha = ref<HTMLInputElement | null>(null);
const inputDias = ref<HTMLInputElement | null>(null);
const inputObs = ref<HTMLTextAreaElement | null>(null);
const fotoInput = ref<HTMLInputElement | null>(null);
const submitBtn = ref<HTMLButtonElement | null>(null);

// Refs dinámicos para los inputs de materiales (indexados por fila)
const materialSearchRefs = ref<(HTMLInputElement | null)[]>([]);
const materialCantidadRefs = ref<(HTMLInputElement | null)[]>([]);

const setMaterialSearchRef = (el: any, index: number) => {
  materialSearchRefs.value[index] = el as HTMLInputElement | null;
};
const setMaterialCantidadRef = (el: any, index: number) => {
  materialCantidadRefs.value[index] = el as HTMLInputElement | null;
};

// Ref al <ul> del dropdown para hacer scroll automático al ítem resaltado
const dropdownListRefs = ref<(HTMLUListElement | null)[]>([]);
const setDropdownListRef = (el: any, index: number) => {
  dropdownListRefs.value[index] = el as HTMLUListElement | null;
};

// Desplaza el dropdown para que el ítem resaltado sea siempre visible
const scrollHighlightedIntoView = (index: number) => {
  nextTick(() => {
    const ul = dropdownListRefs.value[index];
    const cons = nuevoAvance.value.consumos_materiales[index];
    if (!ul || !cons || (cons.highlightedIndex ?? -1) < 0) return;
    const items = ul.querySelectorAll<HTMLElement>('.search-item');
    const target = items[cons.highlightedIndex!];
    if (target) target.scrollIntoView({ block: 'nearest' });
  });
};

// Navegar: Enter en foto → agregar material y enfocar su búsqueda
const navegarFotoAMaterial = () => {
  agregarConsumoNuevo();
  nextTick(() => {
    const idx = nuevoAvance.value.consumos_materiales.length - 1;
    materialSearchRefs.value[idx]?.focus();
  });
};

// Enter en búsqueda → selecciona el ítem resaltado con flechas, o navega a cantidad si ya hay uno
const navegarBusquedaACantidad = (index: number) => {
  const cons = nuevoAvance.value.consumos_materiales[index];
  if (!cons) return;

  const lista = materialesFiltradosPorFila(index);
  const hi = cons.highlightedIndex ?? -1;

  // Primero: si hay un ítem resaltado con las flechas, seleccionarlo
  if (hi >= 0 && lista[hi]) {
    seleccionarMaterial(index, lista[hi]);
    cons.highlightedIndex = -1;
    nextTick(() => materialCantidadRefs.value[index]?.focus());
    return;
  }

  // Segundo: si el dropdown tiene solo un resultado, seleccionarlo automáticamente
  if (lista.length === 1 && cons.busqueda?.trim()) {
    seleccionarMaterial(index, lista[0]);
    cons.highlightedIndex = -1;
    nextTick(() => materialCantidadRefs.value[index]?.focus());
    return;
  }

  // Tercero: si ya hay un material elegido (click previo), ir a cantidad
  if (cons.nombre_material) {
    cons.showDropdown = false;
    nextTick(() => materialCantidadRefs.value[index]?.focus());
  }
};

// Enter en cantidad → agregar nuevo material y enfocar su búsqueda
const navegarCantidadANuevoMaterial = () => {
  agregarConsumoNuevo();
  nextTick(() => {
    const idx = nuevoAvance.value.consumos_materiales.length - 1;
    materialSearchRefs.value[idx]?.focus();
  });
};

const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const arr = Array.from(target.files);
    const tooBig = arr.filter(f => f.size > MAX_UPLOAD_SIZE);
    if (tooBig.length > 0) showToast(`Se omitieron ${tooBig.length} imágenes por superar 50MB.`, 'danger');
    
    const validFiles = arr.filter(f => f.size <= MAX_UPLOAD_SIZE);
    if (validFiles.length > 4) {
      showToast('Máximo 4 fotos. Se tomaron las 4 primeras válidas.', 'info');
      evidenciaFiles.value = validFiles.slice(0, 4);
    } else {
      evidenciaFiles.value = validFiles;
      if (validFiles.length > 0) showToast(`${validFiles.length} foto(s) seleccionada(s).`, 'info');
    }
  } else {
    evidenciaFiles.value = [];
  }
};

const onFacturasSelected = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const arr = Array.from(target.files);
    const tooBig = arr.filter(f => f.size > MAX_UPLOAD_SIZE);
    if (tooBig.length > 0) showToast(`Se omitieron facturas por superar 50MB.`, 'danger');
    
    const validFiles = arr.filter(f => f.size <= MAX_UPLOAD_SIZE);
    if (validFiles.length > 4) {
      showToast('Máximo 4 facturas por avance.', 'info');
      facturasFiles.value = validFiles.slice(0, 4);
    } else {
      facturasFiles.value = validFiles;
      if (validFiles.length > 0) showToast(`${validFiles.length} factura(s) lista(s).`, 'info');
    }
  } else {
    facturasFiles.value = [];
  }
};

const onFotoFinalSelected = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      showToast('La foto supera los 50MB permitidos.', 'danger');
      return;
    }
    showToast('Subiendo Foto Final del Proyecto...', 'info');
    try {
      const pId = Number(route.params.id);
      const rutaServer = await store.uploadImagenEvidencia([file]);
      await store.subirFotoFinal(pId, rutaServer);
      showToast('✔ Foto Final anexada correctamante al balance global.', 'success');
      target.value = '';
    } catch {
      showToast('Error al subir la Foto Final.', 'danger');
    }
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
    } else if (nuevoAvance.value.tipo_periodo === 'HORA') {
        // Para horas, no movemos la fecha automáticamente de forma tan agresiva,
        // solemos usar la misma fecha o el siguiente día si es mucho.
        // Pero por simplificación, asociaremos la fecha según el número de "periodo" si son secuenciales.
        nuevoAvance.value.fecha_fin = toLocalYYYYMMDD(new Date());
        nuevoAvance.value.dias_trabajados = nuevoAvance.value.semana; // Tomamos el N° como horas
    } else {
        d.setDate(d.getDate() + Number(nuevoAvance.value.semana)); 
        nuevoAvance.value.fecha_fin = toLocalYYYYMMDD(d);
        nuevoAvance.value.dias_trabajados = nuevoAvance.value.semana; // Días acumulados sugeridos
    }
}

watch(esPorHora, (val) => {
  if (val) {
    nuevoAvance.value.tipo_periodo = 'HORA';
  } else if (nuevoAvance.value.tipo_periodo === 'HORA') {
    nuevoAvance.value.tipo_periodo = 'DIA';
  }
});

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
// Forzado por regla de negocio a 10% Utilidad y 5% Otros (15% total)
const utilidadPorc = computed(() => 0.10);
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

  if (facturasFiles.value.length > 0) {
    showToast('Subiendo facturas al servidor...', 'info');
    const rutasFacturasServidor = await store.uploadImagenEvidencia(facturasFiles.value);
    nuevoAvance.value.rutas_facturas = rutasFacturasServidor;
    showToast(`✔ ${facturasFiles.value.length} factura(s) guardada(s).`, 'success');
  }

  // Limpiar datos para el servidor (quitar campos de UI y manejar nulls)
  const datosParaEnviar = {
    ...nuevoAvance.value,
    consumos_materiales: nuevoAvance.value.consumos_materiales.map(c => ({
      nombre_material: c.nombre_material,
      cantidad_usada: c.cantidad_usada || 0,
      unidad: c.unidad
    }))
  };

  await store.agregarAvance(pId, datosParaEnviar as any);
  showToast(`✔ Reporte de ${labelPeriodo.value} ${nuevoAvance.value.semana} registrado con éxito.`, 'success');

  // Limpieza Form: avanza al siguiente período
  nuevoAvance.value = {
    semana: nuevoAvance.value.semana + 1,
    porcentaje_avance: Math.min(100, nuevoAvance.value.porcentaje_avance + 10),
    observaciones: '',
    rutas_fotografias: '',
    rutas_facturas: '',
    tipo_periodo: nuevoAvance.value.tipo_periodo, // Mantener el tipo elegido
    fecha_fin: '',
    dias_trabajados: nuevoAvance.value.dias_trabajados, // mantener sugerencia o se recalculará
    consumos_materiales: []
  } as any;
  evidenciaFiles.value = [];
  facturasFiles.value = [];
  const inputEl = document.getElementById('fotoInput') as HTMLInputElement;
  if (inputEl) inputEl.value = '';
  const inputFacEl = document.getElementById('facturaInput') as HTMLInputElement;
  if (inputFacEl) inputFacEl.value = '';
};

const agregarConsumoNuevo = () => {
  nuevoAvance.value.consumos_materiales.push({
    nombre_material: '',
    cantidad_usada: null as any,
    unidad: '',
    busqueda: '',
    showDropdown: false,
    highlightedIndex: -1
  });
};

const seleccionarMaterial = (index: number, mat: any) => {
  const cons = nuevoAvance.value.consumos_materiales[index];
  if (!cons) return;
  cons.nombre_material = mat.descripcion;
  cons.unidad = mat.unidad || 'Und';
  cons.busqueda = mat.descripcion;
  cons.showDropdown = false;
};

const ocultarDropdown = (index: number) => {
  setTimeout(() => {
    const cons = nuevoAvance.value.consumos_materiales[index];
    if (cons) { cons.showDropdown = false; cons.highlightedIndex = -1; }
  }, 200);
};

// Navegar dropdown con flechas ↓↑
const navegarDropdownAbajo = (index: number) => {
  const cons = nuevoAvance.value.consumos_materiales[index];
  if (!cons) return;
  cons.showDropdown = true;
  const lista = materialesFiltradosPorFila(index);
  if (lista.length === 0) return;
  cons.highlightedIndex = ((cons.highlightedIndex ?? -1) + 1) % lista.length;
  scrollHighlightedIntoView(index);
};

const navegarDropdownArriba = (index: number) => {
  const cons = nuevoAvance.value.consumos_materiales[index];
  if (!cons) return;
  cons.showDropdown = true;
  const lista = materialesFiltradosPorFila(index);
  if (lista.length === 0) return;
  const cur = cons.highlightedIndex ?? -1;
  cons.highlightedIndex = cur <= 0 ? lista.length - 1 : cur - 1;
  scrollHighlightedIntoView(index);
};

const actualizarUnidad = (idx: number) => {
  const cons = nuevoAvance.value.consumos_materiales[idx];
  if (!cons) return;
  const mat = store.proyectoActivo?.materiales.find(m => m.descripcion === cons.nombre_material);
  if (mat) cons.unidad = mat.unidad || 'Und';
};

const materialesDisponibles = computed(() => {
  if (!store.proyectoActivo?.materiales) return [];
  
  // 1. Agrupar PRESUPUESTO por nombre de material (Pool total)
  const presupuestoTotalMap = new Map<string, { cantidad: number, unidad: string, categoria: string }>();
  store.proyectoActivo.materiales.forEach(mat => {
    const nombreNorm = (mat.descripcion || '').trim();
    if (!presupuestoTotalMap.has(nombreNorm)) {
      presupuestoTotalMap.set(nombreNorm, { 
        cantidad: 0, 
        unidad: mat.unidad || 'Und',
        categoria: mat.categoria || ''
      });
    }
    const entry = presupuestoTotalMap.get(nombreNorm)!;
    entry.cantidad += Number(mat.cantidad) || 0;
  });

  // 2. Calcular CONSUMO histórico agrupado
  const consumosHistoricos = new Map<string, number>();
  store.proyectoActivo.avances.forEach(av => {
    if (av.consumos) {
      av.consumos.forEach(c => {
        const nombreNorm = (c.nombre_material || '').trim();
        const cantVal = Number(c.cantidad_usada) || 0;
        consumosHistoricos.set(nombreNorm, (consumosHistoricos.get(nombreNorm) || 0) + cantVal);
      });
    }
  });

  // 3. Resultado final: Comparar Pool Total vs Consumo Total
  const listaProcesada = [];
  for (const [nombre, data] of presupuestoTotalMap.entries()) {
    const usado = consumosHistoricos.get(nombre) || 0;
    const restante = Number((data.cantidad - usado).toFixed(4));
    
    const cat = (data.categoria || '').toUpperCase();
    const esMaterial = cat.includes('MATERIALES'); // Solo categoría Materiales
    
    if (restante > 0 && esMaterial) {
      listaProcesada.push({
        descripcion: nombre,
        restante: restante,
        unidad: data.unidad,
        categoria: data.categoria
      });
    }
  }
  
  return listaProcesada;
});

const materialesFiltradosPorFila = (index: number) => {
  const cons = nuevoAvance.value.consumos_materiales[index];
  if (!cons) return [];

  // 1. Filtrar los que ya están en OTRAS filas
  const seleccionadosEnOtros = nuevoAvance.value.consumos_materiales
    .filter((_, idx) => idx !== index)
    .map(c => c.nombre_material)
    .filter(name => !!name);

  let base = materialesDisponibles.value.filter(mat => !seleccionadosEnOtros.includes(mat.descripcion));

  // 2. Filtrar por la búsqueda de esta fila
  if (cons.busqueda && cons.busqueda.trim() !== '') {
    const query = cons.busqueda.toLowerCase();
    base = base.filter(mat => mat.descripcion.toLowerCase().includes(query));
  }

  return base;
};

const obtenerCantidadRestante = (nombre: string) => {
  if (!nombre) return '';
  const mat = materialesDisponibles.value.find(m => m.descripcion === nombre);
  return mat ? `Disp: ${mat.restante}` : '';
};

const obtenerRestanteNumerico = (nombre: string) => {
  if (!nombre) return 999999;
  const mat = materialesDisponibles.value.find(m => m.descripcion === nombre);
  return mat ? mat.restante : 999999;
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
    showToast('✔ Reporte PDF procesado correctamente.', 'success');
    // Actualizar datos para que el botón cambie a "Descargar" si era "Generar"
    await store.fetchProyectoActivo(pId);
  } catch {
    showToast('Error al generar el PDF.', 'danger');
  } finally {
    generandoPDF.value = false;
  }
};

const descargarBalanceGlobal = async () => {
  const pId = Number(route.params.id);
  if (!pId) return;
  generandoPDF.value = true;
  try {
    await store.descargarBalanceGlobalPdf(pId);
    showToast('✔ Balance Global procesado correctamente.', 'success');
    // Actualizar datos
    await store.fetchProyectoActivo(pId);
  } catch {
    showToast('Error al generar el Balance Global.', 'danger');
  } finally {
    generandoPDF.value = false;
  }
};

const verPDF = async (avanceId: number, forceRegenerate: boolean = false) => {
  const pId = Number(route.params.id);
  if (!pId || !avanceId) return;
  generandoPDF.value = true;
  try {
    if (forceRegenerate) {
        showToast('Iniciando Inteligencia Artificial, esto tomará unos 10 segundos...', 'info');
    }
    const blob = await store.fetchPdfBlob(pId, avanceId, forceRegenerate);
    if (currentPdfUrl.value) window.URL.revokeObjectURL(currentPdfUrl.value);
    currentPdfUrl.value = window.URL.createObjectURL(blob);
    
    const avance = store.proyectoActivo?.avances.find(a => a.id === avanceId);
    pdfModalTitle.value = `Reporte ${avance?.tipo_periodo === 'SEMANA' ? 'Semana' : 'Día'} ${avance?.semana}`;
    showPdfModal.value = true;
    
    // Si era nuevo y se generó, o si se forzó regenerar, refrescamos el estado del botón descargar
    if (!avance?.ruta_pdf || forceRegenerate) await store.fetchProyectoActivo(pId);
    
  } catch {
    showToast('Error al procesar o visualizar el PDF.', 'danger');
  } finally {
    generandoPDF.value = false;
  }
};

const verBalanceGlobal = async () => {
  const pId = Number(route.params.id);
  if (!pId) return;
  generandoPDF.value = true;
  try {
    const blob = await store.fetchBalancePdfBlob(pId);
    if (currentPdfUrl.value) window.URL.revokeObjectURL(currentPdfUrl.value);
    currentPdfUrl.value = window.URL.createObjectURL(blob);
    
    pdfModalTitle.value = `Balance Global - ${store.proyectoActivo?.nombre_proyecto}`;
    showPdfModal.value = true;

    // Refrescar estado del botón descargar
    if (!store.proyectoActivo?.ruta_pdf) await store.fetchProyectoActivo(pId);
  } catch {
    showToast('Error al visualizar el Balance Global.', 'danger');
  } finally {
    generandoPDF.value = false;
  }
};

const compartirPorWhatsApp = async (avanceId: number) => {
  const pId = Number(route.params.id);
  if (!pId || !avanceId) return;
  generandoPDF.value = true;
  try {
    const avance = store.proyectoActivo?.avances.find(a => a.id === avanceId);
    const blob = await store.fetchPdfBlob(pId, avanceId, false);
    
    const periodoLabel = avance?.tipo_periodo === 'SEMANA' ? 'Semana' : avance?.tipo_periodo === 'DIA' ? 'Día' : 'Hora';
    const num = avance?.semana;
    const nombreArchivo = `Reporte_${periodoLabel}_${num}.pdf`;
    
    const file = new File([blob], nombreArchivo, { type: 'application/pdf' });
    const textMsg = `Hola, adjunto el reporte de la ${periodoLabel} ${num} de la obra ${store.proyectoActivo?.nombre_proyecto}.`;

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Reporte - ${periodoLabel} ${num}`,
        text: textMsg
      });
      showToast('✔ Reporte compartido exitosamente', 'success');
    } else {
      // Fallback para Desktop: Descarga el PDF y abre WhatsApp Web
      const waUrl = `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
      
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = nombreArchivo;
      link.click();
      window.URL.revokeObjectURL(link.href);
      
      window.open(waUrl, '_blank');
      showToast('Descargando archivo y abriendo WhatsApp Web...', 'info');
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
       showToast('Error al intentar compartir.', 'danger');
    }
  } finally {
    generandoPDF.value = false;
  }
};

const cerrarVisorPDF = () => {
  showPdfModal.value = false;
  if (currentPdfUrl.value) {
    window.URL.revokeObjectURL(currentPdfUrl.value);
    currentPdfUrl.value = '';
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
  <!-- ===== VISOR DE PDF MODAL ===== -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="showPdfModal" class="custom-modal-overlay">
        <div class="glass-panel shadow-2xl d-flex flex-column" style="width: 95vw; height: 95vh; max-width: 1400px; border: 1px solid rgba(255,255,255,0.15);">
          <!-- Header del Visor -->
          <div class="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary border-opacity-25 bg-dark bg-opacity-20">
            <h5 class="mb-0 fw-bold text-white d-flex align-items-center gap-2">
              <i class="bi bi-file-earmark-pdf text-danger fs-4"></i>
              {{ pdfModalTitle }}
            </h5>
            <button @click="cerrarVisorPDF" class="btn btn-link text-white p-0 text-decoration-none">
              <i class="bi bi-x-lg fs-4"></i>
            </button>
          </div>
          
          <!-- Cuerpo con el Iframe -->
          <div class="flex-grow-1 bg-white overflow-hidden" style="position: relative;">
            <iframe 
              v-if="currentPdfUrl"
              :src="currentPdfUrl" 
              class="w-100 h-100 border-0"
              title="Visor de PDF"
            ></iframe>
            <div v-else class="w-100 h-100 d-flex align-items-center justify-content-center bg-dark">
                <div class="spinner-border text-info" role="status"></div>
            </div>
          </div>
          
          <!-- Footer con instruccion -->
          <div class="p-2 text-center bg-dark bg-opacity-40 border-top border-secondary border-opacity-25">
            <small class="text-muted">Use los controles del visor para imprimir, descargar o ajustar el zoom.</small>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

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
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
      <div>
        <h1 class="fw-bold mb-1">{{ store.proyectoActivo.nombre_proyecto }}</h1>
        <p class="text-muted"><i class="bi bi-calendar3"></i> Fecha Presupuestada: {{ store.proyectoActivo.fecha }}</p>
      </div>
      <div class="d-flex gap-3 align-items-center flex-wrap">
        <!-- Boton de Foto Final -->
        <div class="text-end">
           <label for="fotoFinalUpload" class="btn fw-bold mb-0 border-2" 
             :class="store.proyectoActivo?.ruta_foto_final ? 'btn-outline-success text-success' : 'btn-outline-warning text-warning'">
             <i class="bi bi-camera-fill me-1"></i> {{ store.proyectoActivo?.ruta_foto_final ? 'Actualizar Foto Final' : 'Subir Foto Final' }}
           </label>
           <input type="file" id="fotoFinalUpload" class="d-none" accept=".png, .jpg, .jpeg, image/png, image/jpeg" @change="onFotoFinalSelected">
           <div v-if="store.proyectoActivo?.ruta_foto_final" class="text-success small mt-1">
             <i class="bi bi-check-circle-fill"></i> Foto en balance global
           </div>
        </div>

        <div class="d-flex gap-2" v-if="false">
          <button 
            @click="verBalanceGlobal" 
            class="btn fw-semibold align-items-center d-flex gap-2 text-white border-0 transition-all shadow-sm"
            :style="store.proyectoActivo?.ruta_pdf 
              ? 'background: linear-gradient(135deg, #0284c7, #0369a1);' 
              : 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1) !important;'"
            title="Previsualizar Balance Acumulado"
            :disabled="generandoPDF"
          >
            <i v-if="generandoPDF" class="spinner-border spinner-border-sm text-info"></i>
            <template v-else>
              <i class="bi bi-eye-fill fs-5" :class="store.proyectoActivo?.ruta_pdf ? 'text-white' : 'text-muted'"></i> 
              <span :class="store.proyectoActivo?.ruta_pdf ? 'text-white' : 'text-muted'">Ver Balance Acumulado</span>
            </template>
          </button>
        </div>
        <div class="text-end glass-panel px-4 py-2 bg-primary bg-opacity-10 border-primary">
          <span class="d-block small text-muted">Costo Directo Total</span>
          <h3 class="mb-0 fw-bold text-primary">{{ formatCurrency(store.proyectoActivo.costo_total) }}</h3>
        </div>
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
                    <span class="badge me-2" 
                      :class="av.tipo_periodo === 'DIA' ? 'bg-warning text-dark' : (av.tipo_periodo === 'HORA' ? 'bg-indigo text-white' : 'bg-info text-dark')">
                      {{ av.tipo_periodo === 'DIA' ? 'DÍA' : (av.tipo_periodo === 'HORA' ? 'HORA' : 'SEMANA') }}
                    </span>
                    Reporte {{ av.tipo_periodo === 'DIA' ? 'Día' : (av.tipo_periodo === 'HORA' ? 'Hora' : 'Semana') }} {{ av.semana }}
                  </h6>
                  <span class="badge bg-success fw-bold">{{ av.porcentaje_avance }}% Completado</span>
                </div>
                <p class="mb-1 mt-2 text-muted small">
                  <strong>Fecha del Avance:</strong> {{ av.fecha_fin || 'No registrada' }} <span class="mx-2 text-secondary">|</span> 
                  <strong>{{ av.tipo_periodo === 'HORA' ? 'Horas' : 'Días' }} Trabajados:</strong> {{ av.dias_trabajados || '0' }}
                </p>
                <p class="mb-1 mt-2 text-muted small">{{ av.observaciones || "Sin observaciones." }}</p>
                <div v-if="av.rutas_fotografias" class="mt-2 text-success small">
                  <i class="bi bi-image-fill me-1"></i>
                  {{ av.rutas_fotografias.split(',').length }} fotografía(s) técnica(s)
                </div>
                <div v-if="av.rutas_facturas" class="mt-2 text-info small">
                  <i class="bi bi-receipt me-1"></i>
                  {{ av.rutas_facturas.split(',').length }} factura(s)/comprobante(s)
                </div>
                <div v-if="av.consumos && av.consumos.length > 0" class="mt-2 small text-warning">
                  <i class="bi bi-box-seam me-1"></i>
                  <strong>{{ av.consumos.length }}</strong> material(es) registrado(s) en este uso.
                </div>

                <div class="mt-3 d-flex justify-content-end align-items-center gap-2 border-top border-secondary border-opacity-10 pt-2">
                  <button @click="eliminarAvance(av.id!)" class="btn btn-sm btn-link text-danger text-decoration-none opacity-50 hover-opacity-100" title="Eliminar Seguimiento">
                    <i class="bi bi-trash3"></i>
                  </button>
                  <template v-if="av.ruta_pdf">
                      <button @click="compartirPorWhatsApp(av.id!)" :disabled="generandoPDF"
                        class="btn btn-sm btn-success bg-opacity-75 text-white d-inline-flex align-items-center fw-bold transition-all px-3 rounded-pill"
                        title="Compartir directo a WhatsApp">
                        <i class="bi bi-whatsapp me-2"></i> Compartir
                      </button>
                      <button @click="verPDF(av.id!, true)" :disabled="generandoPDF"
                        class="btn btn-sm btn-outline-warning text-white bg-opacity-10 d-inline-flex align-items-center fw-bold transition-all px-3 rounded-pill"
                        title="Re-ejecutar Inteligencia Artificial e ignorar el cache actual.">
                        <i class="bi bi-arrow-clockwise me-1"></i> Regenerar
                      </button>
                      <button @click="verPDF(av.id!, false)" :disabled="generandoPDF"
                        class="btn btn-sm btn-info bg-opacity-75 text-white d-inline-flex align-items-center fw-bold transition-all px-3 rounded-pill">
                        <i class="bi bi-eye-fill me-2 text-white"></i> Ver Reporte
                      </button>
                  </template>
                  <template v-else>
                      <button @click="verPDF(av.id!, false)" :disabled="generandoPDF"
                        class="btn btn-sm btn-outline-info text-info d-inline-flex align-items-center fw-bold transition-all px-3 rounded-pill border-2">
                        <span v-if="generandoPDF" class="spinner-border spinner-border-sm me-2 text-info"></span>
                        <i v-else class="bi bi-magic me-2 text-info"></i> Generar Reporte PDF
                      </button>
                  </template>
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
                      @click="nuevoAvance.tipo_periodo = 'SEMANA'; nuevoAvance.semana = 1; esPorHora = false">
                      <i class="bi bi-calendar-week me-1"></i> Por Semanas
                    </button>
                    <button type="button" class="btn btn-sm flex-fill fw-bold"
                      :class="(nuevoAvance.tipo_periodo === 'DIA' || nuevoAvance.tipo_periodo === 'HORA') ? 'btn-warning text-dark' : 'btn-outline-secondary'"
                      @click="nuevoAvance.tipo_periodo = 'DIA'; nuevoAvance.semana = 1">
                      <i class="bi bi-calendar-day me-1"></i> Por Días
                    </button>
                  </div>
                  <!-- Checkbox solo si es modo DIA/HORA -->
                  <div v-if="nuevoAvance.tipo_periodo === 'DIA' || nuevoAvance.tipo_periodo === 'HORA'" class="mt-2 text-end">
                    <div class="form-check form-switch d-inline-block">
                      <input class="form-check-input" type="checkbox" id="checkHoras" v-model="esPorHora">
                      <label class="form-check-label small text-muted cursor-pointer" for="checkHoras">¿Fraccionar por horas?</label>
                    </div>
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
                    <label class="form-label small">{{ labelUnidadTrabajo }}</label>
                    <input type="number" :step="esPorHora ? '1' : '0.5'" class="form-control" v-model="nuevoAvance.dias_trabajados" min="0" required
                      ref="inputDias" @keydown.enter.prevent="inputObs?.focus()">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label small">Observaciones Técnicas</label>
                  <textarea class="form-control" rows="2" v-model="nuevoAvance.observaciones"
                    ref="inputObs" @keydown.enter.prevent="fotoInput?.focus()"></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label small">Adjuntar Fotografías Técnicas (Máx 4, hasta 50MB c/u)</label>
                  <input type="file" id="fotoInput" ref="fotoInput" class="form-control mb-1 text-muted" accept=".png, .jpg, .jpeg, image/png, image/jpeg" multiple @change="onFileSelected"
                    @keydown.enter.prevent="navegarFotoAMaterial">
                  <div v-if="evidenciaFiles.length > 0" class="text-info small">
                    <i class="bi bi-image"></i> {{ evidenciaFiles.length }} foto(s) técnica(s) lista(s).
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label small">Adjuntar Facturas / Comprobantes (Máx 4, hasta 50MB c/u)</label>
                  <input type="file" id="facturaInput" class="form-control mb-1 bg-dark text-muted border-secondary" accept=".png, .jpg, .jpeg, image/png, image/jpeg" multiple @change="onFacturasSelected">
                  <div v-if="facturasFiles.length > 0" class="text-warning small mt-1">
                    <i class="bi bi-receipt"></i> {{ facturasFiles.length }} factura(s) lista(s) para anexar.
                  </div>
                </div>

                <!-- Materiales Option -->
                <div class="mb-3 p-2 border border-secondary border-opacity-50 rounded glass-panel">
                  <label class="form-label small d-flex justify-content-between align-items-center mb-2 fw-bold text-warning">
                    <span><i class="bi bi-box-seam me-1"></i> Materiales Utilizados</span>
                    <button type="button" class="btn btn-sm btn-outline-warning py-0 px-2" @click="agregarConsumoNuevo" title="Agregar Material">
                      <i class="bi bi-plus fw-bold"></i>
                    </button>
                  </label>
                  <div v-for="(cons, index) in nuevoAvance.consumos_materiales" :key="index" class="mb-3 p-2 rounded" style="background: rgba(0,0,0,0.15); border: 1px dashed rgba(255,255,255,0.2);">
                    <div class="d-flex justify-content-between align-items-center mb-2 gap-2">
                      <div class="search-dropdown-container w-100">
                        <input type="text" 
                          class="form-control form-control-sm bg-dark text-white border-secondary w-100"
                          placeholder="Buscar insumo o material..."
                          v-model="cons.busqueda"
                          :ref="(el) => setMaterialSearchRef(el, index)"
                          @focus="cons.showDropdown = true"
                          @blur="ocultarDropdown(index)"
                          @input="cons.highlightedIndex = -1"
                          @keydown.arrow-down.prevent="navegarDropdownAbajo(index)"
                          @keydown.arrow-up.prevent="navegarDropdownArriba(index)"
                          @keydown.enter.prevent="navegarBusquedaACantidad(index)"
                          required>
                        <ul v-if="cons.showDropdown" class="search-results-list shadow-lg custom-dropdown-width"
                          :ref="(el) => setDropdownListRef(el, index)">
                          <li v-for="(mat, matIdx) in materialesFiltradosPorFila(index)" 
                              :key="mat.descripcion" 
                              class="search-item"
                              :class="{ 'search-item-highlighted': cons.highlightedIndex === matIdx }"
                              @mousedown.prevent="seleccionarMaterial(index, mat)">
                            <span class="fw-bold">{{ mat.descripcion }}</span>
                            <span class="stock-tag ms-2 fw-normal text-warning">({{ mat.unidad }} - Disp: {{ mat.restante }})</span>
                          </li>
                          <li v-if="materialesFiltradosPorFila(index).length === 0" class="search-item text-muted text-center py-3">
                            <i class="bi bi-exclamation-circle me-1"></i> Sin resultados o stock agotado
                          </li>
                        </ul>
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-danger px-2 d-flex align-items-center" @click="nuevoAvance.consumos_materiales.splice(index, 1)" title="Eliminar material">
                        <i class="bi bi-trash3"></i>
                      </button>
                    </div>
                    
                    <div class="d-flex gap-2">
                      <div class="input-group input-group-sm flex-fill">
                        <span class="input-group-text bg-dark text-muted border-secondary px-2">Cant</span>
                        <input type="number" step="0.01" class="form-control bg-dark text-white border-secondary text-end px-2"
                          v-model="cons.cantidad_usada"
                          :max="obtenerRestanteNumerico(cons.nombre_material)"
                          :ref="(el) => setMaterialCantidadRef(el, index)"
                          @keydown.enter.prevent="navegarCantidadANuevoMaterial"
                          placeholder="0.00" required>
                      </div>
                      <div class="input-group input-group-sm flex-fill">
                        <span class="input-group-text bg-dark text-muted border-secondary px-2">Und</span>
                        <input type="text" class="form-control bg-dark text-white border-secondary text-center px-1" v-model="cons.unidad" readonly placeholder="-">
                      </div>
                      <div class="input-group input-group-sm flex-fill">
                        <span class="input-group-text bg-dark text-muted border-secondary px-2">Disp</span>
                        <input type="text" class="form-control bg-dark text-info border-secondary text-center px-1 fw-bold" :value="obtenerRestanteNumerico(cons.nombre_material) === 999999 ? '-' : obtenerRestanteNumerico(cons.nombre_material)" readonly>
                      </div>
                    </div>
                  </div>
                  <div v-if="nuevoAvance.consumos_materiales.length === 0" class="small text-muted fst-italic"><i class="bi bi-info-circle me-1"></i> Opcional: Registre los insumos consumidos.</div>
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

/* ── Searchable Dropdown ── */
.search-dropdown-container {
  position: relative;
  flex: 1;
}
.search-results-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%; /* Se adapta exactamente al ancho del input */
  z-index: 1000;
  background: #1a202c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  max-height: 250px;
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  padding: 0;
  list-style: none;
}
.search-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
  font-size: 0.85rem;
  color: #e2e8f0;
  
  /* Permitir que el texto largo (nombres de materiales) se acomode hacia abajo */
  white-space: normal;
  word-break: break-word;
  line-height: 1.4;
}
.search-item:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #fff;
}
/* Resaltado con teclado (flechas ↑↓) — distinto al hover */
.search-item-highlighted {
  background: rgba(59, 130, 246, 0.35) !important;
  color: #fff !important;
  border-left: 3px solid #3b82f6;
  padding-left: 9px; /* compensar border */
}
.search-item:last-child {
  border-bottom: none;
}
.search-item .stock-tag {
  font-size: 0.7rem;
  opacity: 0.7;
  margin-left: 8px;
}

/* Custom Scrollbar for Dropdown */
.search-results-list::-webkit-scrollbar {
  width: 6px;
}
.search-results-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}
.search-results-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.search-results-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Ocultar flechas spinners de inputs numéricos en los campos de materiales */
.input-group input[type="number"]::-webkit-inner-spin-button,
.input-group input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
.input-group input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
