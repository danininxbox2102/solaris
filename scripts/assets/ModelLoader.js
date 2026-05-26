import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelLoader {
    constructor(loader = new GLTFLoader()) {
        this.loader = loader;
    }

    load(url, { onProgress } = {}) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => resolve(this.createModelResource(gltf)),
                (event) => {
                    if (!event.lengthComputable || !onProgress) {
                        return;
                    }

                    onProgress(Math.round((event.loaded / event.total) * 100));
                },
                reject
            );
        });
    }

    createModelResource(gltf) {
        const root = gltf.scene;
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0, 0);
        root.scale.set(1, 1, 1);

        const mixer = this.createAnimationMixer(root, gltf.animations);

        return {
            root,
            mixer,
            animations: gltf.animations
        };
    }

    createAnimationMixer(root, animations) {
        if (animations.length === 0) {
            return null;
        }

        const mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(animations[0]).play();

        return mixer;
    }
}
