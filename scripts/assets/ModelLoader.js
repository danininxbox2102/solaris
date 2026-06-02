import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class ModelLoader {
    constructor(loader = null) {
        if (loader) {
            this.loader = loader;
            return;
        }

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/');

        this.loader = new GLTFLoader();
        this.loader.setDRACOLoader(dracoLoader);
    }

    load(url, { onProgress, autoPlayAnimations = true } = {}) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => resolve(this.createModelResource(gltf, { autoPlayAnimations })),
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

    createModelResource(gltf, { autoPlayAnimations } = {}) {
        const root = gltf.scene;
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0, 0);
        root.scale.set(1, 1, 1);

        const mixer = this.createAnimationMixer(root, gltf.animations, { autoPlayAnimations });

        return {
            root,
            mixer,
            animations: gltf.animations
        };
    }

    createAnimationMixer(root, animations, { autoPlayAnimations = true } = {}) {
        if (animations.length === 0) {
            return null;
        }

        const mixer = new THREE.AnimationMixer(root);

        if (autoPlayAnimations) {
            for (const animation of animations) {
                mixer.clipAction(animation).play();
            }
        }

        return mixer;
    }
}
