// ========================================
// HOME PAGE MODULE
// ========================================

import { AppState } from '../state.js';
import { navigateTo } from './navigation.js';

export const HOME_PAGE_HTML = `
<div class="home-page">
    <!-- Hero -->
    <section class="hp-hero">
        <div class="hp-hero-deco" aria-hidden="true"></div>
        <div class="hp-hero-inner">
            <div>
                <div class="hp-version-badge">
                    <span class="hp-version-dot" aria-hidden="true"></span>
                    Versión 1.0.0
                </div>
                <h1>Guía de Operaciones</h1>
                <p>Para Redes IP (COR). Todo lo que necesitas para operar, solucionar e implementar.</p>
            </div>
            <div class="hp-hero-actions">
                <button class="hp-btn hp-btn-primary" id="btn-go-first-section" type="button">
                    Ir a la guía <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                </button>
                <button class="hp-btn hp-btn-secondary" id="btn-go-dashboard" type="button">
                    <span class="material-symbols-outlined" aria-hidden="true">work</span> Espacio de Trabajo
                </button>
            </div>
        </div>
    </section>

    <!-- Bento Grid -->
    <div class="hp-grid">
        <!-- Herramientas -->
        <div class="hp-card" data-section="herramientas-accesos" role="button" tabindex="0" aria-label="Abrir sección Herramientas">
            <div class="hp-card-icon"><span class="material-symbols-outlined" aria-hidden="true">build</span></div>
            <h3>Herramientas</h3>
            <p>Acceso directo a sistemas de monitoreo, ticketing y plataformas de diagnóstico de red.</p>
            <div class="hp-list">
                <div class="hp-list-item"><span class="material-symbols-outlined" aria-hidden="true">dns</span> NetBox IPAM</div>
                <div class="hp-list-item"><span class="material-symbols-outlined" aria-hidden="true">monitoring</span> SolarWinds</div>
            </div>
        </div>

        <!-- Procedimientos -->
        <div class="hp-card" data-section="procedimientos-validacion" role="button" tabindex="0" aria-label="Abrir sección Procedimientos">
            <div class="hp-card-icon"><span class="material-symbols-outlined" aria-hidden="true">menu_book</span></div>
            <h3>Procedimientos</h3>
            <p>MOPs estandarizados para mantenimientos, ventanas de cambio y despliegues.</p>
            <div class="hp-list">
                <div class="hp-list-item"><span class="material-symbols-outlined" aria-hidden="true">article</span> MOP Actualización Core</div>
                <div class="hp-list-item"><span class="material-symbols-outlined" aria-hidden="true">article</span> Alta BGP Peering</div>
            </div>
        </div>

        <!-- Gestión de Incidentes -->
        <div class="hp-card" data-section="gestion-incidentes" role="button" tabindex="0" aria-label="Abrir sección Gestión de Incidentes">
            <div class="hp-card-icon hp-card-icon-error"><span class="material-symbols-outlined" aria-hidden="true">warning</span></div>
            <h3>Gestión de Incidentes</h3>
            <p>Escalamientos, SLAs, y flujos de trabajo para cortes de fibra y fallas de hardware.</p>
            <div class="hp-list">
                <div class="hp-list-item"><span class="material-symbols-outlined hp-list-error" aria-hidden="true">priority_high</span> Matriz de Escalamiento</div>
                <div class="hp-list-item"><span class="material-symbols-outlined" aria-hidden="true">contact_phone</span> NOC Guardia 24/7</div>
            </div>
        </div>

        <!-- Conceptos Base (ancha) -->
        <div class="hp-card hp-card-wide" data-section="conceptos-fundamentales" role="button" tabindex="0" aria-label="Abrir sección Conceptos Base">
            <div class="hp-card-wide-main">
                <div class="hp-card-icon"><span class="material-symbols-outlined" aria-hidden="true">school</span></div>
                <h3>Conceptos Base</h3>
                <p>Teoría de redes, arquitectura de la red troncal, topologías y estándares de diseño vigentes.</p>
                <div class="hp-subgrid">
                    <div class="hp-subitem">
                        <div class="hp-subitem-label">Arquitectura</div>
                        <div class="hp-subitem-value">Topología Jerárquica (Core · Agregación · Distribución)</div>
                    </div>
                    <div class="hp-subitem">
                        <div class="hp-subitem-label">Protocolos</div>
                        <div class="hp-subitem-value">OSPF &amp; IS-IS</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Columna apilada: Comandos CLI + Directorio -->
        <div class="hp-stack">
            <!-- Comandos CLI -->
            <div class="hp-card hp-card-compact" data-section="plantillas-comandos" role="button" tabindex="0" aria-label="Abrir sección Comandos CLI">
                <span class="material-symbols-outlined hp-card-bg-icon" aria-hidden="true">terminal</span>
                <h3><span class="material-symbols-outlined" aria-hidden="true">terminal</span> Comandos CLI</h3>
                <p>Cisco, Juniper, Nokia, Huawei</p>
                <span class="hp-card-link">Ver cheat sheets <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></span>
            </div>

            <!-- Directorio -->
            <div class="hp-card hp-card-compact" data-section="proveedores-modelos-correo" role="button" tabindex="0" aria-label="Abrir sección Directorio">
                <h3><span class="material-symbols-outlined" aria-hidden="true">contact_mail</span> Directorio</h3>
                <p>Contactos de ISPs y Vendors</p>
                <div class="hp-chips">
                    <span class="hp-chip">Tier 1 ISPs</span>
                    <span class="hp-chip">Soporte H/W</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Info row -->
    <div class="hp-footer">
        <div class="hp-footer-left">
            <span class="material-symbols-outlined" aria-hidden="true">info</span>
            <span>Juan Irazabal · Software Development Engineer</span>
        </div>
        <div class="hp-footer-right">
            <a href="https://wa.me/584129706050" target="_blank" rel="noopener" id="hp-report-error">
                <span class="material-symbols-outlined" aria-hidden="true">forum</span> Reportar Error
            </a>
        </div>
    </div>
</div>
`;

export function showHome() {
    AppState.set('isHomePage', true);
    AppState.set('currentView', 'home');
    AppState.set('currentSectionId', null);
    AppState.set('currentSubsectionId', null);
    AppState.set('currentDashboardTool', null);

    window.location.hash = '#';
    document.getElementById('content-title').textContent = 'Inicio';
    document.getElementById('breadcrumb').innerHTML = `<span>Inicio</span>`;
    document.getElementById('breadcrumb').style.display = 'none';

    const body = document.getElementById('content-body');
    body.classList.add('loading');

    setTimeout(() => {
        body.innerHTML = HOME_PAGE_HTML;
        body.classList.remove('loading');
        document.getElementById('main-content').scrollTop = 0;

        // Botones del hero
        document.getElementById('btn-go-dashboard')?.addEventListener('click', () => {
            window.location.hash = '#/dashboard';
        });
        document.getElementById('btn-go-first-section')?.addEventListener('click', navigateToFirstSection);

        // Tarjetas del bento grid → secciones reales de la guía
        document.querySelectorAll('.hp-card[data-section]').forEach(card => {
            const go = () => goToSection(card.dataset.section);
            card.addEventListener('click', go);
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go();
                }
            });
        });

        // Estado activo de la navegación
        document.querySelectorAll('.nav-subsection-link, .nav-home-link, .nav-dash-link').forEach(el => {
            el.classList.remove('active');
        });
        const homeLink = document.querySelector('.nav-home-link');
        if (homeLink) homeLink.classList.add('active');
    }, 120);
}

export function navigateToFirstSection() {
    const guiaData = AppState.get('guiaData');
    if (!guiaData || !guiaData.sections || guiaData.sections.length === 0) return;
    const first = guiaData.sections[0];
    if (first.subsections.length > 0) {
        navigateTo(first.id, first.subsections[0].id);
    }
}

/**
 * Navega a la primera subsección de una sección de la guía.
 * @param {string} sectionId - id de la sección (ej. 'plantillas-comandos')
 */
export function goToSection(sectionId) {
    const guiaData = AppState.get('guiaData');
    if (!guiaData || !guiaData.sections) return;
    const section = guiaData.sections.find(s => s.id === sectionId);
    if (!section) return;
    const sub = section.subsections && section.subsections[0];
    if (sub) navigateTo(section.id, sub.id);
}
