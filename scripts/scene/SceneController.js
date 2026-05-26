import * as THREE from 'three';

export class SceneController {
    constructor(backgroundColor) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(backgroundColor);
    }

    createSkybox() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        return new THREE.Mesh(geometry, material);
    }

    setupDefaultWorld() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        this.scene.add(new THREE.GridHelper(10, 10));

        this.scene.add(this.createSkybox())
    }


    add(object) {
        this.scene.add(object);
    }

    remove(object) {
        this.scene.remove(object);
    }
}
