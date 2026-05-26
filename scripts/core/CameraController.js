import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
    constructor(config, domElement) {
        this.camera = new THREE.PerspectiveCamera(
            config.fov,
            window.innerWidth / window.innerHeight,
            config.near,
            config.far
        );

        this.camera.position.copy(config.startPosition);

        this.controls = new OrbitControls(this.camera, domElement);
        this.controls.enabled = config.controlsEnabled ?? false;
        this.controls.enableDamping = true;
        this.controls.target.copy(config.target);
    }

    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    lookAt(target) {
        this.camera.lookAt(target);
    }

    setView(position, target) {
        this.camera.position.copy(position);
        this.camera.up.set(0, 1, 0);
        this.controls.target.copy(target);
        this.lookAt(target);
    }

    setControlsEnabled(isEnabled) {
        this.controls.enabled = isEnabled;
    }

    update() {
        if (!this.controls.enabled) {
            return;
        }

        this.controls.update();
    }

    dispose() {
        this.controls.dispose();
    }
}
