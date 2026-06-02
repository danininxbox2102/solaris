import * as THREE from 'three';
import { Entity } from './Entity.js';

const WORLD_FORWARD = new THREE.Vector3(0, 0, -1);
const HITBOX_DEBUG_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    wireframe: true,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
});

export class PlayerShip extends Entity {
    constructor({ object, input, cameraController }) {
        super({
            name: 'PlayerShip',
            maxHealth: 100
        });

        this.model = object;
        this.visualBankGroup = new THREE.Group();
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
        this.aimOffset = new THREE.Vector2();
        this.aimTurn = new THREE.Vector2();
        this.aimHudOffset = new THREE.Vector2();
        this.targetAimOffset = new THREE.Vector2();
        this.previousPosition = new THREE.Vector3();
        this.previousQuaternion = new THREE.Quaternion();
        this.shipUp = new THREE.Vector3(0, 1, 0);
        this.shipRight = new THREE.Vector3(1, 0, 0);
        this.bankedCameraUp = new THREE.Vector3(0, 1, 0);
        this.cameraUp = new THREE.Vector3(0, 1, 0);
        this.rollVelocity = 0;
        this.autoBankAngle = 0;

        this.settings = {
            acceleration: 34,
            boostMultiplier: 2.2,
            brakeDrag: 5,
            passiveDrag: 0.45,
            maxSpeed: 42,
            maxBoostSpeed: 86,
            pitchSpeed: 1.35,
            yawSpeed: 1.28,
            rollSpeed: 2.9,
            rollAcceleration: 10.5,
            rollDamping: 2.7,
            mouseSensitivity: 0.00155,
            aimRadius: 1,
            aimSoftZone: 0.26,
            aimInnerTurnScale: 0.18,
            aimSmoothing: 8,
            aimOffsetSmoothing: 18,
            aimReturnSpeed: 0.22,
            autoBankMaxAngle: 0.42,
            autoBankSmoothing: 5.5,
            cameraAutoBankFactor: 0.45,
            cameraDistance: 10,
            cameraHeight: 3.2,
            cameraLookAhead: 8,
            cameraSideOffset: 0,
            cameraLerp: 0.08,
            cameraUpLerp: 0.12
        };

        this.object.position.set(0, 4, 18);
        this.object.rotation.set(0, 0, 0);
        this.visualBankGroup.name = 'PlayerShipVisualBank';
        this.object.add(this.visualBankGroup);

        this.model.name = 'PlayerShipModel';
        this.model.rotation.set(0, Math.PI, 0);
        this.model.scale.set(0.8, 0.8, 0.8);
        this.visualBankGroup.add(this.model);
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

        this.visualBankGroup.add(hitbox);
    }

    update(delta, resolveCollision) {
        if (!this.isAlive) {
            this.velocity.set(0, 0, 0);
            this.updateCamera();
            return;
        }

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
        const targetAutoBankAngle = -this.mouseTurn.x * this.settings.autoBankMaxAngle;
        const autoBankSmoothing = 1 - Math.exp(-this.settings.autoBankSmoothing * delta);

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

        this.autoBankAngle = THREE.MathUtils.lerp(
            this.autoBankAngle,
            targetAutoBankAngle,
            autoBankSmoothing
        );
        this.visualBankGroup.rotation.z = this.autoBankAngle;

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
        if (this.input.isPointerLocked) {
            const pointerDelta = this.input.consumePointerDelta();
            this.targetAimOffset.addScaledVector(
                new THREE.Vector2(pointerDelta.x, pointerDelta.y),
                this.settings.mouseSensitivity
            );
        } else {
            this.targetAimOffset.set(this.input.pointer.x, this.input.pointer.y);
        }

        const targetOffset = this.targetAimOffset;
        const targetLength = targetOffset.length();

        if (targetLength > this.settings.aimRadius) {
            targetOffset.multiplyScalar(this.settings.aimRadius / targetLength);
        }

        if (
            !this.input.isPointerLocked &&
            Math.abs(this.input.pointer.x) < 0.001 &&
            Math.abs(this.input.pointer.y) < 0.001
        ) {
            const returnFactor = 1 - Math.exp(-this.settings.aimReturnSpeed * delta);
            targetOffset.lerp(new THREE.Vector2(0, 0), returnFactor);
        }

        const offsetSmoothing = 1 - Math.exp(-this.settings.aimOffsetSmoothing * delta);
        this.aimOffset.lerp(targetOffset, offsetSmoothing);

        const aimLength = this.aimOffset.length();
        let targetTurn;

        if (aimLength <= this.settings.aimSoftZone) {
            targetTurn = this.aimTurn.copy(this.aimOffset)
                .multiplyScalar(this.settings.aimInnerTurnScale / this.settings.aimSoftZone);
        } else {
            const outerRange = Math.max(0.001, this.settings.aimRadius - this.settings.aimSoftZone);
            const strength = THREE.MathUtils.smoothstep(
                (aimLength - this.settings.aimSoftZone) / outerRange,
                0,
                1
            );

            targetTurn = this.aimTurn.copy(this.aimOffset)
                .normalize()
                .multiplyScalar(this.settings.aimInnerTurnScale + (1 - this.settings.aimInnerTurnScale) * strength);
        }

        const smoothing = 1 - Math.exp(-this.settings.aimSmoothing * delta);

        this.mouseTurn.lerp(targetTurn, smoothing);
        this.aimHudOffset.copy(this.aimOffset);

        return this.mouseTurn.clone().multiply(new THREE.Vector2(
            this.settings.yawSpeed * delta,
            this.settings.pitchSpeed * delta
        ));
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
        this.shipUp.set(0, 1, 0).applyQuaternion(this.object.quaternion).normalize();
        this.shipRight.set(1, 0, 0).applyQuaternion(this.object.quaternion).normalize();

        this.cameraTarget.copy(this.object.position).addScaledVector(
            this.forward,
            this.settings.cameraLookAhead
        );
        this.cameraPosition.copy(this.object.position)
            .addScaledVector(this.forward, -this.settings.cameraDistance)
            .addScaledVector(this.shipUp, this.settings.cameraHeight)
            .addScaledVector(this.shipRight, this.settings.cameraSideOffset);

        const camera = this.cameraController.camera;
        camera.position.lerp(this.cameraPosition, this.settings.cameraLerp);
        this.bankedCameraUp.copy(this.shipUp)
            .applyAxisAngle(this.forward, -this.autoBankAngle * this.settings.cameraAutoBankFactor)
            .normalize();
        this.cameraUp.lerp(this.bankedCameraUp, this.settings.cameraUpLerp).normalize();
        camera.up.copy(this.cameraUp);
        camera.lookAt(this.cameraTarget);
    }

    getFlightAimState() {
        return {
            x: this.aimHudOffset.x,
            y: this.aimHudOffset.y,
            softZone: this.settings.aimSoftZone,
            radius: this.settings.aimRadius
        };
    }
}
