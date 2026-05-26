import { GameApplication } from './core/GameApplication.js';

const app = new GameApplication({
    canvasParent: document.body,
    loaderSelector: '#loader',
    debugSelector: '.debug',
    models: {
        corridor: 'http://localhost:3000/corridor/scene.gltf',
        station: 'http://localhost:3000/station/scene.gltf',
    }
});

app.start();
