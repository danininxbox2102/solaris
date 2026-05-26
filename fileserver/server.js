import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

class StaticFileServer {
    constructor({ port = getCliPort() || process.env.PORT || 3000 } = {}) {
        this.port = port;
        this.app = express();
    }

    start() {
        this.configureMiddleware();

        this.app.listen(this.port, () => {
            console.log('Listening on port', this.port);
        });
    }

    configureMiddleware() {
        this.app.use(cors());
        this.app.use(express.static(this.getProjectRootPath()));
        this.app.use(express.static(this.getPublicPath()));
    }

    getProjectRootPath() {
        return path.join(this.getCurrentDir(), '..');
    }

    getPublicPath() {
        return path.join(this.getCurrentDir(), 'public');
    }

    getCurrentDir() {
        const currentFile = fileURLToPath(import.meta.url);

        return path.dirname(currentFile);
    }
}

function getCliPort() {
    const portFlagIndex = process.argv.indexOf('--port');

    if (portFlagIndex === -1) {
        return null;
    }

    return process.argv[portFlagIndex + 1] || null;
}

const server = new StaticFileServer();
server.start();
