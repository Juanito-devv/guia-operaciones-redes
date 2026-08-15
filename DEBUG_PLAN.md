# Plan de Debugging — Guía COR (Sólido y verificable)

> Plan de depuración priorizado. Cada bug tiene: **síntoma, cómo reproducirlo,
> causa raíz, fix y verificación**. Estado se actualiza al ejecutar
> (`PENDING / IN_PROGRESS / PASSED`). Se trabaja de P0 → P2.

---

## P0 — Bugs funcionales (bloqueantes de la UX)

### B1. Fechas inválidas en el calendario del panel al cruzar mes/año
- **Síntoma**: en enero, los días del mes anterior generan `YYYY-00-xx`; en
  diciembre, los del siguiente generan `YYYY-13-xx` (días "rotos", sin evento,
  al hacer clic se selecciona una fecha inválida).
- **Reproducir**: abrir el panel (Ctrl+.) → pestaña Calendario → navegar a
  Enero y a Diciembre y revisar las celdas grises de otros meses.
- **Causa raíz**: `js/modules/calendar.js:67-69` concatena mes 1-based con
  `month+2`/`month` sin ajustar el año. `calendar_tool.js:70-73` ya lo hace
  bien con `new Date(...)`.
- **Fix**: calcular la celda con `new Date(year, month ± 1, day)` y serializar
  la fecha real con `getFullYear/getMonth/getDate`.
- **Verificación**: en Enero y Diciembre todas las celdas tienen `YYYY-MM-DD`
  válido (`grep "2026-00\|2026-13"` en el DOM = 0) y marcan eventos/today.
- **Estado**: [x] PASSED (fix aplicado en `calendar.js` con `new Date(year, month±1, day)`)

### B2. Doble render de navegación (artículo se pinta dos veces)
- **Síntoma**: cada clic en una subsección re-renderiza el artículo dos veces
  (parpadeo del `.loading` y trabajo duplicado).
- **Reproducir**: DevTools → Performance, hacer clic en un enlace del sidebar y
  contar renderizados de `buildArticleView` (o romper con un `console.count`).
- **Causa raíz**: `navigation.js:164` setea `location.hash` y el handler
  `hashchange` (`app.js:210-237`) llama de nuevo a `navigateTo`.
- **Fix**: guard en `handleHashChange`: si la ruta ya está activa
  (`AppState.currentSectionId/currentSubsectionId`), no re-renderizar. Lo mismo
  para dashboard (token `currentDashboardTool`) y home (`isHomePage`).
- **Verificación**: 1 clic = 1 render (contador estable).
- **Estado**: [x] PASSED (guard en `navigateTo`, `handleHashChange` y `showDashboard`/`showHome`; token `currentDashboardTool`)

### B3. Contraste dark en web: títulos casi invisibles
- **Síntoma**: en escritorio con tema oscuro, el título del encabezado
  (`#content-title`) y los `h3` del contenido se ven azul-marino sobre fondo
  oscuro (contraste ≈ 1.5:1).
- **Reproducir**: tema oscuro + web → título "Bienvenido"/"Inicio" apenas
  legible.
- **Causa raíz**: `css/style.css:1301` y `:1741` usan `color: var(--navy)` que
  en dark vale `#004292`.
- **Fix**: override `[data-theme="dark"]` → `var(--text-primary)` en ambos.
- **Verificación**: título legible en dark (web), sin cambio en light.
- **Estado**: [x] PASSED (overrides `[data-theme="dark"]` en `style.css`)

### B4. Credenciales reales servidas al navegador
- **Síntoma**: `data/credenciales.json` (huérfano, sin uso) y secciones de
  `guia.json` (1.3, 1.4, 7.2) contienen contraseñas de producción en texto
  plano, precacheadas por el SW.
- **Reproducir**: abrir `.../data/credenciales.json` sin autenticación.
- **Causa raíz**: archivos estáticos públicos + contenido con secretos.
- **Fix (parcial inmediato)**: mover `credenciales.json` a `_local_backup/` +
  gitignore. **Decisión pendiente del equipo**: sanear `guia.json` y rotar
  credenciales.
- **Verificación**: `grep` de patrones en `js/` y `data/` = 0.
- **Estado**: [x] MITIGADO (parcial) / [ ] ROTACIÓN PENDIENTE — `credenciales.json`
  movido a `_local_backup/` y gitignore; `check-secrets.js` reforzado y bloqueando
  commits (12 credenciales reales detectadas en `guia.json`).

---

## P1 — Compatibilidad y robustez

### B5. Lookbehind rompe Safari < 16.4
- **Síntoma**: en Safari/iOS viejos, el resaltado CLI falla (SyntaxError en
  runtime) y no se ve código resaltado.
- **Reproducir**: abrir una subsección con `<pre><code>` en Safari 15.
- **Causa raíz**: `navigation.js:393` usa `(?<![\w.&])` (lookbehind).
- **Fix**: capturar el borde en el match y reconstruir:
  `.replace(/(^|[^\w.&])(\d+(?:\.\d+)*)(?![\w.&])/g, (m, pre, num) => pre + "<span>…</span>")`.
- **Verificación**: resaltado correcto en Safari 15 y Chrome.
- **Estado**: [x] PASSED (lookbehind reemplazado por captura de borde en `navigation.js`)

### B6. `start_url` absoluto en manifest
- **Síntoma**: PWA no instalable si se despliega en otra ruta que
  `/guia-operaciones-redes/`.
- **Causa raíz**: `manifest.json:5`.
- **Fix**: `"start_url": "./"`.
- **Verificación**: Lighthouse "installable" en el dominio real.
- **Estado**: [x] PASSED (`"start_url": "./"` en `manifest.json`)

### B7. Recordatorios CDC se repiten tras recarga
- **Síntoma**: al recargar la página, vuelven a salir los avisos de CDC ya
  mostrados.
- **Causa raíz**: `cdc.js:17-18` sets en memoria.
- **Fix**: persistir los IDs notificados (`cor_cdc_notified`) por
  `id+fecha+tipo` y filtrar al cargar.
- **Verificación**: recarga ≠ aviso duplicado.
- **Estado**: [x] PASSED (marcadores persistidos en `cor_cdc_notified` con poda de fechas pasadas)

---

## P2 — Calidad y deuda

- **B8. Scripts lint/format sin config**: crear `.eslintrc.cjs`,
  `.prettierrc.json`, `.stylelintrc.json`; `npm install`; hacer pasar
  `npm run lint`/`lint:css`.
- **B9. Código muerto**: funciones de eventos Firestore sin uso
  (`firebase.js:162-231`); eliminar o conectar. → **HECHO**: calendario
  conectado a Firestore (id de documento = id de evento + fusión offline).
- **B10. Código duplicado**: `updateImpacto`/`copyImpactoReport` en
  `panel.js:308-339` e `impacto.js:110-142` → unificar en `core/impacto`.
- **B11. `check-secrets.js` insuficiente**: añadir patrones `Pass:`, `PWD:`,
  `Contraseña:`, claves JSON (`"Password"`, `"PWD"`).
- **B12. Avatar de CR7 en `auth.js:21`**: quitar URL externa. → **HECHO**: `USERS_DB` usa avatares emoji, sin URLs externas.
- **B13. README vacío**: documentar despliegue, secretos, lint, tests. → **HECHO**: README completo (estructura, scripts, Firebase, despliegue, secretos).

---

## Matriz de verificación final

| Bug | Prioridad | Estado | Evidencia |
|-----|-----------|--------|-----------|
| B1 | P0 | PASSED | `calendar.js` usa `new Date(year, month±1, day)` |
| B2 | P0 | PASSED | Guards en `navigateTo`/`handleHashChange` + token `currentDashboardTool` |
| B3 | P0 | PASSED | Overrides dark en `style.css` |
| B4 | P0 | MITIGADO | `credenciales.json` → `_local_backup/`; scanner bloquea commits (rotación pendiente) |
| B5 | P1 | PASSED | `navigation.js` sin lookbehind |
| B6 | P1 | PASSED | `manifest.json` → `./` |
| B7 | P1 | PASSED | `cdc.js` marcadores persistidos (`cor_cdc_notified`) con poda de fechas pasadas |
| B8–B13 | P2 | B8/B9/B11/B12/B13 HECHO, B10 N/A, resto PENDING | Lint/format verdes; scanner reforzado; calendario conectado a Firestore; README y avatares saneados |