import * as THREE from 'three';

export class MenuState {
    constructor(scene, cameraController) {
        this.scene = scene;
        this.cameraController = cameraController;
        this.objects = [];
        this.isActive = false;
    }

    enter() {
        if (this.isActive) {
            return;
        }

        this.isActive = true;

        this.setupCamera();
        this.setupLights();
    }

    exit() {
        if (!this.isActive) {
            return;
        }

        for (const object of this.objects) {
            this.scene.remove(object);
        }

        this.objects = [];
        this.isActive = false;
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

        const ambientLight = new THREE.AmbientLight(0xffffc2, 10);
        ambientLight.position.set(2.8, 1.2, 0.4);

        const cratesLight = new THREE.AmbientLight(0x6cb7d2, 5);
        cratesLight.name = 'cratesLight';
        cratesLight.position.set(10, .5, 0.4);

        // const cratesLightDebugObject = this.createLightDebugObject(cratesLight);


        this.addMenuObject(directionalLight);
        this.addMenuObject(cratesLight);
        // this.addMenuObject(cratesLightDebugObject);
    }

    createLightDebugObject(light) {
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshBasicMaterial({
                color: light.color,
                depthTest: false,
                depthWrite: false
            })
        );

        marker.name = `${light.name}DebugObject`;
        marker.position.copy(light.position);
        marker.renderOrder = 999;

        return marker;
    }

    addMenuObject(object) {
        this.scene.add(object);
        this.objects.push(object);
    }
}
