import * as THREE from 'three';
import { EnemyShip } from '../entities/EnemyShip.js';

const DEFAULT_SETTINGS = {
    maxEnemies: 12,
    spawnInterval: 3.2,
    spawnChance: 0.68,
    minSpawnDistance: 620,
    maxSpawnDistance: 980,
    verticalRange: 180,
    despawnDistance: 1800,
    projectilePoolSize: 36,
    projectileSpeed: 125,
    projectileLifetime: 3.8,
    projectileDamage: 6,
    projectileHitRadius: 9
};
const ENEMY_PROJECTILE_FORWARD = new THREE.Vector3(0, 0, -1);
const ENEMY_PROJECTILE_AXIS = new THREE.Vector3(0, 0, 1);
const ENEMY_PROJECTILE_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xff3344,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});

export class EnemySpawnSystem {
    constructor({ scene, settings = {}, onPlayerDamage = null }) {
        this.scene = scene;
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...settings
        };
        this.onPlayerDamage = onPlayerDamage;
        this.playerShip = null;
        this.enemies = [];
        this.projectiles = [];
        this.spawnCooldown = 0;
        this.ray = new THREE.Ray();
        this.segment = new THREE.Vector3();
        this.closestHitPoint = new THREE.Vector3();
        this.toCenter = new THREE.Vector3();
        this.projectileDirection = new THREE.Vector3();
        this.projectileStart = new THREE.Vector3();
        this.projectileGeometry = null;
    }

    setPlayerShip(playerShip) {
        this.playerShip = playerShip;

        for (const enemy of this.enemies) {
            enemy.setTarget(playerShip);
        }
    }

    update(delta) {
        if (!this.playerShip?.isAlive) {
            return;
        }

        this.spawnCooldown -= delta;

        if (this.spawnCooldown <= 0) {
            this.spawnCooldown = this.settings.spawnInterval;
            this.trySpawn();
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            enemy.update(delta, (attacker) => this.fireAtPlayer(attacker));

            if (!enemy.isAlive || this.shouldDespawn(enemy)) {
                enemy.removeFromScene();
                this.enemies.splice(i, 1);
            }
        }

        this.updateProjectiles(delta);
    }

    trySpawn() {
        if (this.enemies.length >= this.settings.maxEnemies || Math.random() > this.settings.spawnChance) {
            return;
        }

        const enemy = new EnemyShip({
            position: this.createSpawnPosition(),
            target: this.playerShip
        });

        enemy.addToScene(this.scene);
        this.enemies.push(enemy);
    }

    createSpawnPosition() {
        const angle = Math.random() * Math.PI * 2;
        const distance = THREE.MathUtils.lerp(
            this.settings.minSpawnDistance,
            this.settings.maxSpawnDistance,
            Math.random()
        );
        const playerPosition = this.playerShip.object.position;

        return new THREE.Vector3(
            playerPosition.x + Math.cos(angle) * distance,
            playerPosition.y + (Math.random() - 0.5) * this.settings.verticalRange,
            playerPosition.z + Math.sin(angle) * distance
        );
    }

    shouldDespawn(enemy) {
        return enemy.object.position.distanceTo(this.playerShip.object.position) > this.settings.despawnDistance;
    }

    findHit(from, to, radius) {
        this.segment.subVectors(to, from);
        const segmentLength = this.segment.length();

        if (segmentLength === 0) {
            return null;
        }

        this.ray.origin.copy(from);
        this.ray.direction.copy(this.segment).divideScalar(segmentLength);

        let closestEnemy = null;
        let closestDistance = Infinity;

        for (const enemy of this.enemies) {
            if (!enemy.isAlive || !enemy.object.visible) {
                continue;
            }

            const hitDistance = this.getRaySphereSegmentHitDistance(
                this.ray,
                enemy.object.position,
                enemy.radius * Math.max(enemy.object.scale.x, enemy.object.scale.y, enemy.object.scale.z),
                segmentLength + radius,
                radius
            );

            if (hitDistance === null || hitDistance >= closestDistance) {
                continue;
            }

            closestEnemy = enemy;
            closestDistance = hitDistance;
        }

        if (!closestEnemy) {
            return null;
        }

        this.closestHitPoint.copy(this.ray.origin)
            .addScaledVector(this.ray.direction, closestDistance);

        return {
            target: closestEnemy,
            point: this.closestHitPoint.clone(),
            distance: closestDistance
        };
    }

    damage(enemy, damage) {
        enemy.damage(damage, { type: 'blaster' });
    }

    fireAtPlayer(enemy) {
        if (!this.playerShip?.isAlive) {
            return;
        }

        const projectile = this.getProjectile();

        if (!projectile) {
            return;
        }

        this.projectileStart.copy(enemy.object.position)
            .addScaledVector(ENEMY_PROJECTILE_FORWARD.clone().applyQuaternion(enemy.object.quaternion), 9);
        this.projectileDirection.subVectors(this.playerShip.object.position, this.projectileStart).normalize();

        projectile.active = true;
        projectile.life = this.settings.projectileLifetime;
        projectile.direction.copy(this.projectileDirection);
        projectile.object.position.copy(this.projectileStart);
        projectile.object.quaternion.setFromUnitVectors(ENEMY_PROJECTILE_AXIS, projectile.direction);
        projectile.object.visible = true;
    }

    getProjectile() {
        let projectile = this.projectiles.find((item) => !item.active);

        if (projectile || this.projectiles.length >= this.settings.projectilePoolSize) {
            return projectile;
        }

        if (!this.projectileGeometry) {
            this.projectileGeometry = new THREE.CylinderGeometry(0.18, 0.18, 5.5, 10, 1, true);
            this.projectileGeometry.rotateX(Math.PI / 2);
        }

        const object = new THREE.Mesh(this.projectileGeometry, ENEMY_PROJECTILE_MATERIAL);

        object.name = 'EnemyProjectile';
        object.visible = false;
        this.scene.add(object);

        projectile = {
            object,
            active: false,
            life: 0,
            direction: new THREE.Vector3()
        };
        this.projectiles.push(projectile);

        return projectile;
    }

    updateProjectiles(delta) {
        for (const projectile of this.projectiles) {
            if (!projectile.active) {
                continue;
            }

            projectile.life -= delta;
            projectile.object.position.addScaledVector(
                projectile.direction,
                this.settings.projectileSpeed * delta
            );

            if (this.hasProjectileHitPlayer(projectile)) {
                this.playerShip.damage(this.settings.projectileDamage, { type: 'enemyProjectile' });
                this.onPlayerDamage?.(this.playerShip);
                this.deactivateProjectile(projectile);
                continue;
            }

            if (projectile.life <= 0) {
                this.deactivateProjectile(projectile);
            }
        }
    }

    hasProjectileHitPlayer(projectile) {
        return projectile.object.position.distanceTo(this.playerShip.object.position) <=
            this.settings.projectileHitRadius;
    }

    deactivateProjectile(projectile) {
        projectile.active = false;
        projectile.object.visible = false;
    }

    clear() {
        for (const enemy of this.enemies) {
            enemy.removeFromScene();
        }

        for (const projectile of this.projectiles) {
            this.deactivateProjectile(projectile);
        }

        this.enemies = [];
        this.spawnCooldown = 0;
    }

    getRaySphereSegmentHitDistance(ray, center, sphereRadius, segmentLength, radius) {
        const inflatedRadius = sphereRadius + radius;
        const inflatedRadiusSq = inflatedRadius * inflatedRadius;

        this.toCenter.subVectors(center, ray.origin);

        const centerProjection = this.toCenter.dot(ray.direction);
        const centerDistanceSq = this.toCenter.lengthSq();
        const perpendicularDistanceSq = centerDistanceSq - centerProjection * centerProjection;

        if (perpendicularDistanceSq > inflatedRadiusSq) {
            return null;
        }

        const halfChord = Math.sqrt(inflatedRadiusSq - perpendicularDistanceSq);
        const entryDistance = centerProjection - halfChord;
        const exitDistance = centerProjection + halfChord;

        if (entryDistance > segmentLength || exitDistance < 0) {
            return null;
        }

        return THREE.MathUtils.clamp(entryDistance, 0, segmentLength);
    }
}
