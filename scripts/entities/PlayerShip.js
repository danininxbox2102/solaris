import * as THREE from 'three';

const WORLD_FORWARD = new THREE.Vector3(0, 0, -1);
const HITBOX_DEBUG_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    wireframe: true,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
});

export class PlayerShip {
    constructor({ object, input, cameraController }) {
        this.model = object;
        this.object = new THREE.Group();
        this.input = input;
        this.cameraController = cameraController;

        this.velocity = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.cameraPosition = new THREE.Vector3();
        this.cameraTarget = new THREE.Vector3();
        this.targetQuaternion = new THREE.Quaternion();
        this.pitchQuaternion = new THREE.Quaternion();
        this.yawQuaternion = new THREE.Quaternion();
        this.rollQuaternion = new THREE.Quaternion();
        this.mouseTurn = new THREE.Vector2();
        this.previousPosition = new THREE.Vector3();
        this.previousQuaternion = new THREE.Quaternion();
        this.rollVelocity = 0;

        this.settings = {
            acceleration: 34,
            boostMultiplier: 2.2,
            brakeDrag: 5,
            passiveDrag: 0.45,
            maxSpeed: 42,
            maxBoostSpeed: 86,
            pitchSpeed: 1.9,
            yawSpeed: 1.55,
            rollSpeed: 2.8,
            rollAcceleration: 12,
            rollDamping: 2.4,
            mouseSensitivity: 0.0012,
            maxMouseDelta: 70,
            mouseSmoothing: 14,
            mouseDeadZone: 0.04,
            cameraDistance: 10,
            cameraHeight: 3.2,
            cameraLookAhead: 8,
            cameraLerp: 0.08
        };

        this.object.name = 'PlayerShip';
        this.object.position.set(0, 4, 18);
        this.object.rotation.set(0, 0, 0);

        this.model.name = 'PlayerShipModel';
        this.model.rotation.set(0, Math.PI, 0);
        this.model.scale.set(0.8, 0.8, 0.8);
        this.object.add(this.model);
    }

    setHitbox(hitbox) {
        hitbox.name = 'PlayerShipHitbox';
        hitbox.position.copy(this.model.position);
        hitbox.rotation.copy(this.model.rotation);
        hitbox.scale.copy(this.model.scale);
        hitbox.visible = true;
        hitbox.traverse((object) => {
            if (object.isMesh) {
                object.material = HITBOX_DEBUG_MATERIAL;
            }
        });

        this.object.add(hitbox);
    }

    update(delta, resolveCollision) {
        const frameDelta = Math.min(delta, 0.05);

        this.previousPosition.copy(this.object.position);
        this.previousQuaternion.copy(this.object.quaternion);
        this.updateRotation(frameDelta);
        this.updateMovement(frameDelta);

        if (resolveCollision) {
            resolveCollision(this.previousPosition, this.previousQuaternion, frameDelta);
        }

        this.updateCamera();
    }

    updateRotation(delta) {
        const pointerTurn = this.getPointerTurn(delta);
        const keyboardYaw = this.input.getAxis('KeyQ', 'KeyE');
        const keyboardPitch = this.input.getAxis('ArrowDown', 'ArrowUp');
        const rollInput = this.input.getAxis('KeyA', 'KeyD');

        this.rollVelocity += rollInput * this.settings.rollAcceleration * delta;
        this.rollVelocity *= Math.exp(-this.settings.rollDamping * delta);
        this.rollVelocity = THREE.MathUtils.clamp(
            this.rollVelocity,
            -this.settings.rollSpeed,
            this.settings.rollSpeed
        );

        if (Math.abs(this.rollVelocity) < 0.001) {
            this.rollVelocity = 0;
        }

        this.pitchQuaternion.setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            -pointerTurn.y + keyboardPitch * this.settings.pitchSpeed * delta
        );
        this.yawQuaternion.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            -pointerTurn.x + keyboardYaw * this.settings.yawSpeed * delta
        );
        this.rollQuaternion.setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            -this.rollVelocity * delta
        );

        this.object.quaternion.multiply(this.yawQuaternion);
        this.object.quaternion.multiply(this.pitchQuaternion);
        this.object.quaternion.multiply(this.rollQuaternion);
        this.object.quaternion.normalize();
    }

    getPointerTurn(delta) {
        if (!this.input.isPointerLocked) {
            this.mouseTurn.set(
                this.applyDeadZone(this.input.pointer.x) * this.settings.yawSpeed * delta,
                this.applyDeadZone(this.input.pointer.y) * this.settings.pitchSpeed * delta
            );

            return this.mouseTurn;
        }

        const pointerDelta = this.input.consumePointerDelta();
        const targetTurn = new THREE.Vector2(
            THREE.MathUtils.clamp(pointerDelta.x, -this.settings.maxMouseDelta, this.settings.maxMouseDelta),
            THREE.MathUtils.clamp(pointerDelta.y, -this.settings.maxMouseDelta, this.settings.maxMouseDelta)
        ).multiplyScalar(this.settings.mouseSensitivity);
        const smoothing = 1 - Math.exp(-this.settings.mouseSmoothing * delta);

        this.mouseTurn.lerp(targetTurn, smoothing);

        return this.mouseTurn;
    }

    updateMovement(delta) {
        const throttle = this.input.getAxis('KeyS', 'KeyW');
        const isBoosting = this.input.isPressed('ShiftLeft') || this.input.isPressed('ShiftRight');
        const isBraking = this.input.isPressed('ControlLeft') || this.input.isPressed('ControlRight');
        const acceleration = this.settings.acceleration * (isBoosting ? this.settings.boostMultiplier : 1);
        const maxSpeed = isBoosting ? this.settings.maxBoostSpeed : this.settings.maxSpeed;

        this.forward.copy(WORLD_FORWARD).applyQuaternion(this.object.quaternion).normalize();
        this.velocity.addScaledVector(this.forward, throttle * acceleration * delta);
        this.velocity.multiplyScalar(Math.max(0, 1 - this.settings.passiveDrag * delta));

        if (isBraking) {
            this.velocity.multiplyScalar(Math.max(0, 1 - this.settings.brakeDrag * delta));
        }

        if (this.velocity.lengthSq() > maxSpeed * maxSpeed) {
            this.velocity.setLength(maxSpeed);
        }

        this.object.position.addScaledVector(this.velocity, delta);
    }

    updateCamera() {
        this.forward.copy(WORLD_FORWARD).applyQuaternion(this.object.quaternion).normalize();

        this.cameraTarget.copy(this.object.position).addScaledVector(
            this.forward,
            this.settings.cameraLookAhead
        );
        this.cameraPosition.copy(this.object.position)
            .addScaledVector(this.forward, -this.settings.cameraDistance)
            .add(new THREE.Vector3(0, this.settings.cameraHeight, 0));

        const camera = this.cameraController.camera;
        camera.position.lerp(this.cameraPosition, this.settings.cameraLerp);
        camera.lookAt(this.cameraTarget);
    }

    applyDeadZone(value) {
        return Math.abs(value) < this.settings.mouseDeadZone ? 0 : value;
    }
}
