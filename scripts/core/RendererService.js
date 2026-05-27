import * as THREE from 'three';

export class RendererService {
    constructor(canvasParent) {
        this.canvasParent = canvasParent;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;

        this.canvasParent.appendChild(this.renderer.domElement);
    }

    get domElement() {
        return this.renderer.domElement;
    }

    resize(width, height) {
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    render(scene, camera) {
        this.renderer.render(scene, camera);
    }

    renderWithoutClear(scene, camera) {
        const previousAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;

        try {
            this.renderer.render(scene, camera);
        } finally {
            this.renderer.autoClear = previousAutoClear;
        }
    }

    clearDepth() {
        this.renderer.clearDepth();
    }

    dispose() {
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
