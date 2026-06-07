import * as THREE from 'three';

const WORLD_FORWARD = new THREE.Vector3(0, 0, -1);

export class EnemyPerception {
    constructor(blackboard, { lineOfSightProvider = null } = {}) {
        this.blackboard = blackboard;
        this.lineOfSightProvider = lineOfSightProvider;
        this.updateInterval = 0.14;
        this.elapsed = Math.random() * this.updateInterval;
        this.toPlayer = new THREE.Vector3();
        this.forward = new THREE.Vector3();
    }

    update(delta) {
        const bb = this.blackboard;

        bb.timeSincePlayerSeen += delta;
        this.elapsed += delta;

        if (this.elapsed < this.updateInterval) {
            return;
        }

        this.elapsed = 0;
        bb.healthPercent = bb.enemy.health / bb.enemy.maxHealth;
        bb.canSeePlayer = false;
        bb.hasLineOfSight = true;

        const playerPosition = bb.player?.object?.position;

        if (!bb.player?.isAlive || !playerPosition) {
            bb.distanceToPlayer = Infinity;
            return;
        }

        this.toPlayer.subVectors(playerPosition, bb.enemy.object.position);
        bb.distanceToPlayer = this.toPlayer.length();

        if (bb.distanceToPlayer > bb.profile.detectionRange || bb.distanceToPlayer <= 0.001) {
            return;
        }

        this.forward.copy(WORLD_FORWARD)
            .applyQuaternion(bb.enemy.object.quaternion)
            .normalize();
        const angle = this.forward.angleTo(this.toPlayer);
        const inFieldOfView = angle <= (bb.profile.fieldOfView ?? Math.PI) * 0.5;

        if (!inFieldOfView) {
            return;
        }

        bb.hasLineOfSight = this.hasLineOfSight(bb.enemy.object.position, playerPosition);
        bb.canSeePlayer = bb.hasLineOfSight;

        if (bb.canSeePlayer) {
            bb.lastKnownPlayerPosition.copy(playerPosition);
            bb.hasLastKnownPlayerPosition = true;
            bb.timeSincePlayerSeen = 0;
        }
    }

    hasLineOfSight(from, to) {
        if (!this.lineOfSightProvider) {
            return true;
        }

        return this.lineOfSightProvider.hasLineOfSight?.(from, to) ?? true;
    }
}
