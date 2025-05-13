const fs = require('fs').promises;
const path = require('path');

async function readDirRecursive(dir) {
    let files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(await readDirRecursive(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

async function readFile(filePath) {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        throw error;
    }
}

async function writeFile(filePath, content) {
    try {
        await fs.writeFile(filePath, content, 'utf8');
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error.message);
        throw error;
    }
}

async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        console.error(`Error ensuring directory ${dirPath}:`, error.message);
        throw error;
    }
}

module.exports = {
    readDirRecursive,
    readFile,
    writeFile,
    ensureDir
};