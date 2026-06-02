import { GameApplication } from './core/GameApplication.js';

const baseUrl = "http://localhost:3000";
//const baseUrl = "http://192.168.0.101:3000";

const app = new GameApplication({
    canvasParent: document.body,
    loaderSelector: '#loader',
    debugSelector: '.debug',
    menuSelector: '#menu',
    pauseSelector: '#pause-menu',
    gameOverSelector: '#game-over',
    hudSelector: '#hud',
    models: {
        corridor: baseUrl+'/corridor/scene.gltf',

        station: baseUrl+'/station/scene.gltf',
        stationHitbox: baseUrl+'/station/station_hitbox.glb',

        ship: baseUrl+'/spaceship/scene.gltf',
        shipHitbox: baseUrl+'/spaceship/ship1_hitbox.glb',

        flagman: baseUrl+'/flagman.glb',

        hangar: baseUrl+'/hangar/scene.gltf',
        planet: baseUrl+'/planet/avaris.glb',

        astronaut: baseUrl+'/astronaut.glb',

        asteroidsMetallic: baseUrl+'/world/asteroids_metallic.glb',
        asteroidsRocky: baseUrl+'/world/asteroids_rocky.glb',
    },
    world: {
        planetPosition: { x: 5000, y: 0, z: -5000 }
    },
    audio: {
        settings: {
            masterVolume: 1,
            musicVolume: 0.7,
            sfxVolume: 1
        },
        assets: {

            // Music

            menuTheme: { url: './assets/sound/music/main_menu_theme.mp3', type: 'music', loop: true, volume: 10 },
            borderTheme: { url: './assets/sound/music/border_theme.mp3', type: 'music', loop: true, volume: 10 },

            // Ambient

            spaceAmbient: { url: './assets/sound/ambient/space.mp3', type: 'music', loop: true, volume: 0.2 },
            stationAmbient: { url: './assets/sound/ambient/station.mp3', type: 'music', loop: true, volume: 0.1 },

            // Border

            borderMessage: { url: './assets/sound/border/border_message.wav', type: 'sfx', volume: 0.3},
            borderAlarm: { url: './assets/sound/border/border_alarm.mp3', type: 'sfx', volume: 0.2 },

            // Ship

            shipEngineRun: { url: './assets/sound/ship/ship_engine_run.mp3', type: 'sfx', loop: true, volume: 0.7},
            shipEngineAccelerate: { url: './assets/sound/ship/ship_engine_accelerate.mp3', type: 'sfx', volume: 0.7 },
            shipEngineFast: { url: './assets/sound/ship/ship_engine_fast.mp3', type: 'sfx', loop: true, volume: 0.7 },
            shipEngineSlow: { url: './assets/sound/ship/ship_engine_slow.mp3', type: 'sfx', volume: 0.7 },

            // Weapons

            shipGunFire: { url: './assets/sound/weapon/photon_gun_fire.wav', type: 'sfx', volume: 0.3 },

            // Misc

            clickUi: { url: './assets/sound/click_ui.mp3', type: 'sfx', volume: 0.7 },
            radioReceive: { url: './assets/sound/radio_receive.mp3', type: 'sfx', volume: 0.3 },
            warp: { url: './assets/sound/warp.mp3', type: 'sfx', volume: 1 },
            explosion: { url: './assets/sound/explosion.mp3', type: 'sfx', volume: 1 },
        }
    }
});

app.start();
