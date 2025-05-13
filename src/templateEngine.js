const { readFile } = require('./fileUtils');

async function loadTemplate(templatePath) {
    try {
        return await readFile(templatePath);
    } catch (error) {
        console.error(`Error loading template ${templatePath}:`, error.message);
        throw error;
    }
}

function applyTemplate(templateContent, data) {
    let html = templateContent;
    for (const key in data) {
        const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        html = html.replace(placeholder, data[key]);
    }
    return html;
}

module.exports = {
    loadTemplate,
    applyTemplate
};