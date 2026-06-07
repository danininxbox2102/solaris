import * as THREE from 'three';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class EnemySteering {
    constructor(blackboard) {
        this.blackboard = blackboard;
        this.tmp = new THREE.Vector3();
        this.tmp2 = new THREE.Vector3();
        this.tmp3 = new THREE.Vector3();
        this.right = new THREE.Vector3();
    }

    seek(targetPosition, out, speed = this.blackboard.profile.maxSpeed) {
        return out.subVectors(targetPosition, this.blackboard.enemy.object.position)
            .normalize()
            .multiplyScalar(speed);
    }

    flee(targetPosition, out, speed = this.blackboard.profile.maxSpeed) {
        return out.subVectors(this.blackboard.enemy.object.position, targetPosition)
            .normalize()
            .multiplyScalar(speed);
    }

    pursue(target, targetVelocity, out, speed = this.blackboard.profile.maxSpeed) {
        const enemyPosition = this.blackboard.enemy.object.position;
        const distance = enemyPosition.distanceTo(target);
        const predictionTime = Math.min(3, distance / Math.max(speed, 1));

        this.tmp.copy(target).addScaledVector(targetVelocity, predictionTime);

        return this.seek(this.tmp, out, speed);
    }

    keepDistance(targetPosition, preferredDistance, out) {
        const enemyPosition = this.blackboard.enemy.object.position;
        const distance = enemyPosition.distanceTo(targetPosition);

        if (distance <= 0.001) {
            return out.set(0, 0, 0);
        }

        const error = THREE.MathUtils.clamp((distance - preferredDistance) / preferredDistance, -1, 1);

        return out.subVectors(targetPosition, enemyPosition)
            .normalize()
            .multiplyScalar(error * this.blackboard.profile.maxSpeed);
    }

    orbit(targetPosition, radius, direction, out) {
        const enemyPosition = this.blackboard.enemy.object.position;

        this.tmp.subVectors(targetPosition, enemyPosition);

        if (this.tmp.lengthSq() <= 0.001) {
            return out.set(0, 0, 0);
        }

        this.tmp.normalize();
        out.crossVectors(this.tmp, WORLD_UP);

        if (out.lengthSq() <= 0.001) {
            out.set(1, 0, 0);
        }

        out.normalize().multiplyScalar(this.blackboard.profile.maxSpeed * 0.75 * direction);
        out.add(this.keepDistance(targetPosition, radius, this.tmp2).multiplyScalar(0.55));

        return out;
    }

    separateFromAllies(allies, out) {
        const bb = this.blackboard;
        const enemy = bb.enemy;
        const radius = bb.profile.separationRadius ?? 90;
        const radiusSq = radius * radius;
        let count = 0;

        out.set(0, 0, 0);

        for (const ally of allies ?? []) {
            if (ally === enemy || !ally.isAlive) {
                continue;
            }

            const distanceSq = enemy.object.position.distanceToSquared(ally.object.position);

            if (distanceSq <= 0.001 || distanceSq > radiusSq) {
                continue;
            }

            this.tmp.subVectors(enemy.object.position, ally.object.position)
                .multiplyScalar(1 / distanceSq);
            out.add(this.tmp);
            count += 1;
        }

        if (count === 0 || out.lengthSq() <= 0.001) {
            return out;
        }

        return out.normalize().multiplyScalar(bb.profile.maxSpeed);
    }

    avoidObstacles(obstacleProvider, out) {
        const enemy = this.blackboard.enemy;
        const obstacles = obstacleProvider?.getNearbyObstacles?.(enemy.object.position, 220) ??
            obstacleProvider?.targets ??
            [];

        out.set(0, 0, 0);

        for (const obstacle of obstacles) {
            const mesh = obstacle.mesh ?? obstacle.object ?? obstacle;

            if (!mesh?.visible || !mesh.position) {
                continue;
            }

            const radius = obstacle.worldSphere?.radius ?? obstacle.localSphere?.radius ?? obstacle.radius ?? 32;
            const safeRadius = radius + enemy.radius * 5;
            const distanceSq = enemy.object.position.distanceToSquared(mesh.position);

            if (distanceSq <= 0.001 || distanceSq > safeRadius * safeRadius) {
                continue;
            }

            this.tmp.subVectors(enemy.object.position, mesh.position)
                .multiplyScalar((safeRadius * safeRadius - distanceSq) / (safeRadius * safeRadius));
            out.add(this.tmp);
        }

        if (out.lengthSq() <= 0.001) {
            return out;
        }

        return out.normalize().multiplyScalar(this.blackboard.profile.maxSpeed);
    }
}
