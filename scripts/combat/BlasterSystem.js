import * as THREE from 'three';

const BLASTER_SETTINGS = {
    poolSize: 42,
    impactPoolSize: 24,
    speed: 180,
    lifetime: 1.35,
    fireInterval: 0.11,
    damage: 1,
    radius: 0.32,
    length: 4.2,
    muzzleOffsets: [
        new THREE.Vector3(-0.72, -0.08, -1.45),
        new THREE.Vector3(0.72, -0.08, -1.45)
    ]
};
const BLASTER_FORWARD = new THREE.Vector3(0, 0, -1);
const BLASTER_LOCAL_AXIS = new THREE.Vector3(0, 0, 1);
const BLASTER_CORE_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0x9ff7ff,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const BLASTER_GLOW_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0x1aa7ff,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const BLASTER_IMPACT_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0x8ff6ff,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});

export class BlasterSystem {
    constructor({ scene, input, asteroidField, soundManager }) {
        this.scene = scene;
        this.input = input;
        this.asteroidField = asteroidField;
        this.enemySystem = null;
        this.soundManager = soundManager;
        this.playerShip = null;
        this.projectiles = [];
        this.impacts = [];
        this.cooldown = 0;
        this.nextMuzzleIndex = 0;
        this.direction = new THREE.Vector3();
        this.muzzlePosition = new THREE.Vector3();
    }

    setPlayerShip(playerShip) {
        this.playerShip = playerShip;
    }

    setEnemySystem(enemySystem) {
        this.enemySystem = enemySystem;
    }

    createPools() {
        if (this.projectiles.length > 0) {
            return;
        }

        const coreGeometry = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
        coreGeometry.rotateX(Math.PI / 2);
        const glowGeometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
        glowGeometry.rotateX(Math.PI / 2);
        const impactGeometry = new THREE.SphereGeometry(1, 12, 8);

        for (let i = 0; i < BLASTER_SETTINGS.poolSize; i++) {
            const object = new THREE.Group();
            const glow = new THREE.Mesh(glowGeometry, BLASTER_GLOW_MATERIAL);
            const core = new THREE.Mesh(coreGeometry, BLASTER_CORE_MATERIAL);

            glow.scale.set(0.16, 0.16, BLASTER_SETTINGS.length);
            core.scale.set(0.045, 0.045, BLASTER_SETTINGS.length * 0.82);
            object.add(glow, core);
            object.visible = false;
            this.scene.add(object);

            this.projectiles.push({
                object,
                active: false,
                life: 0,
                direction: new THREE.Vector3(),
                headPosition: new THREE.Vector3(),
                previousHeadPosition: new THREE.Vector3()
            });
        }

        for (let i = 0; i < BLASTER_SETTINGS.impactPoolSize; i++) {
            const material = BLASTER_IMPACT_MATERIAL.clone();
            const object = new THREE.Mesh(impactGeometry, material);

            object.visible = false;
            this.scene.add(object);

            this.impacts.push({
                object,
                material,
                active: false,
                age: 0,
                lifetime: 0.22
            });
        }
    }

    update(delta) {
        this.cooldown = Math.max(0, this.cooldown - delta);

        if (this.isFirePressed() && this.cooldown === 0) {
            this.fireProjectile();
            this.cooldown = BLASTER_SETTINGS.fireInterval;
        }

        for (const projectile of this.projectiles) {
            if (projectile.active) {
                this.updateProjectile(projectile, delta);
            }
        }

        for (const impact of this.impacts) {
            if (impact.active) {
                this.updateImpact(impact, delta);
            }
        }
    }

    isFirePressed() {
        return this.input.isPressed('Space') ||
            (this.input.isPointerPressed && this.input.isPointerPressed(0));
    }

    fireProjectile() {
        const projectile = this.projectiles.find((item) => !item.active);

        if (!projectile || !this.playerShip) {
            return;
        }

        this.playerShip.object.updateMatrixWorld(true);

        const muzzleOffset = BLASTER_SETTINGS.muzzleOffsets[this.nextMuzzleIndex];
        this.nextMuzzleIndex = (this.nextMuzzleIndex + 1) % BLASTER_SETTINGS.muzzleOffsets.length;

        this.direction.copy(BLASTER_FORWARD)
            .applyQuaternion(this.playerShip.object.quaternion)
            .normalize();
        this.muzzlePosition.copy(muzzleOffset)
            .applyMatrix4(this.playerShip.object.matrixWorld);

        projectile.active = true;
        projectile.life = BLASTER_SETTINGS.lifetime;
        projectile.direction.copy(this.direction);
        projectile.previousHeadPosition.copy(this.muzzlePosition);
        projectile.headPosition.copy(this.muzzlePosition);
        projectile.object.quaternion.setFromUnitVectors(BLASTER_LOCAL_AXIS, projectile.direction);
        projectile.object.visible = true;
        this.updateProjectileView(projectile);
        this.soundManager.playSfx('shipGunFire').catch(console.error);
    }

    updateProjectile(projectile, delta) {
        projectile.previousHeadPosition.copy(projectile.headPosition);
        projectile.headPosition.addScaledVector(
            projectile.direction,
            BLASTER_SETTINGS.speed * delta
        );
        projectile.life -= delta;

        const hit = this.findClosestHit(
            projectile.previousHeadPosition,
            projectile.headPosition,
            BLASTER_SETTINGS.radius
        );

        if (hit) {
            projectile.headPosition.copy(hit.point);
            this.spawnImpact(hit.point);
            hit.system.damage(hit.target, BLASTER_SETTINGS.damage);
            this.deactivateProjectile(projectile);
            return;
        }

        if (projectile.life <= 0) {
            this.deactivateProjectile(projectile);
            return;
        }

        this.updateProjectileView(projectile);
    }

    findClosestHit(from, to, radius) {
        const asteroidHit = this.asteroidField.findHit(from, to, radius);
        const enemyHit = this.enemySystem?.findHit(from, to, radius) ?? null;

        if (!asteroidHit) {
            return enemyHit
                ? { ...enemyHit, system: this.enemySystem }
                : null;
        }

        const asteroidDistance = from.distanceTo(asteroidHit.point);

        if (!enemyHit || asteroidDistance <= enemyHit.distance) {
            return {
                ...asteroidHit,
                system: this.asteroidField
            };
        }

        return {
            ...enemyHit,
            system: this.enemySystem
        };
    }

    updateProjectileView(projectile) {
        projectile.object.position.copy(projectile.headPosition)
            .addScaledVector(projectile.direction, -BLASTER_SETTINGS.length * 0.5);
    }

    deactivateProjectile(projectile) {
        projectile.active = false;
        projectile.object.visible = false;
    }

    spawnImpact(position) {
        const impact = this.impacts.find((item) => !item.active);

        if (!impact) {
            return;
        }

        impact.active = true;
        impact.age = 0;
        impact.material.opacity = 0.8;
        impact.object.position.copy(position);
        impact.object.scale.setScalar(0.3);
        impact.object.visible = true;
    }

    updateImpact(impact, delta) {
        impact.age += delta;

        const t = impact.age / impact.lifetime;
        if (t >= 1) {
            impact.active = false;
            impact.object.visible = false;
            return;
        }

        impact.object.scale.setScalar(0.3 + t * 1.2);
        impact.material.opacity = 0.8 * (1 - t);
    }
}
