import * as THREE from 'three';
import { Entity } from './Entity.js';

const HULL_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x8f1724,
    roughness: 0.42,
    metalness: 0.55,
    emissive: 0x220006,
    emissiveIntensity: 0.45
});
const ENGINE_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xff5533,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    toneMapped: false
});
const HULL_GEOMETRY = new THREE.ConeGeometry(1.2, 4.2, 5);
const WING_GEOMETRY = new THREE.BoxGeometry(3.2, 0.18, 1.05);
const ENGINE_GEOMETRY = new THREE.SphereGeometry(0.36, 12, 8);
const WORLD_FORWARD = new THREE.Vector3(0, 0, -1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

HULL_GEOMETRY.rotateX(Math.PI / 2);

export class EnemyShip extends Entity {
    constructor({ position, target = null } = {}) {
        super({
            name: 'EnemyShip',
            object: new THREE.Group(),
            maxHealth: 5
        });

        this.target = target;
        this.velocity = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.targetDirection = new THREE.Vector3();
        this.radialDirection = new THREE.Vector3();
        this.orbitDirection = new THREE.Vector3();
        this.desiredVelocity = new THREE.Vector3();
        this.lookDirection = new THREE.Vector3();
        this.spawnPhase = Math.random() * Math.PI * 2;
        this.orbitSign = Math.random() < 0.5 ? -1 : 1;
        this.combatMode = 'attack';
        this.modeElapsed = 0;
        this.weaponCooldown = 0.6 + Math.random() * 0.9;
        this.radius = 4.4;
        this.maxSpeed = 58 + Math.random() * 12;
        this.turnSpeed = 4.8;
        this.acceleration = 2.8 + Math.random() * 0.7;
        this.attackDistance = 340 + Math.random() * 90;
        this.retreatDistance = 650 + Math.random() * 140;
        this.attackDuration = 1.4 + Math.random() * 0.5;
        this.reloadDuration = 2.4 + Math.random() * 0.8;
        this.fireInterval = 0.68 + Math.random() * 0.22;
        this.minCombatDistance = 240;
        this.orbitSpeed = 0.7 + Math.random() * 0.25;

        this.object.name = this.name;
        this.object.position.copy(position ?? new THREE.Vector3());
        this.object.scale.setScalar(2.8);
        this.object.add(this.createVisual());
    }

    createVisual() {
        const visual = new THREE.Group();
        const hull = new THREE.Mesh(HULL_GEOMETRY, HULL_MATERIAL);
        const leftWing = new THREE.Mesh(WING_GEOMETRY, HULL_MATERIAL);
        const rightWing = new THREE.Mesh(WING_GEOMETRY, HULL_MATERIAL);
        const engine = new THREE.Mesh(ENGINE_GEOMETRY, ENGINE_MATERIAL);

        leftWing.position.set(-1.25, 0, 0.45);
        leftWing.rotation.z = -0.2;
        rightWing.position.set(1.25, 0, 0.45);
        rightWing.rotation.z = 0.2;
        engine.position.set(0, 0, 1.9);
        engine.scale.set(1, 1, 1.8);

        visual.add(hull, leftWing, rightWing, engine);

        return visual;
    }

    setTarget(target) {
        this.target = target;
    }

    update(delta, onFire = null) {
        if (!this.isAlive) {
            return;
        }

        const targetPosition = this.target?.object?.position;

        if (targetPosition) {
            this.updateCombatMovement(delta, targetPosition, onFire);
        }

        this.object.position.addScaledVector(this.velocity, delta);
        this.object.rotation.z += Math.sin(performance.now() * 0.0015 + this.spawnPhase) * delta * 0.16;
    }

    updateCombatMovement(delta, targetPosition, onFire) {
        this.targetDirection.subVectors(targetPosition, this.object.position);

        const distance = this.targetDirection.length();

        if (distance <= 1) {
            return;
        }

        this.modeElapsed += delta;
        this.weaponCooldown = Math.max(0, this.weaponCooldown - delta);
        this.radialDirection.copy(this.targetDirection).divideScalar(distance);
        this.orbitDirection.crossVectors(this.radialDirection, WORLD_UP);

        if (this.orbitDirection.lengthSq() < 0.001) {
            this.orbitDirection.set(1, 0, 0);
        } else {
            this.orbitDirection.normalize().multiplyScalar(this.orbitSign);
        }

        if (this.combatMode === 'attack') {
            this.updateAttackMovement(distance, onFire);
        } else {
            this.updateReloadMovement(distance);
        }

        this.velocity.lerp(
            this.desiredVelocity,
            Math.min(1, this.acceleration * delta)
        );
        this.lookAtTarget(delta);
    }

    updateAttackMovement(distance, onFire) {
        this.desiredVelocity.copy(this.orbitDirection)
            .multiplyScalar(this.maxSpeed * this.orbitSpeed);

        if (distance > this.attackDistance * 1.12) {
            this.desiredVelocity.addScaledVector(this.radialDirection, this.maxSpeed);
        } else if (distance < this.minCombatDistance) {
            this.desiredVelocity.addScaledVector(this.radialDirection, -this.maxSpeed * 1.25);
        } else if (distance < this.attackDistance * 0.82) {
            this.desiredVelocity.addScaledVector(this.radialDirection, -this.maxSpeed * 0.75);
        }

        if (
            distance <= this.attackDistance * 1.25 &&
            this.weaponCooldown === 0 &&
            onFire
        ) {
            onFire(this);
            this.weaponCooldown = this.fireInterval;
        }

        if (this.modeElapsed >= this.attackDuration) {
            this.switchMode('reload');
        }
    }

    updateReloadMovement(distance) {
        this.desiredVelocity.copy(this.orbitDirection)
            .multiplyScalar(this.maxSpeed * 0.95);

        if (distance < this.retreatDistance) {
            this.desiredVelocity.addScaledVector(this.radialDirection, -this.maxSpeed);
        } else if (distance > this.retreatDistance * 1.18) {
            this.desiredVelocity.addScaledVector(this.radialDirection, this.maxSpeed * 0.38);
        }

        if (this.modeElapsed >= this.reloadDuration) {
            this.switchMode('attack');
        }
    }

    switchMode(mode) {
        this.combatMode = mode;
        this.modeElapsed = 0;

        if (mode === 'attack') {
            this.weaponCooldown = Math.min(this.weaponCooldown, 0.3);
        }
    }

    lookAtTarget(delta) {
        this.lookDirection.copy(this.radialDirection);

        if (this.combatMode === 'reload') {
            this.lookDirection.addScaledVector(this.orbitDirection, 0.35).normalize();
        }

        this.forward.copy(WORLD_FORWARD).applyQuaternion(this.object.quaternion).normalize();
        this.forward.lerp(this.lookDirection, Math.min(1, this.turnSpeed * delta)).normalize();
        this.object.quaternion.setFromUnitVectors(WORLD_FORWARD, this.forward);
    }

    onDamage() {
        this.object.scale.multiplyScalar(0.94);
    }

    onDeath() {
        this.object.visible = false;
    }
}
