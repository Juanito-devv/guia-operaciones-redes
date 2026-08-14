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

- Pantallas: `login → launcher (móvil) | app directa (escritorio) → app`.
- Móvil: bottom-nav `Inicio · Guía · Espacio · Ajustes`.
- Escritorio: sidebar + contenido; panel de trabajo lateral `Ctrl+.`.
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

---

> **Instrucción final para la IA/generador**: no reescribas la UI de cero
> mientras no se migre cada herramienta al core; hazlo módulo a módulo y corre
> los tests de regresión del `DEBUG_PLAN.md` antes de cada merge.