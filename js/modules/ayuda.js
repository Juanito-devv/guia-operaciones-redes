// ========================================
// AYUDA MODULE — Cómo usar la página (#/ayuda)
// Documentación estática de la aplicación: cómo navegar la guía, el espacio
// de trabajo, la búsqueda, notificaciones y quién edita los contenidos.
// El contenido de la guía en sí NO se edita desde aquí: el admin lo actualiza
// manualmente en data/guia.json (ver sección "¿Quién edita la guía?").
// ========================================

import { AppState } from '../state.js';
import { navigateTo } from './navigation.js';
import { escapeHtml } from '../utils/sanitize.js';

/**
 * Construye el índice jerárquico de la guía (secciones + subsecciones) con
 * enlaces navegables, para que la documentación muestre cada segmento real.
 */
function buildGuideIndex() {
    const guiaData = AppState.get('guiaData');
    if (!guiaData || !Array.isArray(guiaData.sections) || guiaData.sections.length === 0) {
        return '<p class="ayuda-empty">No hay datos de la guía disponibles.</p>';
    }

    return guiaData.sections.map((section) => {
        const subs = (section.subsections || [])
            .map((sub) => `
                <li>
                    <a class="ayuda-sub-link" href="#" data-section="${escapeHtml(section.id)}" data-subsection="${escapeHtml(sub.id)}">
                        <span class="material-symbols-outlined" aria-hidden="true">article</span>
                        <span>${escapeHtml(sub.title)}</span>
                    </a>
                </li>`)
            .join('');

        return `
            <div class="ayuda-seg">
                <h4>
                    <span class="ayuda-seg-icon" aria-hidden="true">${escapeHtml(section.icon || '📄')}</span>
                    <span>${escapeHtml(section.title)}</span>
                </h4>
                <ul class="ayuda-sub-list">${subs}</ul>
            </div>`;
    }).join('');
}

/**
 * Página completa de Ayuda (#/ayuda): documentación de cómo usar la app.
 * No depende de la guía (siempre funciona), pero si hay datos los muestra.
 */
export function showAyuda() {
    AppState.set('isHomePage', false);
    AppState.set('currentView', 'ayuda');
    AppState.set('currentSectionId', null);
    AppState.set('currentSubsectionId', null);
    AppState.set('currentDashboardTool', null);

    const body = document.getElementById('content-body');
    const titleEl = document.getElementById('content-title');
    const breadcrumb = document.getElementById('breadcrumb');
    if (!body) return;

    titleEl.textContent = 'Ayuda';
    breadcrumb.innerHTML = `<a href="#" data-bc="home">Inicio</a><span>Ayuda</span>`;
    breadcrumb.style.display = 'block';

    body.classList.add('loading');

    setTimeout(() => {
        body.innerHTML = `
            <div class="tool-page ayuda-page">
                <header class="tool-page-header">
                    <div>
                        <p class="tool-eyebrow"><span class="material-symbols-outlined" aria-hidden="true">help</span> Ayuda</p>
                        <h1 class="tool-title">¿Cómo funciona esta página?</h1>
                        <p class="tool-sub">Guía de uso de la aplicación COR: cómo navegar la guía de operaciones, qué encontrarás en el Espacio de Trabajo, cómo buscar y recibir notificaciones.</p>
                    </div>
                </header>

                <nav class="ayuda-index" aria-label="Índice de ayuda">
                    <a href="#ayuda-acceso" class="ayuda-index-card">
                        <span class="material-symbols-outlined" aria-hidden="true">login</span>
                        <strong>Acceso y Launcher</strong>
                        <small>Cómo entrar y elegir entre Guía o Espacio de Trabajo</small>
                    </a>
                    <a href="#ayuda-guia" class="ayuda-index-card">
                        <span class="material-symbols-outlined" aria-hidden="true">menu_book</span>
                        <strong>La Guía</strong>
                        <small>Secciones, navegación, código y búsqueda interna</small>
                    </a>
                    <a href="#ayuda-espacio" class="ayuda-index-card">
                        <span class="material-symbols-outlined" aria-hidden="true">work</span>
                        <strong>Espacio de Trabajo</strong>
                        <small>CDC, guardia, mail, calendario, impacto y más</small>
                    </a>
                    <a href="#ayuda-busqueda" class="ayuda-index-card">
                        <span class="material-symbols-outlined" aria-hidden="true">search</span>
                        <strong>Búsqueda global</strong>
                        <small>Ctrl+K para encontrar secciones y módulos</small>
                    </a>
                    <a href="#ayuda-notificaciones" class="ayuda-index-card">
                        <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
                        <strong>Notificaciones</strong>
                        <small>Campana, alertas sin leer y mensajes de guardia</small>
                    </a>
                    <a href="#ayuda-edicion" class="ayuda-index-card">
                        <span class="material-symbols-outlined" aria-hidden="true">edit_note</span>
                        <strong>¿Quién edita la guía?</strong>
                        <small>El admin actualiza data/guia.json manualmente</small>
                    </a>
                </nav>

                <section class="ayuda-section" id="ayuda-acceso">
                    <h3><span class="material-symbols-outlined" aria-hidden="true">login</span> Acceso y pantalla de bienvenida</h3>
                    <p>Para entrar se usa el identificador de operador y la clave de acceso. Después de iniciar sesión aparece el <strong>Launcher</strong>, una pantalla de bienvenida donde se elige por dónde empezar:</p>
                    <ul>
                        <li><strong>Guía</strong>: toda la documentación de operaciones (accesos, procedimientos, comandos, contactos).</li>
                        <li><strong>Espacio de Trabajo</strong>: las herramientas de Nivel 2 (CDC, guardia, mail, calendario, impacto, etc.).</li>
                        <li><strong>Ayuda</strong> (esta página): explica cómo usar cada parte.</li>
                    </ul>
                    <p>En el Launcher también hay accesos rápidos a <em>Búsqueda</em>, <em>Alertas</em> y <em>Perfil</em>. Si ya iniciaste sesión antes, la próxima vez puedes entrar directo a una sección o módulo desde el enlace guardado.</p>
                </section>

                <section class="ayuda-section" id="ayuda-guia">
                    <h3><span class="material-symbols-outlined" aria-hidden="true">menu_book</span> La Guía</h3>
                    <p>Es la documentación operativa, organizada en <strong>secciones</strong> (temas grandes) y <strong>subsecciones</strong> (artículos individuales). En el panel lateral izquierdo puedes desplegar cada sección y ver sus subsecciones.</p>
                    <div class="ayuda-guide-grid">
                        ${buildGuideIndex()}
                    </div>
                    <h4>Dentro de un artículo</h4>
                    <ul>
                        <li><strong>Panel "En esta sección"</strong> (derecha): índice de las subsecciones, clic para saltar entre ellas.</li>
                        <li><strong>Anterior / Siguiente</strong> (al final del contenido): recorrer la sección en orden.</li>
                        <li><strong>Bloques de comandos</strong>: aparecen como tarjetas con botón <em>Copiar</em> para llevar el comando al portapapeles.</li>
                        <li><strong>Migas de pan</strong> (arriba): Inicio › Sección › Subsección, clic para volver.</li>
                    </ul>
                    <h4>Comandos según el equipo</h4>
                    <p>La sección <strong>Plantillas de Comandos</strong> agrupa los comandos por fabricante: Huawei (ME60, HWSAR), ZTE (NGN), Alcatel (7302), Cisco y Juniper MX.</p>
                </section>

                <section class="ayuda-section" id="ayuda-espacio">
                    <h3><span class="material-symbols-outlined" aria-hidden="true">work</span> Espacio de Trabajo</h3>
                    <p>Un hub de módulos. Cada herramienta abre su propia página:</p>
                    <div class="ayuda-tools">
                        <div class="ayuda-tool"><span class="material-symbols-outlined" aria-hidden="true">map</span><div><strong>Mapa</strong><p>Índice jerárquico de la guía para navegar rápido.</p></div></div>
                        <div class="ayuda-tool"><span class="material-symbols-outlined" aria-hidden="true">calendar_month</span><div><strong>Calendario</strong><p>Eventos y planificación operativa.</p></div></div>
                        <div class="ayuda-tool"><span class="material-symbols-outlined" aria-hidden="true">space_dashboard</span><div><strong>CDC</strong><p>Controles de Cambio: programación, seguimiento e historial.</p></div></div>
                        <div class="ayuda-tool"><span class="material-symbols-outlined" aria-hidden="true">security</span><div><strong>Guardia</strong><p>Entrega de guardia con los mensajes para Telegram.</p></div></div>
                        <div class="ayuda-tool"><span class="material-symbols-outlined" aria-hidden="true">mail</span><div><strong>Mail</strong><p>Generador de comunicados para proveedores.</p></div></div>
                        <div class="ayuda-tool"><span class="material-symbols-outlined" aria-hidden="true">emergency</span><div><strong>Impacto</strong><p>Análisis de riesgos y control de daños.</p></div></div>
                        <div class="ayuda-tool"><span class="material-symbols-outlined" aria-hidden="true">person</span><div><strong>Perfil</strong><p>Cuenta, credenciales y preferencias del usuario.</p></div></div>
                        <div class="ayuda-tool"><span class="material-symbols-outlined" aria-hidden="true">palette</span><div><strong>Estilo</strong><p>Tema, acento y densidad de la interfaz.</p></div></div>
                    </div>
                    <p>El botón <strong>Volver</strong> del encabezado regresa del módulo al listado del Espacio de Trabajo.</p>
                </section>

                <section class="ayuda-section" id="ayuda-busqueda">
                    <h3><span class="material-symbols-outlined" aria-hidden="true">search</span> Búsqueda global</h3>
                    <p>Pulsa <kbd class="ayuda-kbd">Ctrl</kbd> + <kbd class="ayuda-kbd">K</kbd> (o <kbd class="ayuda-kbd">⌘</kbd> + <kbd class="ayuda-kbd">K</kbd> en Mac) para abrir la búsqueda global. Busca tanto en las secciones de la guía como en los módulos del Espacio de Trabajo. También hay un campo de búsqueda en el panel lateral para filtrar las secciones.</p>
                </section>

                <section class="ayuda-section" id="ayuda-notificaciones">
                    <h3><span class="material-symbols-outlined" aria-hidden="true">notifications</span> Notificaciones</h3>
                    <p>La campana del encabezado muestra las alertas y avisos del sistema (por ejemplo, recordatorios de CDC). Las notificaciones sin leer aparecen con un contador. También se pueden marcar como leídas u ocultar desde el panel de notificaciones.</p>
                </section>

                <section class="ayuda-section" id="ayuda-edicion">
                    <h3><span class="material-symbols-outlined" aria-hidden="true">edit_note</span> ¿Quién edita la guía?</h3>
                    <div class="ayuda-note">
                        <span class="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>
                        <div>
                            <p><strong>Los contenidos de la guía los actualiza el administrador manualmente.</strong> No se editan desde esta página: el admin modifica el archivo <code>data/guia.json</code> directamente y los cambios se publican con la próxima actualización de la aplicación.</p>
                            <p>Los datos operativos generados por las herramientas (CDC, eventos, notificaciones, lecturas) sí se guardan en tu dispositivo y se sincronizan con Firebase cuando hay conexión.</p>
                        </div>
                    </div>
                </section>
            </div>
        `;
        body.classList.remove('loading');
        document.getElementById('main-content').scrollTop = 0;

        bindAyudaLinks(body);
    }, 120);
}

/**
 * Vincula los enlaces de subsecciones de la guía dentro de la página de ayuda
 * para que naveguen con navigateTo (mantiene sincronizada la barra lateral).
 */
function bindAyudaLinks(root) {
    root.querySelectorAll('.ayuda-sub-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sec = link.dataset.section;
            const sub = link.dataset.subsection;
            if (sec && sub) navigateTo(sec, sub);
        });
    });

    // Tarjetas del índice (href="#ayuda-..."). NO deben cambiar el hash de la URL:
    // eso dispara el router y nos saca de la página. Scroll interno dentro de
    // #main-content, respetando el scroll-margin-top de cada sección.
    root.querySelectorAll('.ayuda-index-card[href^="#"]').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const target = root.querySelector(card.getAttribute('href'));
            if (!target) return;
            const container = document.getElementById('main-content');
            if (container) {
                const targetTop = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
                container.scrollTo({ top: targetTop - 16, behavior: 'smooth' });
            } else {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}
