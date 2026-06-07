import * as THREE from 'three';
import { EnemyState } from './EnemyAIProfiles.js';

const WORLD_FORWARD = new THREE.Vector3(0, 0, -1);

export class EnemyCombat {
    constructor(blackboard, { projectileSpeed = 125 } = {}) {
        this.blackboard = blackboard;
        this.projectileSpeed = projectileSpeed;
        this.random = this.createRandom(blackboard.enemy.id * 2654435761);
        this.cooldown = this.random() * 0.5;
        this.burstRemaining = 0;
        this.predictedPosition = new THREE.Vector3();
        this.aimDirection = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.error = new THREE.Vector3();
    }

    update(delta, onFire = null) {
        const bb = this.blackboard;

        this.cooldown = Math.max(0, this.cooldown - delta);
        this.burstRemaining = Math.max(0, this.burstRemaining - delta);

        if (!onFire || !this.canFire()) {
            return;
        }

        if (this.burstRemaining <= 0) {
            this.burstRemaining = bb.profile.burstDuration;
        }

        const aimPosition = this.predictTargetPosition();

        onFire(bb.enemy, aimPosition);
        this.cooldown = bb.profile.fireInterval ?? 0.28;
    }

    canFire() {
        const bb = this.blackboard;

        if (
            bb.isPlayerInSafeZone ||
            !bb.player?.isAlive ||
            !bb.canSeePlayer ||
            !bb.hasLineOfSight ||
            this.cooldown > 0
        ) {
            return false;
        }

        if (
            bb.currentState !== EnemyState.AttackRun &&
            bb.currentState !== EnemyState.OrbitStrafe &&
            bb.currentState !== EnemyState.Chase
        ) {
            return false;
        }

        if (bb.distanceToPlayer > bb.profile.attackRange) {
            return false;
        }

        if (bb.currentState === EnemyState.Chase && bb.distanceToPlayer > bb.profile.attackRange * 0.7) {
            return false;
        }

        if (this.burstRemaining <= 0 && bb.currentState !== EnemyState.AttackRun) {
            return false;
        }

        this.aimDirection.subVectors(bb.player.object.position, bb.enemy.object.position);

        if (this.aimDirection.lengthSq() <= 0.001) {
            return false;
        }

        this.aimDirection.normalize();
        this.forward.copy(WORLD_FORWARD).applyQuaternion(bb.enemy.object.quaternion).normalize();

        const maxAngle = bb.currentState === EnemyState.AttackRun ? 0.46 : 0.34;

        return this.forward.angleTo(this.aimDirection) <= maxAngle;
    }

    predictTargetPosition() {
        const bb = this.blackboard;
        const shooterPosition = bb.enemy.object.position;
        const targetPosition = bb.player.object.position;
        const targetVelocity = bb.player.velocity ?? this.error.set(0, 0, 0);
        const distance = shooterPosition.distanceTo(targetPosition);
        const timeToHit = distance / Math.max(1, this.projectileSpeed);

        this.predictedPosition.copy(targetPosition)
            .addScaledVector(targetVelocity, timeToHit);

        const maxAimError = Math.max(10, distance * 0.075);
        const minAimError = Math.max(1.5, distance * 0.012);
        const aimError = THREE.MathUtils.lerp(maxAimError, minAimError, bb.profile.accuracy);

        this.randomVectorInSphere(this.error, aimError);
        this.predictedPosition.add(this.error);

        return this.predictedPosition;
    }

    randomVectorInSphere(out, radius) {
        const theta = this.random() * Math.PI * 2;
        const z = this.random() * 2 - 1;
        const scale = Math.cbrt(this.random()) * radius;
        const horizontal = Math.sqrt(1 - z * z);

        return out.set(
            Math.cos(theta) * horizontal * scale,
            z * scale,
            Math.sin(theta) * horizontal * scale
        );
    }

    createRandom(seed) {
        let value = seed >>> 0;

        return () => {
            value = (value * 1664525 + 1013904223) >>> 0;
            return value / 4294967296;
        };
    }
}
