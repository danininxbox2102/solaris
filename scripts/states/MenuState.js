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
        this.stationPos = { x: 20, y: 1.5, z:-10 };
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

        this.planetModel.rotation.y -= delta * 0.03;
    }

    setupCamera() {
        this.cameraController.setControlsEnabled(true);
        this.cameraController.setView(
            new THREE.Vector3(2.8, 1.2, 0.4),
            new THREE.Vector3(10, 1.1, -3)
        );

        this.cameraController.controls.enablePan = false;
        this.cameraController.controls.enableZoom = false;
        this.cameraController.controls.enableRotate = false;
    }

    setupLights() {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(3,10,0)
        directionalLight.lookAt(this.stationPos.x,this.stationPos.y,this.stationPos.z);

        const directionalLight2 = new THREE.DirectionalLight(0xc24d00, 1);
        //directionalLight.position.set(2.8, 1.2, 0.4);
        directionalLight2.position.set(2,6,-20)
        directionalLight2.lookAt(this.stationPos.x,this.stationPos.y,this.stationPos.z);


        const cratesLight = new THREE.SpotLight(0x6cb7d2, 5);
        cratesLight.name = 'cratesLight';
        cratesLight.position.set(10, 0.5, 0.4);

        this.scene.add(directionalLight, cratesLight, directionalLight2);
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

        const stationModel = await this.modelLoader.load(this.config.models.station, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        stationModel.root.position.set(this.stationPos.x,this.stationPos.y,this.stationPos.z)
        stationModel.root.scale.set(3,3,3)

        this.scene.add(stationModel.root);

        if (stationModel.mixer) {
            this.mixers.push(stationModel.mixer);
        }

        const planetModel = await this.modelLoader.load(this.config.models.planet, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        planetModel.root.position.set(10,0,-20)
        planetModel.root.scale.set(3,3,3)

        this.planetModel = planetModel.root;

        this.scene.add(planetModel.root);

        this.loadingOverlay.hide();
    }
}
