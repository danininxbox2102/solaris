import * as THREE from 'three';

export class HangarState {
    constructor({ sceneController, cameraController, loadingOverlay, modelLoader, config }) {
        this.sceneController = sceneController;
        this.cameraController = cameraController;
        this.loadingOverlay = loadingOverlay;
        this.modelLoader = modelLoader;
        this.config = config;
        this.scene = this.sceneController.createScene();
        this.mixers = [];
        this.alwaysOnTopObjects = new Set();
        this.isLoaded = false;
        this.isActive = false;
        this.ship = null;
        this.isShipRotating = false;
    }

    async enter() {
        this.isActive = true;
        this.sceneController.setActiveScene(this.scene);
        this.setupCamera();

        if (!this.isLoaded) {
            this.loadingOverlay.setMessage('Загрузка ангара...');

            this.ship = await this.loadShip();
            await this.setupHangar();

            this.sceneController.setupDefaultWorld(this.scene, { gridSize: 0, gridDivisions: 0 }); //24
            this.setupLights();


            this.scene.add(this.ship);
            this.isLoaded = true;
            this.loadingOverlay.hide();
        }
    }

    exit() {
        this.isActive = false;
    }

    update(delta) {
        if (!this.ship) {
            return;
        }

        if (this.isShipRotating) this.ship.rotation.y += delta * 0.15;
    }

    setupCamera() {
        this.cameraController.setControlsEnabled(true);
        this.cameraController.setView(
            new THREE.Vector3(-7, 6, -30),
            new THREE.Vector3(0, 1.2, 0)
        );

        this.cameraController.controls.enablePan = false;
        this.cameraController.controls.enableZoom = true;
        this.cameraController.controls.enableRotate = true;

        this.cameraController.controls.maxDistance = 11.5;
        this.cameraController.controls.minDistance = 3;
        this.cameraController.controls.maxPolarAngle = Math.PI / 2
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xd7e8ff, 5);
        const key = new THREE.DirectionalLight(0xffffff, 1.5);
        key.position.set(4, 8, 5);

        const pointLight = new THREE.PointLight(0x6cb7d2, 8, 14);
        pointLight.position.set(0, 4, 0);

        this.scene.add(ambient, key, pointLight);
    }

    async setupHangar() {
        const hangarModel = await this.modelLoader.load(this.config.models.hangar, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        const hangar = hangarModel.root;

        hangar.scale.set(10, 10, 10);
        hangar.position.set(0, 6.75, 0);

        this.scene.add(hangar);
    }

    async loadShip() {
        const shipModel = await this.modelLoader.load(this.config.models.ship, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        shipModel.root.rotation.y = Math.PI;

        return shipModel.root
    }
}
