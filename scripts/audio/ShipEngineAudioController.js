export class ShipEngineAudioController {
    constructor({ input, soundManager }) {
        this.input = input;
        this.soundManager = soundManager;
        this.engineRunSound = null;
        this.engineRunPromise = null;
        this.engineFastSound = null;
        this.engineFastPromise = null;
        this.isEngineRunning = false;
        this.isEngineFastRunning = false;
        this.wasAccelerating = false;
        this.wasReversing = false;
        this.wasBraking = false;
        this.wasBoosting = false;
    }

    update() {
        const isAccelerating = this.input.isPressed('KeyW');
        const isReversing = this.input.isPressed('KeyS');
        const isBraking = this.input.isPressed('ControlLeft') ||
            this.input.isPressed('ControlRight');
        const isBoosting = (this.input.isPressed('ShiftLeft') || this.input.isPressed('ShiftRight')) &&
            (isAccelerating || isReversing);

        if (isAccelerating && !this.wasAccelerating) {
            this.soundManager.playSfx('shipEngineAccelerate').catch(console.error);
        }

        if (isBoosting) {
            this.startEngineFastSound();
        } else {
            this.stopEngineFastSound();
        }

        if (
            (this.wasAccelerating && !isAccelerating) ||
            (this.wasReversing && !isReversing) ||
            (isBraking && !this.wasBraking)
        ) {
            this.soundManager.playSfx('shipEngineSlow').catch(console.error);
        }

        if (isAccelerating && !isBraking) {
            this.startEngineRunSound();
        } else {
            this.stopEngineRunSound();
        }

        this.wasAccelerating = isAccelerating;
        this.wasReversing = isReversing;
        this.wasBraking = isBraking;
        this.wasBoosting = isBoosting;
    }

    startEngineRunSound() {
        if (this.isEngineRunning || this.engineRunPromise) {
            return;
        }

        this.isEngineRunning = true;
        this.engineRunPromise = this.soundManager.playSfx('shipEngineRun', { loop: true })
            .then((instance) => {
                this.engineRunSound = instance;
                this.engineRunPromise = null;

                if (!this.isEngineRunning) {
                    this.stopEngineRunSound();
                }
            })
            .catch((error) => {
                this.isEngineRunning = false;
                this.engineRunPromise = null;
                console.error(error);
            });
    }

    stopEngineRunSound() {
        this.isEngineRunning = false;

        if (!this.engineRunSound) {
            return;
        }

        this.engineRunSound.stop({ fadeOut: 0.12 });
        this.engineRunSound = null;
    }

    startEngineFastSound() {
        if (this.isEngineFastRunning || this.engineFastPromise) {
            return;
        }

        this.isEngineFastRunning = true;
        this.engineFastPromise = this.soundManager.playSfx('shipEngineFast', { loop: true })
            .then((instance) => {
                this.engineFastSound = instance;
                this.engineFastPromise = null;

                if (!this.isEngineFastRunning) {
                    this.stopEngineFastSound();
                }
            })
            .catch((error) => {
                this.isEngineFastRunning = false;
                this.engineFastPromise = null;
                console.error(error);
            });
    }

    stopEngineFastSound() {
        this.isEngineFastRunning = false;

        if (!this.engineFastSound) {
            return;
        }

        this.engineFastSound.stop({ fadeOut: 0.12 });
        this.engineFastSound = null;
    }

    stop() {
        this.stopEngineRunSound();
        this.stopEngineFastSound();
        this.wasAccelerating = false;
        this.wasReversing = false;
        this.wasBraking = false;
        this.wasBoosting = false;
        this.soundManager.stopSfx('shipEngineAccelerate', { fadeOut: 0.05 });
        this.soundManager.stopSfx('shipEngineFast', { fadeOut: 0.05 });
        this.soundManager.stopSfx('shipEngineSlow', { fadeOut: 0.05 });
    }
}
