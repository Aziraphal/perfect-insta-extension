// =============================================================================
// PERFECT INSTA POST - EXPORT SERVICE
// Export des analyses en PNG ou copie formatée
// =============================================================================

const ExportService = {
    // Exporter en PNG (capture du rapport)
    async exportAsPNG(data) {
        const canvas = await this.createReportCanvas(data);

        // Créer le lien de téléchargement
        const link = document.createElement('a');
        link.download = `perfect-insta-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showNotification('Rapport exporté en PNG', 'success');
    },

    // Créer le canvas du rapport
    async createReportCanvas(data) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Dimensions
        const width = 800;
        const padding = 40;
        const headerHeight = 120;
        const imageSize = 300;
        const lineHeight = 24;

        // Calculer la hauteur totale
        const captionLines = this.wrapText(ctx, data.caption || '', width - padding * 2 - 20, 16);
        const hashtagsText = (data.hashtags || []).join(' ');
        const suggestionsCount = (data.suggestions || []).length;

        const contentHeight = imageSize + 60 + // Image + margin
            captionLines.length * lineHeight + 60 + // Caption
            60 + // Hashtags section
            suggestionsCount * 30 + 60 + // Suggestions
            100; // Footer

        const height = headerHeight + contentHeight + padding * 2;
        canvas.width = width;
        canvas.height = height;

        // Background
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, width, height);

        // Header gradient
        const gradient = ctx.createLinearGradient(0, 0, width, headerHeight);
        gradient.addColorStop(0, '#FCAF45');
        gradient.addColorStop(0.33, '#F77737');
        gradient.addColorStop(0.66, '#E1306C');
        gradient.addColorStop(1, '#833AB4');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, headerHeight);

        // Header text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('📸 Perfect Insta Post', width / 2, 50);

        ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText('Rapport d\'analyse Instagram', width / 2, 80);

        const dateStr = new Date().toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(dateStr, width / 2, 105);

        let y = headerHeight + padding;

        // Image preview
        if (data.image) {
            try {
                const img = await this.loadImage(data.image);
                const imgX = (width - imageSize) / 2;

                // Cadre de l'image
                ctx.fillStyle = '#262626';
                ctx.beginPath();
                ctx.roundRect(imgX - 10, y - 10, imageSize + 20, imageSize + 20, 16);
                ctx.fill();

                // Image
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(imgX, y, imageSize, imageSize, 12);
                ctx.clip();

                // Calculer le ratio pour cover
                const ratio = Math.max(imageSize / img.width, imageSize / img.height);
                const newWidth = img.width * ratio;
                const newHeight = img.height * ratio;
                const offsetX = (imageSize - newWidth) / 2;
                const offsetY = (imageSize - newHeight) / 2;

                ctx.drawImage(img, imgX + offsetX, y + offsetY, newWidth, newHeight);
                ctx.restore();

                y += imageSize + 40;
            } catch (e) {
                console.error('Erreur chargement image:', e);
                y += 20;
            }
        }

        // Section Caption
        ctx.textAlign = 'left';
        y = this.drawSection(ctx, '✍️ Légende', padding, y, width);

        ctx.fillStyle = '#262626';
        ctx.beginPath();
        ctx.roundRect(padding, y, width - padding * 2, captionLines.length * lineHeight + 20, 12);
        ctx.fill();

        ctx.fillStyle = '#FAFAFA';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        captionLines.forEach((line, i) => {
            ctx.fillText(line, padding + 15, y + 25 + i * lineHeight);
        });

        y += captionLines.length * lineHeight + 50;

        // Section Hashtags
        y = this.drawSection(ctx, '🏷️ Hashtags', padding, y, width);

        ctx.fillStyle = '#262626';
        ctx.beginPath();
        ctx.roundRect(padding, y, width - padding * 2, 60, 12);
        ctx.fill();

        // Dessiner les hashtags
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        let hashX = padding + 15;
        let hashY = y + 25;
        const maxHashWidth = width - padding * 2 - 30;

        (data.hashtags || []).forEach((tag, i) => {
            const tagWidth = ctx.measureText(tag).width + 16;

            if (hashX + tagWidth > padding + maxHashWidth) {
                hashX = padding + 15;
                hashY += 28;
            }

            // Tag background
            const tagGradient = ctx.createLinearGradient(hashX, hashY - 10, hashX + tagWidth, hashY + 10);
            tagGradient.addColorStop(0, '#E1306C');
            tagGradient.addColorStop(1, '#833AB4');
            ctx.fillStyle = tagGradient;
            ctx.beginPath();
            ctx.roundRect(hashX, hashY - 10, tagWidth, 22, 11);
            ctx.fill();

            // Tag text
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(tag, hashX + 8, hashY + 4);

            hashX += tagWidth + 8;
        });

        y += 90;

        // Section Suggestions
        if (data.suggestions && data.suggestions.length > 0) {
            y = this.drawSection(ctx, '💡 Suggestions', padding, y, width);

            data.suggestions.forEach((suggestion, i) => {
                ctx.fillStyle = '#262626';
                ctx.beginPath();
                ctx.roundRect(padding, y, width - padding * 2, 36, 8);
                ctx.fill();

                ctx.fillStyle = '#A8A8A8';
                ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.fillText(`${i + 1}. ${suggestion}`, padding + 15, y + 23);

                y += 44;
            });
        }

        // Footer
        y = height - 50;
        ctx.fillStyle = '#363636';
        ctx.fillRect(0, y, width, 50);

        ctx.fillStyle = '#737373';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Généré avec Perfect Insta Post • perfectinsta.app', width / 2, y + 30);

        return canvas;
    },

    // Helper: Dessiner un titre de section
    drawSection(ctx, title, x, y, width) {
        ctx.fillStyle = '#FAFAFA';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(title, x, y);
        return y + 30;
    },

    // Helper: Charger une image
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    // Helper: Wrapper le texte
    wrapText(ctx, text, maxWidth, fontSize) {
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    },

    // Copier tout le contenu formaté
    async copyFormatted(data) {
        const text = this.formatForCopy(data);

        try {
            await navigator.clipboard.writeText(text);
            showNotification('Copié dans le presse-papier !', 'success');
        } catch (e) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showNotification('Copié !', 'success');
        }
    },

    // Formater le contenu pour copie
    formatForCopy(data) {
        let text = '';

        if (data.caption) {
            text += data.caption + '\n\n';
        }

        if (data.hashtags && data.hashtags.length > 0) {
            text += '・\n・\n・\n\n'; // Séparateur Instagram style
            text += data.hashtags.join(' ');
        }

        return text;
    },

    // Copier seulement la caption
    async copyCaption(caption) {
        try {
            await navigator.clipboard.writeText(caption);
            showNotification('Légende copiée !', 'success');
        } catch (e) {
            console.error('Erreur copie:', e);
        }
    },

    // Copier seulement les hashtags
    async copyHashtags(hashtags) {
        const text = hashtags.join(' ');
        try {
            await navigator.clipboard.writeText(text);
            showNotification('Hashtags copiés !', 'success');
        } catch (e) {
            console.error('Erreur copie:', e);
        }
    }
};

// Ajouter le support de roundRect si non supporté
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}
