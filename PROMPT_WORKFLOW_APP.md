# Prompt: Workflow App "CONNECT — Guía COR" (Web + Móvil)

> Este prompt describe **la lógica principal** de la aplicación, agnóstica de
> plataforma. La misma lógica alimentará la versión web (PWA) y la versión
> móvil. Úsalo tal cual como especificación para generar/refactorizar el
> código: el 90 % del esfuerzo debe estar en `core/` (sin DOM), y los shells
> web/móvil solo deben **consumir** esa lógica.

---

## 1. Misión

Construir un **workflow operativo único** para el Centro de Operaciones de Red
(COR) de redes IP: una guía de operaciones + espacio de trabajo (calendario,
CDC, guardia 5 mensajes Telegram, generador de correos, calculadora de impacto,
perfil y ajustes). Debe funcionar **igual** en navegador de escritorio, web
móvil y app instalada (PWA), con tema oscuro/claro consistente.

## 2. Restricciones y stack (definido)

- **Frontend web**: HTML + CSS (variables/tokens) + ES Modules nativos. Sin
  frameworks de UI (o solo el que ya exista). Service Worker para offline.
- **Lógica compartida**: módulo `core/` en JavaScript ESM puro, **sin
  dependencias del DOM**, con API síncrona/async clara. Tanto el shell web como
  el shell móvil importan la **misma** `core/`.
- **Persistencia**: adaptadores con interfaz única → `localStorage`
  (offline/fallback) y Firestore (nube en vivo). El `core` elige el adaptador
  por disponibilidad y degrada con aviso (bandera `degraded`).
- **Auth**: real (Firebase Auth o backend). Prohibido: contraseñas hardcodeadas,
  auto-login por URL, roles definidos solo en el cliente.
- **Secretos**: ninguno en el repo. Las credenciales de operación NO viven en el
  frontend; se referencian desde un gestor externo.
- **Móvil**: mismo `core/`, distinto shell; la navegación se adapta
  (bottom-nav vs sidebar) pero los estados y reglas son idénticos.

## 3. Arquitectura (capas)

```
core/                     ← lógica principal (todo esto)
  state.js                 estado observable centralizado (única fuente de verdad)
  domain/                  modelos y reglas de negocio por módulo
    auth.service.js        sesión, login, roles (contra backend)
    guide.service.js       guía + procedimientos colaborativos (merge local+nube)
    calendar.service.js    eventos (CRUD, reglas de fechas)
    cdc.service.js         controles de cambio (estados, recordatorios 1h/fin)
    guardia.service.js     entrega de guardia 5 mensajes (plantillas, estados ✅⚠️❌)
    mail.service.js        generador de correos (plantillas por proveedor)
    impacto.service.js     calculadora de impacto
    notif.service.js       notificaciones (crear, leer, borrar, badge)
    settings.service.js    tema, acento, densidad (tokens)
  adapters/                interfaces de persistencia (localStorage / firestore)
  errors.service.js        log de errores + reporte
shell-web/                 app web actual (render, eventos DOM, navegación)
shell-mobile/              app móvil (mismo core, shell propio)
```

Reglas de oro:
1. **La UI nunca calcula reglas de negocio**; solo llama a `core.*` y renderiza.
2. **`core/state` es la única fuente de verdad**; los shells leen estado y
   escuchan cambios (patrón observable), nunca duplican estado.
3. **Eventos**: el core emite eventos tipados (`cdc.created`, `event.added`,
   `auth.expired`, `sync.degraded`) y la UI reacciona una sola vez.
4. **Persistencia**: la UI escribe a través de `core`; nunca toca
   localStorage/Firestore directamente.

## 4. Modelo de datos (esquemas)

```jsonc
// Sesión
{ "user": "jiraza01", "expires": 1723000000000, "token": "…", "role": "user" }

// Guía (leída de data/guia.json)
{ "title": "…", "version": "1.0.0", "sections": [
   { "id": "…", "title": "…", "icon": "…", "subsections": [
      { "id": "…", "title": "…", "content": "<html sanitizado>" } ] } ] }

// Procedimiento colaborativo (nube + local merge)
{ "id": "…", "sectionId": "…", "subId": "custom_…", "title": "…",
  "content": "…", "author": "…", "updatedAt": "ISO" }

// Evento
{ "id": "…", "title": "…", "date": "YYYY-MM-DD", "time": "HH:mm",
  "author": "…", "color": "…", "desc": "…" }

// CDC
{ "id": "…", "title": "…", "date": "YYYY-MM-DD", "time": "HH:mm",
  "status": "programado|ejecucion|completado|cancelado",
  "duration": 2, "author": "…", "color": "…", "desc": "…" }

// Guardia (auto-guardado por navegador)
{ "usuario": "…", "hora": "HH:mm", "ixpAlerta": "…", "ixpItems": [{name,status}],
  "enlacesVariaciones": "…", "enlacesItems": […], "oltTickets": "…",
  "oltItems": […], "abatvItems": […], "tProceso": "…", "tSeguimiento": "…",
  "tResueltos": "…", "enableSeguimiento": true, "enableResueltos": true }

// Notificación
{ "id": "…", "title": "…", "message": "…", "type": "cdc|guide|warning|mail|system",
  "author": "…", "createdAt": "ISO", "readBy": ["usuario", …] }
```

## 5. Casos de uso críticos (reglas que el core DEBE cumplir)

1. **Auth**: validar sesión, expiración, cambiar de usuario; los roles se
   verifican en backend; el cliente solo muestra/oculta según rol.
2. **Guía**: cargar `guia.json` con timeout (20 s) y estado de error con
   reintento; navegar por `section/subsection`; deep links `#/section/sub` y
   `#/dashboard/<tool>`.
3. **Procedimientos colaborativos**: CRUD; fusionar procedimientos locales +
   Firestore en tiempo real; marcar autor/`LOCAL` cuando no hay nube.
4. **Calendario**: CRUD de eventos; **fechas válidas a través de cruces de
   mes/año** (regresión conocida: usar `new Date(y, m, d)` y serializar
   `YYYY-MM-DD` real, nunca meses 0/13); marcar hoy, eventos y CDC en el día.
5. **CDC**: CRUD con estados; **recordatorios idempotentes** (a 1 h y a
   finalización) sin repetirse tras recarga (persistir marcadores por id+fecha);
   página completa con filtros/búsqueda y modales.
6. **Guardia (5 mensajes Telegram)**: plantillas por mensaje; estados
   ✅→⚠️→❌; auto-guardado; copiar mensaje individual o combo; mismas reglas en
   panel y página completa (mismo `core`, raíz/scope distinto para no chocar IDs).
7. **Mail**: plantillas por proveedor con variables `{circuito}`, `{afectacion}`,
   `{hora}`, `{ticket}`, `{proveedor}`; preview en vivo; auto-guardado por proveedor.
8. **Impacto**: generar texto de impacto a partir de equipo/tipo/capacidad/
   afectación; copiar al portapapeles.
9. **Notificaciones**: crear/leer/borrar; badge de no leídas **por usuario**;
   borrar todo restringido (solo lo que el usuario puede borrar).
10. **Ajustes**: tema (oscuro por defecto), acento, densidad; persistir y
    aplicar en ambos shells.

## 6. Reglas de navegación y estados de pantalla

- Pantallas: `login → launcher → app`. El launcher es un **HUB de módulos** que
  se muestra **SIEMPRE tras el login** (web y móvil), nunca se salta: el analista
  elige dónde entrar primero.
- **Cada módulo tiene su propio espacio**: página completa en
  `#/dashboard/<tool>` (Calendario, CDC, Guardia, Mail, Impacto, Perfil,
  Ajustes). El panel lateral `Ctrl+.` es un **acceso rápido** superpuesto, NO la
  vista principal ni un reemplazo de la página del módulo.
- Móvil: bottom-nav `Inicio · Guía · Espacio · Ajustes`; desde "Espacio" se
  abre el dashboard con las tarjetas de cada módulo.
- Escritorio: sidebar + contenido; panel de trabajo lateral `Ctrl+.`.
- **Sidebar (S19)**: único origen de navegación web; accesible desde "Inicio" y
  colapsable a iconos (toggle persistente). NUNCA botones flotantes que abran
  módulos: el acceso al Espacio de Trabajo vive en el sidebar y en el home.
  "➕ Agregar Procedimiento" abre el modal de procedimientos (solo admin).
- **Retroceso**: cada página de módulo (`#/dashboard/<tool>`) tiene una acción
  "Volver al dashboard" (botón o breadcrumb clicable); no dejar al usuario sin
  salida dentro de un módulo.
- Deep links resueltos por un **único router**; evitar doble render: si el
  hash apunta a la ruta ya activa, no re-renderizar.
- Estados de apoyo: error de carga (Reintentar), acceso denegado, degradación
  de sincronización (banner visible).

## 7. Sistema de diseño (tokens compartidos web+móvil)

- `:root` = tema claro; `[data-theme="dark"]` = oscuro (override de variables).
- **Prohibido colores duros** en componentes; siempre tokens:
  `--bg-primary`, `--bg-card`, `--text-primary`, `--text-secondary`,
  `--text-muted`, `--border-color`, `--accent`, `--md-on-surface`,
  `--md-surface-container`, `--radius`, `--font`, `--mono`, `--navy`.
- Contraste mínimo 4.5:1; en dark NO usar `--navy` como color de texto.
- Densidad `comfortable`/`compact` vía clase `density-compact`.

## 8. Persistencia y sincronización

- Adaptador `localStorage` (claves con prefijo `cor_*`) y adaptador Firestore
  con `onSnapshot` en vivo.
- Degradación: si Firestore falla → `localStorage` + evento
  `sync.degraded`; al recuperar → `sync.recovered`. Las entidades guardadas
  en local llevan marcador `id: "local_…"` visible en la UI.
- Firestore: colecciones `cdc`, `events`, `custom_procedures`, `notifications`
  con **reglas de seguridad** (escritura autenticada; lectura según rol).

## 9. Seguridad (obligatorio)

- Sin secretos en el repo; `data/credenciales.json` queda fuera del despliegue.
- Sin contraseñas universales; auth real; expiración de sesión.
- Sanitización de HTML con lista blanca antes de inyectar contenido de la guía
  o de procedimientos colaborativos.
- Escape de texto en toda interpolación dinámica.
- `check-secrets` ampliado y ejecutado pre-commit.

## 10. Criterios de aceptación (end-to-end)

1. `npm run lint`, `lint:css` y `npm test` en verde.
2. La web (escritorio + móvil) y la app instalada muestran **el mismo
   comportamiento** ante: crear/editar/borrar evento y CDC, guardia 5 mensajes,
   mail, impacto, notificaciones y ajustes.
3. Tema oscuro consistente en web: sin texto `--navy` sobre fondo oscuro, sin
   tarjetas blancas en modo oscuro.
4. Sin credenciales en el repo; `grep` de patrones de secretos = 0.
5. Deep links, PWA offline y degradación con banner funcionan.
6. Regresión: los bugs listados en `DEBUG_PLAN.md` quedan marcados como
   `PASSED` con su evidencia.

## 11. Entregables del generador/refactor

- `core/` completo con tests (cada caso de uso crítico de la sección 5).
- Shells web y móvil conectados al mismo `core/` (sin reglas en la UI).
- `PLAN_TRABAJO.md` y `DEBUG_PLAN.md` actualizados tras cada fase.
- Commit por fase con mensaje semántico.

## 12. Diseño visual para el generador (Figma / v0 / similar)

> Esta sección es para quien genera el **diseño visual** (layout + CSS + PNG).
> La lógica ya está especificada arriba; aquí se define el "cómo se ve".

### 12.1 Pantallas a diseñar (web + móvil)

| # | Pantalla | Layout |
|---|----------|--------|
| S1 | Login | Centrado, card en el medio, toggle de ver contraseña |
| S2 | Launcher-HUB (post-login, web+móvil) | "Hola, \<nombre\>" + grid de tarjetas de módulo: Guía · Calendario · CDC · Guardia (5 Msg) · Mail · Impacto · Perfil · Ajustes. Actividad reciente al pie. Grid 2 col (móvil) / 4 col (escritorio). **SIEMPRE visible tras login** (consistente en web y móvil) |
| S3 | Inicio (home) | Hero + bento grid (ya existe, mantener identidad) |
| S4 | Guía (artículo) | Header con eyebrow + título + breadcrumb, contenido tipográfico + TOC lateral (escritorio), prev/next al pie |
| S5 | Dashboard (Espacio de Trabajo) | Hero + rejilla de tarjetas de módulos (grid 1/2/4 col) + métricas |
| S6 | Panel de trabajo lateral | Drawer derecho Ctrl+. con tabs: Mapa · Calendario · CDC · Guardia · Mail · Impacto |
| S7 | Módulo Calendario (página completa) | Toolbar del módulo (título + mes + botón nuevo) + grid mensual + lista de eventos del día |
| S8 | Módulo CDC (página completa) | Toolbar (título + filtros + búsqueda + nuevo) + tabla/kanban por estado + aviso de recordatorios |
| S9 | Módulo Guardia (página completa) | 5 tarjetas de mensaje con plantillas, estados ✅⚠️❌, auto-guardado, copiar individual/combo |
| S10 | Módulo Mail (página completa) | Selector de proveedor + formulario de variables + preview en vivo + copiar |
| S11 | Módulo Impacto (página completa) | Formulario equipo/tipo/capacidad/afectación + texto generado + copiar |
| S12 | Módulo Perfil (página completa) | Avatar, datos del usuario, rol, cambio de contraseña, preferencias |
| S13 | Módulo Ajustes (página completa) | Tema (dark/light), acento, densidad |
| S14 | Notificaciones | Campana + drawer de lista con badge de no leídas por usuario |
| S15 | Detalle de CDC | Vista de un cambio: info + estado + acciones + historial |
| S16 | Detalle de evento | Modal con info + acciones |
| S17 | Búsqueda global | Overlay Ctrl+K con resultados en vivo (guía + módulos) |
| S18 | Estados de apoyo | Carga (loading), error con Reintentar, acceso denegado, vacío (empty), banner degradación |
| S19 | Sidebar de navegación (web) | Panel izquierdo colapsable: toggle dark_mode + search "Buscar secciones… Ctrl+K" + "➕ Agregar Procedimiento" (solo admin) + "Espacio de Trabajo" + secciones 1–7 de la Guía con chevrons + perfil ("👑 Admin" o "👷 Operador") + logout |

> **Anatomía común de página de módulo** (S7–S13): header propio (eyebrow +
> título + acciones: nuevo/buscar/exportar) + contenedor de contenido + estados
> (loading/vacío/error). Cada módulo vive en su URL `#/dashboard/<tool>`; desde
> cualquier pantalla se llega a su página completa, y el panel lateral
> (`Ctrl+.`) es solo un acceso rápido superpuesto.

### 12.2 Sistema de diseño (obligatorio para el CSS exportado)

- **Colores**: SOLO tokens, nunca hex fijos en componentes. Mapeo de referencia:
  - Fondo app: `var(--bg-primary)` · tarjetas: `var(--bg-card)` / `var(--md-surface-container)`
  - Texto: `var(--text-primary)` / `var(--text-secondary)` / `var(--text-muted)`
  - Líneas: `var(--border-color)` · acento: `var(--accent)` · danger: `var(--md-error)` / rojo `#ef4444`
  - En dark **nunca** `var(--navy)` como color de texto.
- **Tipografía**: títulos `var(--heading)` (Hanken Grotesk), mono `var(--mono)` (JetBrains Mono), base 16px/1.7.
- **Espaciado**: escala 4px (4/8/12/16/24/32). Radio: 8–12px cards, 9999px pills/badges.
- **Sombra**: sutiles, `box-shadow` con canal alpha, no colores planos.
- **Densidad**: reglas bajo `.density-compact` para reducir padding/typo.
- **Responsive**: móvil (bottom-nav + contenido apilado) y escritorio (sidebar + contenido + panel lateral). Breakpoints ya existentes en `style.css`.
- **Tema oscuro**: el CSS exportado debe declarar variantes `[data-theme="dark"] .selector { … }` (o usar tokens que cambian solos). Si la herramienta solo da hex, entregar la paleta y la equivalencia de tokens, no el hex crudo.

### 12.3 Componentes y sus estados

- Botones: `btn` primario/accent, secundario (outline), danger, disabled, loading.
- Cards de herramienta: icono + título + descripción + CTA (con variante "error" con badge).
- Tabs del panel: activo con línea/subrayado de acento.
- Listas (eventos, CDC, notif): item con icono de estado, hover, unread marcado.
- Modales: overlay + card, header con título y cierre, acciones.
- Badges: pill, con color por tipo (cdc/guide/warning/mail/system).
- Inputs/selects: borde `--border-color`, focus con anillo de acento.
- Tabla de contenidos (TOC): sticky a la derecha, item activo resaltado.

### 12.4 Entregables del generador visual

- CSS usando SOLO tokens (o paleta + tabla de mapeo a tokens).
- PNG exportado por pantalla (móvil y escritorio, dark y light) como referencia.
- Alturas/medidas concretas para espaciado y radio (escala 4px).
- Nota de qué parte del layout corresponde a `core/` (no dibujar lógica, solo UI).

---

> **Instrucción final para la IA/generador**: no reescribas la UI de cero
> mientras no se migre cada herramienta al core; hazlo módulo a módulo y corre
> los tests de regresión del `DEBUG_PLAN.md` antes de cada merge.