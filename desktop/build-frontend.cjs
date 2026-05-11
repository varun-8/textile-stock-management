#!/usr/bin/env node
const { build } = require('vite');
const react = require('@vitejs/plugin-react');

async function run() {
    await build({
        configFile: false,
        plugins: [react()],
        server: {
            proxy: {
                '/api': {
                    target: 'http://127.0.0.1:5050',
                    changeOrigin: true,
                    secure: false
                },
                '/pwa': {
                    target: 'https://127.0.0.1:5051',
                    changeOrigin: true,
                    secure: false
                },
                '/socket.io': {
                    target: 'http://127.0.0.1:5050',
                    changeOrigin: true,
                    secure: false,
                    ws: true
                }
            }
        },
        base: './'
    });
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
