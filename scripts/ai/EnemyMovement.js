import * as THREE from 'three';
import { EnemyRole, EnemyState } from './EnemyAIProfiles.js';
import { EnemySteering } from './EnemySteering.js';

const WORLD_FORWARD = new THREE.Vector3(0, 0, -1);

export class EnemyMovement {
    constructor(blackboard, { getAllies = null, obstacleProvider = null } = {}) {
        this.blackboard = blackboard;
        this.getAllies = getAllies;
        this.obstacleProvider = obstacleProvider;
        this.steering = new EnemySteering(blackboard);
        this.seekForce = new THREE.Vector3();
        this.distanceForce = new THREE.Vector3();
        this.orbitForce = new THREE.Vector3();
        this.avoidForce = new THREE.Vector3();
        this.separationForce = new THREE.Vector3();
        this.fleeForce = new THREE.Vector3();
        this.flankOffset = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.lookDirection = new THREE.Vector3();
        this.targetVelocity = new THREE.Vector3();
        this.worldUp = new THREE.Vector3(0, 1, 0);
        this.random = this.createRandom(blackboard.enemy.id * 1013904223);
        this.patrolTargetValid = false;
        this.searchTargetValid = false;
    }

    update(delta) {
        const bb = this.blackboard;
        const profile = bb.profile;
        const desired = bb.desiredVelocity.set(0, 0, 0);

        bb.hasTargetPosition = false;
        bb.hasDesiredLookTarget = false;

        switch (bb.currentState) {
            case EnemyState.Patrol:
                this.updatePatrol(desired);
                break;
            case EnemyState.Investigate:
                this.updateInvestigate(desired);
                break;
            case EnemyState.Chase:
                this.updateChase(desired);
                break;
            case EnemyState.AttackRun:
                this.updateAttackRun(desired, delta);
                break;
            case EnemyState.OrbitStrafe:
                this.updateOrbitStrafe(desired);
                break;
            case EnemyState.Evade:
                this.updateEvade(desired);
                break;
            case EnemyState.Retreat:
            case EnemyState.ReturnToZone:
                this.updateReturnToZone(desired);
                break;
            case EnemyState.Search:
                this.updateSearch(desired, delta);
                break;
            default:
                desired.multiplyScalar(0);
                break;
        }

        desired.addScaledVector(
            this.steering.avoidObstacles(this.obstacleProvider, this.avoidForce),
            1.2
        );
        desired.addScaledVector(
            this.steering.separateFromAllies(this.getAllies?.(), this.separationForce),
            0.8
        );

        if (desired.lengthSq() > profile.maxSpeed * profile.maxSpeed) {
            desired.setLength(profile.maxSpeed);
        }

        const smoothing = 1 - Math.exp(-profile.acceleration * 0.08 * delta);
        bb.enemy.velocity.lerp(desired, smoothing);

        if (bb.enemy.velocity.lengthSq() > profile.maxSpeed * profile.maxSpeed) {
            bb.enemy.velocity.setLength(profile.maxSpeed);
        }

        bb.enemy.object.position.addScaledVector(bb.enemy.velocity, delta);
        this.rotate(delta);
    }

    updatePatrol(out) {
        const bb = this.blackboard;

        if (!this.patrolTargetValid || bb.enemy.object.position.distanceToSquared(bb.patrolTarget) < 80 * 80) {
            this.pickPointInRadius(bb.patrolTarget, bb.spawnPosition, bb.profile.patrolRadius);
            this.patrolTargetValid = true;
        }

        bb.targetPosition.copy(bb.patrolTarget);
        bb.hasTargetPosition = true;
        out.add(this.steering.seek(bb.patrolTarget, this.seekForce, bb.profile.maxSpeed * 0.48));
    }

    updateInvestigate(out) {
        const bb = this.blackboard;
        const target = bb.hasSharedAlert
            ? bb.sharedAlertPosition
            : bb.lastKnownPlayerPosition;

        bb.targetPosition.copy(target);
        bb.hasTargetPosition = true;
        out.add(this.steering.seek(target, this.seekForce, bb.profile.maxSpeed * 0.72));
    }

    updateChase(out) {
        const bb = this.blackboard;

        if (!this.getPlayerPosition()) {
            return;
        }

        this.applyRoleOffset(this.seekForce.copy(this.getPlayerPosition()));
        bb.targetPosition.copy(this.seekForce);
        bb.hasTargetPosition = true;
        out.addScaledVector(this.steering.pursue(this.seekForce, this.getPlayerVelocity(), this.distanceForce), 0.55);
        out.addScaledVector(this.steering.keepDistance(this.seekForce, bb.profile.preferredDistance, this.orbitForce), 0.65);
        out.addScaledVector(this.steering.orbit(this.seekForce, bb.profile.preferredDistance, bb.orbitDirection, this.fleeForce), 0.28);
        this.lookAt(this.seekForce);
    }

    updateAttackRun(out, delta) {
        const bb = this.blackboard;

        if (!this.getPlayerPosition()) {
            return;
        }

        bb.attackRunTime += delta;
        this.applyRoleOffset(this.seekForce.copy(this.getPlayerPosition()));
        bb.targetPosition.copy(this.seekForce);
        bb.hasTargetPosition = true;
        out.addScaledVector(this.steering.pursue(this.seekForce, this.getPlayerVelocity(), this.distanceForce), 0.72);
        out.addScaledVector(this.steering.keepDistance(this.seekForce, bb.profile.preferredDistance * 0.82, this.orbitForce), 0.35);
        out.addScaledVector(this.steering.orbit(this.seekForce, bb.profile.preferredDistance, bb.orbitDirection, this.fleeForce), 0.22);
        this.lookAt(this.getPlayerPosition());
    }

    updateOrbitStrafe(out) {
        const bb = this.blackboard;

        if (!this.getPlayerPosition()) {
            return;
        }

        bb.targetPosition.copy(this.getPlayerPosition());
        bb.hasTargetPosition = true;
        out.addScaledVector(this.steering.orbit(this.getPlayerPosition(), bb.profile.preferredDistance, bb.orbitDirection, this.orbitForce), 0.95);
        out.addScaledVector(this.steering.keepDistance(this.getPlayerPosition(), bb.profile.preferredDistance, this.distanceForce), 0.7);
        this.lookAt(this.getPlayerPosition());
    }

    updateEvade(out) {
        const bb = this.blackboard;

        if (!this.getPlayerPosition()) {
            return;
        }

        bb.targetPosition.copy(this.getPlayerPosition());
        bb.hasTargetPosition = true;
        out.addScaledVector(this.steering.flee(this.getPlayerPosition(), this.fleeForce), 0.95);
        out.addScaledVector(this.steering.orbit(this.getPlayerPosition(), bb.profile.minDistance * 1.7, -bb.orbitDirection, this.orbitForce), bb.profile.evasion);
        this.lookAt(this.getPlayerPosition());
    }

    updateReturnToZone(out) {
        const bb = this.blackboard;

        this.patrolTargetValid = false;
        bb.targetPosition.copy(bb.spawnPosition);
        bb.hasTargetPosition = true;
        out.add(this.steering.seek(bb.spawnPosition, this.seekForce, bb.profile.maxSpeed * 0.75));
    }

    updateSearch(out, delta) {
        const bb = this.blackboard;

        bb.searchTime += delta;

        if (!this.searchTargetValid || bb.enemy.object.position.distanceToSquared(bb.searchTarget) < 70 * 70) {
            const center = bb.hasLastKnownPlayerPosition ? bb.lastKnownPlayerPosition : bb.spawnPosition;
            this.pickPointInRadius(bb.searchTarget, center, Math.min(320, bb.profile.patrolRadius * 0.55));
            this.searchTargetValid = true;
        }

        bb.targetPosition.copy(bb.searchTarget);
        bb.hasTargetPosition = true;
        out.add(this.steering.seek(bb.searchTarget, this.seekForce, bb.profile.maxSpeed * 0.55));
    }

    rotate(delta) {
        const bb = this.blackboard;

        if (bb.hasDesiredLookTarget) {
            this.lookDirection.subVectors(bb.desiredLookTarget, bb.enemy.object.position);
        } else if (bb.enemy.velocity.lengthSq() > 0.01) {
            this.lookDirection.copy(bb.enemy.velocity);
        } else {
            return;
        }

        if (this.lookDirection.lengthSq() <= 0.001) {
            return;
        }

        this.lookDirection.normalize();
        this.forward.copy(WORLD_FORWARD).applyQuaternion(bb.enemy.object.quaternion).normalize();
        this.forward.lerp(this.lookDirection, Math.min(1, bb.profile.turnRate * delta)).normalize();
        bb.enemy.object.quaternion.setFromUnitVectors(WORLD_FORWARD, this.forward);
    }

    lookAt(position) {
        const bb = this.blackboard;

        bb.desiredLookTarget.copy(position);
        bb.hasDesiredLookTarget = true;
    }

    getPlayerPosition() {
        return this.blackboard.player?.object?.position ?? null;
    }

    getPlayerVelocity() {
        return this.blackboard.player?.velocity ?? this.targetVelocity.set(0, 0, 0);
    }

    applyRoleOffset(target) {
        const bb = this.blackboard;

        if (bb.role === EnemyRole.Flanker) {
            this.flankOffset.subVectors(target, bb.enemy.object.position).normalize();
            this.flankOffset.cross(this.worldUp).normalize()
                .multiplyScalar(bb.profile.preferredDistance * 0.55 * bb.orbitDirection);
            target.add(this.flankOffset);
        } else if (bb.role === EnemyRole.Interceptor) {
            target.addScaledVector(this.getPlayerVelocity(), 1.4);
        }

        return target;
    }

    pickPointInRadius(out, center, radius) {
        const angle = this.random() * Math.PI * 2;
        const distance = Math.sqrt(this.random()) * radius;
        const y = (this.random() - 0.5) * radius * 0.35;

        out.set(
            center.x + Math.cos(angle) * distance,
            center.y + y,
            center.z + Math.sin(angle) * distance
        );

        return out;
    }

    createRandom(seed) {
        let value = seed >>> 0;

        return () => {
            value = (value * 1664525 + 1013904223) >>> 0;
            return value / 4294967296;
        };
    }
}
