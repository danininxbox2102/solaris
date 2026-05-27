import * as THREE from 'three';

export class SceneController {
    constructor(backgroundColor, gameApp) {
        this.backgroundColor = backgroundColor;
        this.scene = this.createScene();
        this.gameApp = gameApp;
    }

    createScene() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(this.backgroundColor);

        return scene;
    }

    setActiveScene(scene) {
        this.scene = scene;
    }

    setupDefaultWorld(scene = this.scene, { gridSize = 10, gridDivisions = 10 } = {}) {
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        scene.add(new THREE.GridHelper(gridSize, gridDivisions));

        scene.background = this.gameApp.skybox;
    }


    add(object) {
        this.scene.add(object);
    }

    remove(object) {
        this.scene.remove(object);
    }
}
