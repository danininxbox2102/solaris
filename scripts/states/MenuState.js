import * as THREE from 'three';

export class MenuState {
    constructor({ sceneController, cameraController, modelLoader, loadingOverlay, config }) {
        this.sceneController = sceneController;
        this.cameraController = cameraController;
        this.modelLoader = modelLoader;
        this.loadingOverlay = loadingOverlay;
        this.config = config;

        this.scene = this.sceneController.createScene();
        this.mixers = [];
        this.alwaysOnTopObjects = new Set();
        this.isLoaded = false;
        this.isActive = false;
    }

    async enter() {
        this.isActive = true;
        this.sceneController.setActiveScene(this.scene);
        this.setupCamera();

        if (!this.isLoaded) {
            this.loadingOverlay.setMessage('Загрузка главного меню...');
            this.sceneController.setupDefaultWorld(this.scene);
            this.setupLights();
            await this.loadModels();
            this.isLoaded = true;
        }
    }

    exit() {
        this.isActive = false;
    }

    update(delta) {
        for (const mixer of this.mixers) {
            mixer.update(delta);
        }
    }

    setupCamera() {
        this.cameraController.setControlsEnabled(true);
        this.cameraController.setView(
            new THREE.Vector3(2.8, 1.2, 0.4),
            new THREE.Vector3(10, 1.1, -3)
        );
    }

    setupLights() {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(2.8, 1.2, 0.4);

        const cratesLight = new THREE.SpotLight(0x6cb7d2, 5);
        cratesLight.name = 'cratesLight';
        cratesLight.position.set(10, 0.5, 0.4);

        this.scene.add(directionalLight, cratesLight);
    }

    async loadModels() {
        const corridorModel = await this.modelLoader.load(this.config.models.corridor, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        this.scene.add(corridorModel.root);
        this.alwaysOnTopObjects.add(corridorModel.root);

        if (corridorModel.mixer) {
            this.mixers.push(corridorModel.mixer);
        }

        this.loadingOverlay.hide();
    }
}
