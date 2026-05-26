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

    formatVector(vector) {
        return `${this.format(vector.x)} ${this.format(vector.y)} ${this.format(vector.z)}`;
    }

    formatEuler(euler) {
        return `${this.format(euler.x)} ${this.format(euler.y)} ${this.format(euler.z)}`;
    }

    format(value) {
        return Number(value).toFixed(3);
    }
}
