export class DebugOverlay {
    constructor(selector, gameApp) {
        this.element = document.querySelector(selector);
        this.gameApp = gameApp;
    }

    update(camera) {
        if (!this.element) {
            return;
        }

        if (this.gameApp.activeSceneName === 'menu') return;

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
