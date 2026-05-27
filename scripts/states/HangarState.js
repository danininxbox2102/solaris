import * as THREE from 'three';

export class HangarState {
    constructor({ sceneController, cameraController, loadingOverlay }) {
        this.sceneController = sceneController;
        this.cameraController = cameraController;
        this.loadingOverlay = loadingOverlay;

        this.scene = this.sceneController.createScene();
        this.mixers = [];
        this.alwaysOnTopObjects = new Set();
        this.isLoaded = false;
        this.isActive = false;
        this.ship = null;
    }

    async enter() {
        this.isActive = true;
        this.sceneController.setActiveScene(this.scene);
        this.setupCamera();

        if (!this.isLoaded) {
            this.loadingOverlay.setMessage('Загрузка ангара...');
            this.sceneController.setupDefaultWorld(this.scene, { gridSize: 24, gridDivisions: 24 });
            this.setupLights();
            this.setupHangar();
            this.ship = this.createShip();
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

        this.ship.rotation.y += delta * 0.15;
    }

    setupCamera() {
        this.cameraController.setControlsEnabled(true);
        this.cameraController.setView(
            new THREE.Vector3(6, 4, 8),
            new THREE.Vector3(0, 1.2, 0)
        );
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xd7e8ff, 0.45);
        const key = new THREE.DirectionalLight(0xffffff, 1.5);
        key.position.set(4, 8, 5);

        const stripLight = new THREE.PointLight(0x6cb7d2, 8, 14);
        stripLight.position.set(0, 4, 0);

        this.scene.add(ambient, key, stripLight);
    }

    setupHangar() {
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(18, 0.25, 14),
            new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.65, metalness: 0.25 })
        );
        floor.position.y = -0.15;

        const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(3.2, 3.2, 0.12, 64),
            new THREE.MeshStandardMaterial({ color: 0x3e5863, roughness: 0.4, metalness: 0.55 })
        );
        pad.position.y = 0.02;

        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2228, roughness: 0.5, metalness: 0.35 });

        const backWall = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 0.3), wallMaterial);
        backWall.position.set(0, 2.3, -7);

        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 14), wallMaterial);
        leftWall.position.set(-9, 2.3, 0);

        const rightWall = leftWall.clone();
        rightWall.position.x = 9;

        this.scene.add(floor, pad, backWall, leftWall, rightWall);
    }

    createShip() {
        const ship = new THREE.Group();
        ship.name = 'HangarShip';

        const hullMaterial = new THREE.MeshStandardMaterial({
            color: 0xb9c4cb,
            roughness: 0.32,
            metalness: 0.8
        });
        const cockpitMaterial = new THREE.MeshStandardMaterial({
            color: 0x172a38,
            emissive: 0x08243a,
            roughness: 0.2,
            metalness: 0.4
        });
        const engineMaterial = new THREE.MeshStandardMaterial({
            color: 0x64c7ff,
            emissive: 0x15648c,
            roughness: 0.15,
            metalness: 0.2
        });

        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.8, 12, 24), hullMaterial);
        body.rotation.z = Math.PI / 2;
        body.position.y = 1.1;

        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12), cockpitMaterial);
        cockpit.scale.set(1, 0.45, 0.7);
        cockpit.position.set(0.45, 1.35, 0);

        const wingGeometry = new THREE.BoxGeometry(1.8, 0.08, 0.55);
        const leftWing = new THREE.Mesh(wingGeometry, hullMaterial);
        leftWing.position.set(-0.2, 0.95, 0.75);
        leftWing.rotation.y = -0.18;

        const rightWing = leftWing.clone();
        rightWing.position.z = -0.75;
        rightWing.rotation.y = 0.18;

        const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 24), engineMaterial);
        engine.rotation.z = Math.PI / 2;
        engine.position.set(-1.65, 1.1, 0);

        ship.add(body, cockpit, leftWing, rightWing, engine);

        return ship;
    }
}
