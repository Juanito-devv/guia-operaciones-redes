// ========================================
// IMPACTO — Página completa (#/dashboard/impacto)
// En construcción: el diseño definitivo de la herramienta está pendiente.
// ========================================

export function showImpacto() {
    const body = document.getElementById('content-body');
    if (!body) return;
    body.classList.add('loading');

    setTimeout(() => {
        body.innerHTML = `
            <div class="tool-page">
                <header class="tool-page-header">
                    <div>
                        <p class="tool-eyebrow">Espacio de Trabajo · Herramienta</p>
                        <h1 class="tool-title">Impacto</h1>
                        <p class="tool-sub">Análisis de riesgos, simulaciones y control de daños.</p>
                    </div>
                </header>
                <div class="tool-construction">
                    <span class="material-symbols-outlined" aria-hidden="true">construction</span>
                    <h2>Página en construcción</h2>
                    <p>La herramienta <b>Impacto</b> se está rediseñando. Pronto estará disponible con el nuevo diseño.</p>
                </div>
            </div>
        `;
        body.classList.remove('loading');
        document.getElementById('main-content')?.scrollTo(0, 0);
    }, 120);
}