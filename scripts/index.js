import { GameApplication } from './core/GameApplication.js';

const app = new GameApplication({
    canvasParent: document.body,
    loaderSelector: '#loader',
    debugSelector: '.debug',
    menuSelector: '#menu',
    models: {
        corridor: 'http://localhost:3000/corridor/scene.gltf',
        station: 'http://localhost:3000/station/scene.gltf',
        ship: 'http://localhost:3000/spaceship/scene.gltf',
        hangar: 'http://localhost:3000/hangar/scene.gltf',
        planet: 'http://localhost:3000/planet/scene.gltf',
    },
    audio: {
        settings: {
            masterVolume: 1,
            musicVolume: 0.7,
            sfxVolume: 1
        },
        assets: {
            menuTheme: { url: './assets/sound/main_menu_theme.mp3', type: 'music', loop: true, volume: 0.6 },
            clickUi: { url: './assets/sound/click_ui.mp3', type: 'sfx', volume: 0.7 }
        }
    }
});

app.start();
