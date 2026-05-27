import * as THREE from 'three';

export class SceneController {
    constructor(backgroundColor) {
        this.backgroundColor = backgroundColor;
        this.scene = this.createScene();
    }

    createScene() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(this.backgroundColor);

        return scene;
    }

    setActiveScene(scene) {
        this.scene = scene;
    }

    createSkybox() {
        const texture = new THREE.CubeTextureLoader().load([
            './assets/img/skybox/T_CentaurusA_pos_x.png',
            './assets/img/skybox/T_CentaurusA_neg_x.png',
            './assets/img/skybox/T_CentaurusA_pos_z.png',
            './assets/img/skybox/T_CentaurusA_neg_z.png',
            './assets/img/skybox/T_CentaurusA_neg_y.png',
            './assets/img/skybox/T_CentaurusA_pos_y.png',
        ]);

        // const textureF = new THREE.TextureLoader().load('./assets/img/skybox/T_CentaurusA_pos_x.png');
        // const textureB = new THREE.TextureLoader().load('./assets/img/skybox/T_CentaurusA_neg_x.png');
        // const textureU = new THREE.TextureLoader().load('./assets/img/skybox/T_CentaurusA_pos_z.png');
        // const textureD = new THREE.TextureLoader().load('./assets/img/skybox/T_CentaurusA_neg_z.png');
        // const textureR = new THREE.TextureLoader().load('./assets/img/skybox/T_CentaurusA_neg_y.png');
        // const textureL = new THREE.TextureLoader().load('./assets/img/skybox/T_CentaurusA_pos_y.png ');

        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    setupDefaultWorld(scene = this.scene, { gridSize = 10, gridDivisions = 10 } = {}) {
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        scene.add(new THREE.GridHelper(gridSize, gridDivisions));

        scene.background = this.createSkybox();
    }


    add(object) {
        this.scene.add(object);
    }

    remove(object) {
        this.scene.remove(object);
    }
}
