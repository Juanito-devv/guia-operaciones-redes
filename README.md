# Guía de Operaciones - Redes IP (COR)

Guía integral para la operación y mantenimiento de redes IP, agregadores, DSLAM, OLTs y enlaces internacionales de CANTV.

App web (PWA) con panel de trabajo: calendario de eventos, Control de Cambios (CDC), entrega de guardia, generador de correos a proveedores, notificaciones del equipo, impacto y perfil de usuario.

## 📁 Estructura del proyecto

```
├── core/               # Capa de dominio (servicios + adaptadores de almacenamiento)
│   ├── domain/         # lógica de negocio (auth, calendar, cdc, guardia, mail, notif…)
│   └── adapters/       # firestore, local-storage
├── js/
│   ├── modules/        # módulos de UI (dashboard, calendario, guardia, mail, perfil…)
│   └── utils/          # utilidades (storage, debounce, sanitize…)
├── data/               # contenido de la guía (guia.json) y datos de prueba
├── css/                # estilos
├── tests/              # tests unitarios (node:test)
├── scripts/            # utilidades de validación (check-secrets.js)
└── firestore.rules     # reglas de seguridad de Firestore
```

## 🔧 Desarrollo

```bash
npm install
npm run lint          # ESLint (js/ core/ tests/ scripts/)
npm run lint:css      # Stylelint (css/)
npm run test          # Tests unitarios (node --test)
npm run validate:security   # Verifica que no se filtren credenciales
```

## ☁️ Firebase

- **Proyecto**: `guia-cor` (Firestore). Las credenciales de la app están en `js/modules/firebase.js`.
- **Auth**: acceso anónimo habilitado en consola (Authentication → Anónimo → Habilitada).
- **Reglas**: las publicadas en `firestore.rules` (colecciones `cdc`, `events`, `custom_procedures`, `notifications` requieren `request.auth != null`). Publicarlas desde la consola:
  1. Firestore → Reglas → pegar el contenido de `firestore.rules` → Publicar.
- **Datos sincronizados**: eventos, CDC, procedimientos personalizados y notificaciones (compartidas); borradores de Guardia y Mail (por usuario).
- **Comportamiento offline**: si Firestore no está disponible, la app degrada a `localStorage` y sube automáticamente lo creado sin conexión al recuperar la conexión.

## 🚀 Despliegue (GitHub Pages)

1. Hacer push a la rama `main` del repo `Juanito-devv/guia-operaciones-redes`.
2. GitHub Pages publica automáticamente desde `main` (Settings → Pages → source `main`).
3. Sitio: https://juanito-devv.github.io/guia-operaciones-redes/

> La rama local de desarrollo es `master`; se publica con `git push origin master:main`.

## 🔐 Secretos

- `data/credenciales.json` (credenciales reales) se movió a `_local_backup/` y está en `.gitignore`.
- El scanner `scripts/check-secrets.js` corre como hook de pre-commit y **bloquea** commits que contengan patrones de credenciales (12 reales detectadas en `guia.json`).
- **Pendiente**: rotar esas credenciales en producción (decisión del equipo de administración de red).