const fs = require('fs').promises;
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.json');
let config = null;

async function loadConfig() {
    if (!config) {
        try {
            const data = await fs.readFile(configPath, 'utf8');
            config = JSON.parse(data);
            config.markdownDir = path.resolve(__dirname, '..', config.markdownDir);
            config.outputDir = path.resolve(__dirname, '..', config.outputDir);
            config.templateFile = path.resolve(__dirname, '..', config.templateFile);
            config.indexTemplateFile = path.resolve(__dirname, '..', config.indexTemplateFile);
            config.archiveTemplateFile = path.resolve(__dirname, '..', config.archiveTemplateFile);
            console.log('Configuration loaded successfully.');
        } catch (error) {
            console.error('Error loading configuration:', error.message);
            process.exit(1);
        }
    }
    return config;
}

module.exports = {
    loadConfig
};