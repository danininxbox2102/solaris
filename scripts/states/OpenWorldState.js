import * as THREE from 'three';

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
        this.isLoaded = false;
        this.isActive = false;
    }

    async enter() {
        this.isActive = true;
        this.sceneController.setActiveScene(this.scene);
        this.setupCamera();

        if (!this.isLoaded) {
            this.loadingOverlay.setMessage('Загрузка открытого мира...');
            this.sceneController.setupDefaultWorld(this.scene, { gridSize: 80, gridDivisions: 40 });
            this.setupLights();
            this.setupWorldMarkers();
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

    setupWorldMarkers() {
        const beaconMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a6f8f,
            emissive: 0x10394a,
            roughness: 0.35,
            metalness: 0.4
        });

        for (const position of [
            new THREE.Vector3(-14, 0.6, -10),
            new THREE.Vector3(12, 0.6, 8),
            new THREE.Vector3(-4, 0.6, 15)
        ]) {
            const beacon = new THREE.Mesh(
                new THREE.CylinderGeometry(0.4, 0.8, 1.2, 24),
                beaconMaterial
            );
            beacon.position.copy(position);
            this.scene.add(beacon);
        }
    }

    async loadModels() {
        const stationModel = await this.modelLoader.load(this.config.models.station, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        stationModel.root.position.set(0, 1.5, 0);
        stationModel.root.scale.set(3, 3, 3);
        this.scene.add(stationModel.root);

        if (stationModel.mixer) {
            this.mixers.push(stationModel.mixer);
        }

        this.loadingOverlay.hide();
    }
}
