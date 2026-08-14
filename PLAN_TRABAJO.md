# Plan de Trabajo — Guía COR · Redes IP (Web + Móvil)

> Documento de planificación basado en el diagnóstico exhaustivo del código
> (fecha: 2026-08-14). Objetivo: estabilizar la app actual y migrarla a una
> arquitectura de "workflow app" única cuya lógica sea compartida entre web y
> móvil, sin duplicar estados ni reglas.

---

## 1. Contexto y objetivo

La app actual es una PWA estática (HTML + ES Modules + Service Worker +
Firestore/localStorage) para la operación de redes IP de COR/CANTV. Se detectó:

- **Riesgo de seguridad crítico**: credenciales reales en texto plano servidas
  al navegador y precacheadas offline.
- **Login ficticio**: contraseña universal client-side (`redesip`/`admin`).
- **Bugs funcionales**: fechas inválidas del calendario, doble renderizado de
  navegación, incompatibilidad Safari en el resaltado de CLI.
- **UX desigual**: el tema oscuro se ve bien en móvil pero mal en escritorio
  (contraste de títulos, componentes sin override dark).
- **Deuda técnica**: código duplicado, código muerto, scripts de lint sin
  configuración, README vacío.

**Meta**: una sola "lógica principal" (núcleo agnóstico de dominio) que la web
y el móvil consuman igual, con tema dark/light consistente, auth real y sin
secretos en el repositorio.

---

## 2. Fases del plan

Cada fase tiene **prioridad** (P0/P1/P2), **entregable**, **criterio de
aceptación (DoD)** y **estimación** (S = ≤1d, M = 2–3d, L = 1–2 sem).

### Fase 0 — Bloqueo de seguridad inmediato (P0, S)
**Objetivo**: detener la fuga de credenciales hoy.

| # | Tarea | Entregable | DoD |
|---|-------|-----------|-----|
| 0.1 | Mover `data/credenciales.json` fuera del path de despliegue y gitignorarlo | Archivo en `_local_backup/`, entrada en `.gitignore` | El repo no contiene el archivo |
| 0.2 | Sanear `data/guia.json` (secciones 1.3, 1.4, 7.2): reemplazar credenciales por referencias (p. ej. `[[consultar gestor de secretos]]`) | `guia.json` sin secretos | `grep` de los patrones de credenciales da 0 en `data/` |
| 0.3 | Rotar todas las contraseñas expuestas (es tarea del equipo, no puede hacerla la app) | Ticket/lista de rotación | Correo de confirmación del equipo |
| 0.4 | Fortalecer `scripts/check-secrets.js` (patrones `Pass:`, `PWD:`, `Contraseña:`, claves JSON) y añadirlo como hook pre-commit | Script ampliado + hook | El script detecta los casos del diagnóstico |
| 0.5 | Eliminar avatar externo de CR7 en `auth.js` y datos personales innecesarios | `auth.js` saneado | Sin URLs externas ni PII superflua |

> ⚠️ La rotación (0.3) requiere decisión del equipo. Hasta rotarlas, las
> contraseñas ya filtradas en GitHub deben considerarse comprometidas.

### Fase 1 — Corrección de bugs funcionales (P0, M)
| # | Tarea | Archivo | DoD |
|---|-------|---------|-----|
| 1.1 | Corregir fechas inválidas del calendario del panel al cruzar mes/año | `js/modules/calendar.js` | Enero/Diciembre muestran días correctos y con evento |
| 1.2 | Eliminar doble render de navegación (guard en `hashchange`) | `js/app.js`, `js/state.js`, `js/modules/dashboard.js` | Un clic = un render (verificable con contador) |
| 1.3 | Eliminar lookbehind (Safari < 16.4) del resaltado CLI | `js/modules/navigation.js` | Resaltado funciona en Safari 15 |
| 1.4 | `start_url` relativo en manifest para cualquier despliegue | `manifest.json` | PWA instalable desde cualquier ruta |
| 1.5 | Revisar recordatorios CDC que se repiten tras recarga | `js/modules/cdc.js` | Los avisos no se duplican al refrescar |

### Fase 2 — Saneamiento UX / Tema oscuro en web (P1, M)
**Objetivo**: paridad visual web = móvil en dark y light.

| # | Tarea | DoD |
|---|-------|-----|
| 2.1 | Auditoría de contraste: buscar `color: var(--navy)` y colores duros (`#fff`, `#f7fafc`) usados como texto/fondo | Checklist de componentes con contraste ≥ 4.5:1 |
| 2.2 | Overrides `[data-theme="dark"]` para componentes sin cover (títulos, h3, tablas, code blocks, inputs del panel) | Matriz de 20 componentes probada en web y móvil |
| 2.3 | Tokenizar colores duros con variables (`--md-on-surface`, `--bg-card`, `--text-primary`) | `grep` de hex duros en `css/` = 0 para texto |
| 2.4 | Test de humo dark/light en Chrome + Safari + Android/iOS | Screenshots en ambos temas, ambas plataformas |

> Referencia de tokens en `css/style.css:4-108` (`:root` y `[data-theme="dark"]`).

### Fase 3 — Arquitectura "workflow app" única (P0, L)
**Objetivo**: implementar la lógica definida en `PROMPT_WORKFLOW_APP.md` como
núcleo agnóstico reutilizable por web y móvil.

| # | Tarea | Entregable | DoD |
|---|-------|-----------|-----|
| 3.1 | Definir el núcleo de dominio (`core/`): estado, modelos, casos de uso, reglas de negocio sin DOM | `core/` con API estable | La UI no contiene reglas de negocio |
| 3.2 | Adaptadores de persistencia: `localStorage` y Firestore con interfaz común | `core/adapters/` | Cambiar de backend no toca la UI |
| 3.3 | Re-hidratar módulos actuales (panel, guardia, mail, cdc, calendario) sobre el núcleo | Refactor módulo a módulo | Cada herramienta pasa su test de regresión |
| 3.4 | Compartir la lógica con la app móvil (misma API: `core.*` consumida por el shell web y el shell móvil) | Paquete compartido `core/` | Mismo fixture de tests pasa en ambos shells |
| 3.5 | Auth real: Firebase Auth o backend, sesión con token, roles desde backend | Servicio de auth | Sin contraseña universal; URL params no autentican |

### Fase 4 — Calidad y herramientas (P2, M)
| # | Tarea | Entregable | DoD |
|---|-------|-----------|-----|
| 4.1 | Configurar ESLint + Prettier + Stylelint (configs + `npm install`) | `.eslintrc.cjs`, `.prettierrc.json`, `.stylelintrc.json` | `npm run lint` y `npm run lint:css` pasan |
| 4.2 | Tests unitarios del núcleo (`node:test`) | `tests/` | Cobertura de casos de uso críticos (auth, cdc, guardia) |
| 4.3 | Eliminar código muerto (funciones de eventos Firestore sin uso) y duplicados (`updateImpacto`) | Refactor | `grep` de símbolos muertos = 0 |
| 4.4 | Completar README (despliegue, build, secretos) | README | Pasos verificables por otra persona |

### Fase 5 — Repositorio y despliegue (P1, M)
| # | Tarea | DoD |
|---|-------|-----|
| 5.1 | Inicializar git en la raíz, `.gitignore` completo, commit semántico por fase | Historial limpio, sin secretos |
| 5.2 | Crear/validar repo en GitHub y habilitar Pages (rama `main`, raíz `/`) | URL pública estable y `start_url` correcto |
| 5.3 | Verificar PWA en HTTPS (manifest, SW, instalación) | Lighthouse PWA ≥ 90 |
| 5.4 | Reglas de seguridad de Firestore (solo lectura pública de datos compartidos; escritura autenticada) | Reglas aplicadas y probadas |

---

## 3. Matriz de riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Credenciales filtradas usadas por terceros | Alta | Crítico | Rotación inmediata (0.3) + quitar del repo (0.1-0.2) |
| Regresión visual al tocar CSS | Media | Medio | Tokens + tests de humo (2.4) por PR |
| Refactor del núcleo rompe herramientas | Media | Alto | Migrar módulo a módulo con test de regresión (3.3) |
| Firestore sin reglas = datos mutables por cualquiera | Alta | Alto | Reglas de seguridad (5.4) |

---

## 4. Definición de "done" (por fase)

- **0**: `grep` de credenciales en `js/` y `data/` = 0 resultados; archivo movido y gitignored.
- **1**: `node --check` pasa en todos los archivos; repro de cada bug documentado en `DEBUG_PLAN.md` pasa.
- **2**: Matriz de componentes con contraste verificada en Chrome (web) y Chrome Android/iOS (móvil), dark y light.
- **3**: `core/` con tests verdes; la web y el shell móvil consumen la misma API.
- **4**: `npm run lint`, `lint:css` y `npm test` verdes.
- **5**: Site en HTTPS con Lighthouse PWA ≥ 90 y sin secretos en el historial.

---

## 5. Prioridad de ejecución recomendada

1. **Fase 0** (hoy) — no esperar: la fuga está activa.
2. **Fase 1** (hoy/mañana) — bugs verificables de bajo riesgo.
3. **Fase 2** (esta semana) — tema oscuro web.
4. **Fase 3** (2–3 semanas) — núcleo compartido web+móvil.
5. **Fase 4 y 5** — en paralelo según se estabilice.