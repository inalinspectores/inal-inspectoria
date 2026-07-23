// Configuración compartida de conexión a Supabase
const SUPABASE_URL = "https://fvkrbhgfnukwfjhxzsui.supabase.co";
const SUPABASE_KEY = "sb_publishable_0VtJBoD9L844nvAM7FWxuA_kXnTKIO4";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Redirige a login.html si no hay sesión activa. Usar en todas las páginas
// internas (no en index.html).
async function exigirSesion() {
  const { data } = await client.auth.getSession();
  if (!data.session) {
    window.location.href = "index.html";
    return null;
  }
  return data.session;
}

// Etiquetas legibles para los tipos de evento
const TIPOS_EVENTO = [
  ["INSPECCION_PRESENCIAL", "Inspección presencial"],
  ["INSPECCION_VIRTUAL", "Inspección virtual"],
  ["SUBSANACION", "Subsanación"],
  ["DOCUMENTACION_ADICIONAL", "Documentación adicional"],
  ["CLAUSURA_PREVENTIVA", "Clausura preventiva"],
  ["CLAUSURA_DEFINITIVA", "Clausura definitiva"],
  ["HACCP", "HACCP"],
  ["BPM", "BPM"],
  ["MONITOREO", "Monitoreo"],
  ["OTRO", "Otro"]
];

function etiquetaTipoEvento(valor) {
  const encontrado = TIPOS_EVENTO.find(t => t[0] === valor);
  return encontrado ? encontrado[1] : valor;
}

function requiereOI(tipo) {
  return ['INSPECCION_PRESENCIAL', 'INSPECCION_VIRTUAL', 'HACCP', 'BPM', 'MONITOREO'].includes(tipo);
}

function etiquetaTipoDocumento(tipo) {
  if (tipo === 'EXPEDIENTE') return 'Expediente - GDE';
  if (tipo === 'SIFEGA') return 'Trámite - SIFeGA';
  if (tipo === 'OTRO') return 'OTROS';
  return tipo;
}

// Convierte "dd/mm/yyyy" (texto libre) a "yyyy-mm-dd" para guardar en la base.
// Devuelve null si el formato no es válido.
function convertirFechaTextoAISO(texto) {
  if (!texto) return null;
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dia = m[1].padStart(2, '0');
  const mes = m[2].padStart(2, '0');
  const anio = m[3];
  return anio + '-' + mes + '-' + dia;
}

// Convierte "HH:MM" (texto libre) a algo que Postgres entienda; valida formato básico.
function validarHoraTexto(texto) {
  if (!texto) return true; // opcional
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(texto.trim());
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "-";
  const soloFecha = fechaISO.split("T")[0]; // por si viene con hora incluida
  const partes = soloFecha.split("-");
  if (partes.length !== 3) return fechaISO;
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function formatearHora(horaSQL) {
  if (!horaSQL) return "-";
  return horaSQL.slice(0, 5); // "21:34:00" -> "21:34"
}

function idAmigableCarpeta(carpeta) {
  if (!carpeta.numero_secuencial) return carpeta.id;
  return "carpeta-" + String(carpeta.numero_secuencial).padStart(4, "0");
}

// Carga la lista de inspectores (son pocos, ~10) en un <select>
async function cargarInspectoresEnSelect(selectEl, placeholder) {
  const { data, error } = await client.from('inspector').select('*').order('nombre');
  selectEl.innerHTML = "";
  const opcionVacia = document.createElement('option');
  opcionVacia.value = "";
  opcionVacia.textContent = placeholder || "Seleccionar...";
  selectEl.appendChild(opcionVacia);
  if (!error && data) {
    data.forEach(insp => {
      const op = document.createElement('option');
      op.value = insp.id;
      op.textContent = insp.nombre;
      selectEl.appendChild(op);
    });
  }
}

// --- Modo administrador (debug) ---
function activarModoDebug() { sessionStorage.setItem('modoDebug', '1'); }
function desactivarModoDebug() { sessionStorage.removeItem('modoDebug'); }
function estaEnModoDebug() { return sessionStorage.getItem('modoDebug') === '1'; }

function pedirAccesoDebug() {
  if (estaEnModoDebug()) {
    desactivarModoDebug();
    window.location.reload();
    return;
  }
  const pass = prompt('Contraseña de administrador:');
  if (pass === null) return;
  if (pass === 'INAL2026') {
    activarModoDebug();
    window.location.href = 'home.html';
  } else {
    alert('Contraseña incorrecta.');
  }
}

// SIFEGA/OTRO ahora se tratan igual que EXPEDIENTE, sin bloqueo.
const TIPOS_DOCUMENTO = ['EXPEDIENTE', 'SIFEGA', 'OTRO'];

// Crea un bloque de carga de documento (tipo + número + link de Drive) dentro de un contenedor.
// Devuelve el elemento del bloque, para poder leer sus valores después.
function crearBloqueDocumento(contenedor, valores) {
  valores = valores || {};
  const bloque = document.createElement('div');
  bloque.className = 'box';
  bloque.style.padding = '14px 16px';
  bloque.style.marginTop = '10px';
  bloque.innerHTML = `
    <label>Tipo</label>
    <select class="doc_tipo">
      <option value="EXPEDIENTE">Expediente - GDE</option>
      <option value="SIFEGA">Trámite - SIFeGA</option>
      <option value="OTRO">OTROS</option>
    </select>
    <label class="doc_numero_label">Número</label>
    <input type="text" class="doc_numero" placeholder="EX-0000-00000000- -APN-INAL#ANMAT">
    <label>Carpeta de Google Drive (opcional)</label>
    <input type="url" class="doc_drive" placeholder="https://drive.google.com/drive/folders/...">
    <button type="button" class="secundario chico doc_quitar">Quitar documento</button>
  `;
  bloque.querySelector('.doc_tipo').value = valores.tipo || 'EXPEDIENTE';
  bloque.querySelector('.doc_numero').value = valores.numero || '';
  bloque.querySelector('.doc_drive').value = valores.drive_folder_url || '';
  bloque.querySelector('.doc_quitar').onclick = () => bloque.remove();

  function actualizarSegunTipo() {
    const tipo = bloque.querySelector('.doc_tipo').value;
    const label = bloque.querySelector('.doc_numero_label');
    const input = bloque.querySelector('.doc_numero');
    if (tipo === 'OTRO') {
      label.textContent = 'Descripción';
      input.placeholder = 'Ej: Nota interna sobre cambio de domicilio';
    } else {
      label.textContent = 'Número';
      input.placeholder = 'EX-0000-00000000- -APN-INAL#ANMAT';
    }
  }
  bloque.querySelector('.doc_tipo').addEventListener('change', actualizarSegunTipo);
  actualizarSegunTipo();

  contenedor.appendChild(bloque);
  return bloque;
}

function leerBloquesDocumento(contenedor) {
  return Array.from(contenedor.querySelectorAll(':scope > .box')).map(b => ({
    tipo: b.querySelector('.doc_tipo').value,
    numero: b.querySelector('.doc_numero').value.trim(),
    drive_folder_url: b.querySelector('.doc_drive').value.trim() || null
  })).filter(d => d.numero);
}

// --- Detección de empresas similares ---
// Sigue una serie de reglas pensadas para errores típicos de tipeo
// (puntos/comas de más o de menos, alguna letra mal escrita).
function primerasNLetras(s, n) {
  return (s || '').trim().toLowerCase().slice(0, n);
}
function palabraEnPosicion(s, idx) {
  const palabras = (s || '').trim().toLowerCase().split(/\s+/);
  return palabras[idx] || null;
}
function quitarPuntos(s) {
  return (s || '').replace(/\./g, '').trim().toLowerCase();
}

async function buscarEmpresaCandidata(nombreIngresado) {
  const { data: empresas } = await client.from('empresa').select('id, nombre');
  if (!empresas || !empresas.length) return null;

  let candidatos = empresas.filter(e => primerasNLetras(e.nombre, 4) === primerasNLetras(nombreIngresado, 4));
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];

  const primeraPalabraIngresada = palabraEnPosicion(nombreIngresado, 0);
  let filtroPrimeraPalabra = candidatos.filter(e => palabraEnPosicion(e.nombre, 0) === primeraPalabraIngresada);
  if (filtroPrimeraPalabra.length === 1) return filtroPrimeraPalabra[0];
  if (filtroPrimeraPalabra.length > 1) candidatos = filtroPrimeraPalabra;

  const segundaPalabraIngresada = palabraEnPosicion(nombreIngresado, 1);
  if (segundaPalabraIngresada) {
    let filtroSegundaPalabra = candidatos.filter(e => palabraEnPosicion(e.nombre, 1) === segundaPalabraIngresada);
    if (filtroSegundaPalabra.length === 1) return filtroSegundaPalabra[0];
    if (filtroSegundaPalabra.length > 1) candidatos = filtroSegundaPalabra;
  }

  const ingresadoSinPuntos = quitarPuntos(nombreIngresado);
  const filtroSinPuntos = candidatos.filter(e => quitarPuntos(e.nombre) === ingresadoSinPuntos);
  if (filtroSinPuntos.length === 1) return filtroSinPuntos[0];

  return null; // no se pudo determinar un único candidato con confianza
}
// Busca una Orden de Inspección por número; si no existe, la crea.
// Devuelve el id de la orden_inspeccion.
async function obtenerOCrearOI(numero_oi, fecha, hora, ubicacion) {
  if (!numero_oi) return null;

  const { data: existente } = await client
    .from('orden_inspeccion')
    .select('*')
    .eq('numero_oi', numero_oi)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: nueva, error } = await client
    .from('orden_inspeccion')
    .insert({ numero_oi, fecha, hora, ubicacion })
    .select()
    .single();

  if (error) throw error;
  return nueva.id;
}
