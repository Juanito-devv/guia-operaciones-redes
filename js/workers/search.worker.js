// ========================================
// SEARCH WEB WORKER (Ejecuta búsquedas en un hilo secundario)
// ========================================

self.onmessage = function (e) {
    const { query, guiaData, maxResults = 25 } = e.data;

    if (!query || !query.trim() || !guiaData || !guiaData.sections) {
        self.postMessage({ results: [] });
        return;
    }

    const term = query.toLowerCase().trim();
    const results = [];

    guiaData.sections.forEach(section => {
        section.subsections.forEach(sub => {
            const text = sub.content || '';
            const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
            const titleMatch = sub.title.toLowerCase().includes(term);
            const contentMatch = plainText.toLowerCase().includes(term);

            if (titleMatch || contentMatch) {
                let snippet = '';
                if (contentMatch) {
                    const index = plainText.toLowerCase().indexOf(term);
                    const start = Math.max(0, index - 50);
                    const end = Math.min(plainText.length, index + term.length + 70);
                    snippet = plainText.substring(start, end);
                    if (start > 0) snippet = '...' + snippet;
                    if (end < plainText.length) snippet = snippet + '...';
                } else {
                    snippet = plainText.substring(0, 120) + '...';
                }

                let score = 0;
                if (titleMatch) score += 15;
                if (sub.title.toLowerCase().startsWith(term)) score += 10;
                if (sub.title.toLowerCase().includes(' ' + term)) score += 5;
                if (contentMatch) score += 2;
                if (plainText.toLowerCase().includes(term)) score += 3;

                results.push({
                    sectionId: section.id,
                    subsectionId: sub.id,
                    sectionTitle: section.title,
                    subsectionTitle: sub.title,
                    snippet: snippet,
                    score: score,
                    term: term
                });
            }
        });
    });

    results.sort((a, b) => b.score - a.score);
    self.postMessage({ results: results.slice(0, maxResults) });
};
