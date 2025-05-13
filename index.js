const { build } = require('./src/build');

build().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
});