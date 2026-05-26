export class GameLoop {
    constructor({ onUpdate, onRender }) {
        this.onUpdate = onUpdate;
        this.onRender = onRender;
        this.frameId = null;
        this.isRunning = false;

        this.tick = this.tick.bind(this);
    }

    start() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.tick();
    }

    stop() {
        this.isRunning = false;

        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    tick() {
        if (!this.isRunning) {
            return;
        }

        this.onUpdate();
        this.onRender();
        this.frameId = requestAnimationFrame(this.tick);
    }
}
