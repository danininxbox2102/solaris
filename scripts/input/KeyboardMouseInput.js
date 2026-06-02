export class KeyboardMouseInput {
    constructor(target = window) {
        this.target = target;
        this.lockElement = document.body;
        this.keys = new Set();
        this.pointerButtons = new Set();
        this.pointer = { x: 0, y: 0 };
        this.pointerDelta = { x: 0, y: 0 };
        this.isPointerLocked = false;
        this.isListening = false;

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    }

    start() {
        if (this.isListening) {
            return;
        }

        this.isListening = true;
        this.target.addEventListener('keydown', this.handleKeyDown);
        this.target.addEventListener('keyup', this.handleKeyUp);
        this.target.addEventListener('pointermove', this.handlePointerMove);
        this.lockElement.addEventListener('pointerdown', this.handlePointerDown);
        this.target.addEventListener('pointerup', this.handlePointerUp);
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    }

    stop() {
        if (!this.isListening) {
            return;
        }

        this.isListening = false;
        this.target.removeEventListener('keydown', this.handleKeyDown);
        this.target.removeEventListener('keyup', this.handleKeyUp);
        this.target.removeEventListener('pointermove', this.handlePointerMove);
        this.lockElement.removeEventListener('pointerdown', this.handlePointerDown);
        this.target.removeEventListener('pointerup', this.handlePointerUp);
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
        this.keys.clear();
        this.pointerButtons.clear();
        this.pointer.x = 0;
        this.pointer.y = 0;
        this.pointerDelta.x = 0;
        this.pointerDelta.y = 0;
        this.isPointerLocked = false;

        if (document.pointerLockElement === this.lockElement) {
            document.exitPointerLock();
        }
    }

    isPressed(code) {
        return this.keys.has(code);
    }

    isPointerPressed(button = 0) {
        return this.pointerButtons.has(button);
    }

    getAxis(negativeCode, positiveCode) {
        return Number(this.isPressed(positiveCode)) - Number(this.isPressed(negativeCode));
    }

    consumePointerDelta() {
        const delta = {
            x: this.pointerDelta.x,
            y: this.pointerDelta.y
        };

        this.pointerDelta.x = 0;
        this.pointerDelta.y = 0;

        return delta;
    }

    handleKeyDown(event) {
        this.keys.add(event.code);
    }

    handleKeyUp(event) {
        this.keys.delete(event.code);
    }

    handlePointerDown(event) {
        this.pointerButtons.add(event.button);

        if (document.pointerLockElement || !this.lockElement.requestPointerLock) {
            return;
        }

        this.lockElement.requestPointerLock().then();
    }

    handlePointerUp(event) {
        this.pointerButtons.delete(event.button);
    }

    handlePointerMove(event) {
        if (this.isPointerLocked) {
            this.pointerDelta.x += event.movementX;
            this.pointerDelta.y += event.movementY;
            return;
        }

        const width = Math.max(window.innerWidth, 1);
        const height = Math.max(window.innerHeight, 1);

        this.pointer.x = (event.clientX / width) * 2 - 1;
        this.pointer.y = (event.clientY / height) * 2 - 1;
    }

    handlePointerLockChange() {
        this.isPointerLocked = document.pointerLockElement === this.lockElement;
        this.pointer.x = 0;
        this.pointer.y = 0;
        this.pointerDelta.x = 0;
        this.pointerDelta.y = 0;
    }
}
