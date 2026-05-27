import * as THREE from 'three';
import { PlayerShip } from '../entities/PlayerShip.js';
import { KeyboardMouseInput } from '../input/KeyboardMouseInput.js';

export class OpenWorldState {
    constructor({ sceneController, cameraController, modelLoader, loadingOverlay, config }) {
        this.sceneController = sceneController;
        this.cameraController = cameraController;
        this.modelLoader = modelLoader;
        this.loadingOverlay = loadingOverlay;
        this.config = config;

        this.scene = this.sceneController.createScene();
        this.mixers = [];
        this.alwaysOnTopObjects = new Set();
        this.input = new KeyboardMouseInput();
        this.playerShip = null;
        this.isLoaded = false;
        this.isActive = false;
    }

    async enter() {
        this.isActive = true;
        this.sceneController.setActiveScene(this.scene);
        this.setupCamera();

        if (!this.isLoaded) {
            this.loadingOverlay.setMessage('Загрузка открытого мира...');
            this.sceneController.setupDefaultWorld(this.scene, { gridSize: 0, gridDivisions: 0 });
            this.setupLights();
            await this.loadModels();
            this.isLoaded = true;
        }

        if (this.playerShip) {
            this.input.start();
        }
    }

    exit() {
        this.isActive = false;
        this.input.stop();
    }

    update(delta) {
        for (const mixer of this.mixers) {
            mixer.update(delta);
        }

        if (this.playerShip) {
            this.playerShip.update(delta);
        }

        if (this.planetModel) {

            const player = this.playerShip.object;

            this.planetModel.root.position.set(player.position.x+500,player.position.y,player.position.z + -500)
        }
    }

    setupCamera() {
        this.cameraController.setControlsEnabled(false);
        this.cameraController.setView(
            new THREE.Vector3(18, 10, 18),
            new THREE.Vector3(0, 1.5, 0)
        );
    }

    setupLights() {
        const sun = new THREE.DirectionalLight(0xffffff, 2.2);
        sun.position.set(-14, 18, 10);

        const fill = new THREE.HemisphereLight(0x7aa7ff, 0x161616, 0.8);

        this.scene.add(sun, fill);
    }

    async loadModels() {
        const stationModel = await this.modelLoader.load(this.config.models.station, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        stationModel.root.position.set(0, 1.5, 0);
        stationModel.root.scale.set(100, 100, 100);
        this.scene.add(stationModel.root);

        if (stationModel.mixer) {
            this.mixers.push(stationModel.mixer);
        }

        const shipModel = await this.modelLoader.load(this.config.models.ship, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });


        this.playerShip = new PlayerShip({
            object: shipModel.root,
            input: this.input,
            cameraController: this.cameraController
        });
        this.scene.add(this.playerShip.object);

        if (shipModel.mixer) {
            this.mixers.push(shipModel.mixer);
        }

        const planetModel = await this.modelLoader.load(this.config.models.planet, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        })

        planetModel.root.position.set(500,0,-500)
        planetModel.root.scale.set(100,100,100)

        this.planetModel = planetModel.root;

        this.scene.add(planetModel.root);

        this.loadingOverlay.hide();
    }
}
