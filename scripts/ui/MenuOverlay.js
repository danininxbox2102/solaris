export class DebugOverlay {
    constructor(selector) {
        this.element = document.querySelector(selector);
    }

    update(camera) {
        if (!this.element) {
            return;
        }

        this.element.innerHTML = `
            Camera position: ${this.formatVector(camera.position)}<br>
            Camera rotation: ${this.formatEuler(camera.rotation)}
        `;
    }
}
