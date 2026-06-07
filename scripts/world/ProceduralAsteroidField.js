import * as THREE from 'three';

const DEFAULT_SETTINGS = {
    cellSize: 420,
    activeRadius: 1250,
    asteroidsPerCell: 14,
    minScale: 0.9,
    maxScale: 2,
    verticalRange: 520,
    ringInnerRadius: 2000,
    ringPeakRadius: 5200,
    ringOuterRadius: 8200
};

const ASTEROID_FALLBACK_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x7b746e,
    roughness: 0.95,
    metalness: 0.05
});
const FRAGMENTED_ASTEROID_NAME_PATTERN = /(fragment|voronoi|shard|chunk)/i;

export class ProceduralAsteroidField {
    constructor({ scene, settings = {}, explosionEffect = null }) {
        this.scene = scene;
        this.explosionEffect = explosionEffect;
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...settings
        };

        this.targets = [];
        this.prototypes = [];
        this.prototypeGroups = [];
        this.cells = new Map();
        this.center = new THREE.Vector3();
        this.cellCenter = new THREE.Vector3();
        this.ray = new THREE.Ray();
        this.segment = new THREE.Vector3();
        this.closestHitPoint = new THREE.Vector3();
        this.asteroidHitPoint = new THREE.Vector3();
        this.asteroidScale = new THREE.Vector3();
        this.fallbackGeometry = null;
    }

    setCenter(center) {
        this.center.copy(center);
        this.clear();
    }

    collectPrototypes(root, { weight = 1 } = {}) {
        const worldScale = new THREE.Vector3();
        const prototypes = [];
        const fragmentedRoots = this.collectFragmentedPrototypeRoots(root);

        root.updateMatrixWorld(true);

        for (const fragmentedRoot of fragmentedRoots) {
            prototypes.push({
                object: fragmentedRoot,
                scale: fragmentedRoot.getWorldScale(worldScale).clone()
            });
        }

        root.traverse((object) => {
            if (!object.isMesh || !object.geometry) {
                return;
            }

            if (fragmentedRoots.some((fragmentedRoot) => this.isDescendantOf(object, fragmentedRoot))) {
                return;
            }

            if (!object.geometry.boundingSphere) {
                object.geometry.computeBoundingSphere();
            }

            prototypes.push({
                geometry: object.geometry,
                material: object.material,
                scale: object.getWorldScale(worldScale).clone()
            });
            this.explosionEffect?.prepareGeometry(object.geometry, object.material);
        });

        if (prototypes.length === 0) {
            return;
        }

        this.prototypes.push(...prototypes);
        this.prototypeGroups.push({
            prototypes,
            weight
        });
    }

    collectFragmentedPrototypeRoots(root) {
        const roots = [];

        root.traverse((object) => {
            if (!FRAGMENTED_ASTEROID_NAME_PATTERN.test(object.name)) {
                return;
            }

            let meshCount = 0;

            object.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    meshCount += 1;
                }
            });

            if (meshCount > 1) {
                roots.push(object);
            }
        });

        return roots;
    }

    registerStaticRoot(root) {
        root.updateMatrixWorld(true);
        root.traverse((object) => {
            if (!object.isMesh || !object.geometry) {
                return;
            }

            this.targets.push(this.createTarget(object, 3));
        });
    }

    update(playerPosition) {
        const centerCellX = Math.floor(playerPosition.x / this.settings.cellSize);
        const centerCellZ = Math.floor(playerPosition.z / this.settings.cellSize);
        const cellRadius = Math.ceil(this.settings.activeRadius / this.settings.cellSize);
        const activeKeys = new Set();

        for (let x = centerCellX - cellRadius; x <= centerCellX + cellRadius; x++) {
            for (let z = centerCellZ - cellRadius; z <= centerCellZ + cellRadius; z++) {
                const key = this.getCellKey(x, z);
                const cellCenterX = (x + 0.5) * this.settings.cellSize;
                const cellCenterZ = (z + 0.5) * this.settings.cellSize;

                this.cellCenter.set(cellCenterX, playerPosition.y, cellCenterZ);

                if (this.cellCenter.distanceTo(playerPosition) > this.settings.activeRadius) {
                    continue;
                }

                if (this.getRingDensityAt(cellCenterX, cellCenterZ) <= 0) {
                    continue;
                }

                activeKeys.add(key);

                if (!this.cells.has(key)) {
                    this.generateCell(x, z, key);
                }
            }
        }

        for (const key of this.cells.keys()) {
            if (!activeKeys.has(key)) {
                this.removeCell(key);
            }
        }
    }

    generateCell(cellX, cellZ, key) {
        const targets = [];

        for (let i = 0; i < this.settings.asteroidsPerCell; i++) {
            const random = this.createRandom(cellX, cellZ, i);
            const position = new THREE.Vector3(
                (cellX + random()) * this.settings.cellSize,
                (random() - 0.5) * this.settings.verticalRange,
                (cellZ + random()) * this.settings.cellSize
            );
            const density = this.getRingDensityAt(position.x, position.z);

            if (density <= 0 || random() > density) {
                continue;
            }

            const prototype = this.getPrototype(random);
            const mesh = prototype.object
                ? prototype.object.clone(true)
                : new THREE.Mesh(prototype.geometry, prototype.material);
            const scale = THREE.MathUtils.lerp(this.settings.minScale, this.settings.maxScale, random());

            mesh.name = 'ProceduralAsteroid';
            mesh.position.copy(position);
            mesh.rotation.set(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2);
            mesh.scale.copy(prototype.scale).multiplyScalar(scale);
            mesh.visible = true;
            this.scene.add(mesh);

            const target = this.createTarget(mesh, 3);
            target.isProcedural = true;
            targets.push(target);
            this.targets.push(target);
        }

        this.cells.set(key, targets);
    }

    getPrototype(random) {
        if (this.prototypeGroups.length > 0) {
            const totalWeight = this.prototypeGroups.reduce((sum, group) => sum + group.weight, 0);
            let roll = random() * totalWeight;

            for (const group of this.prototypeGroups) {
                roll -= group.weight;

                if (roll <= 0) {
                    return group.prototypes[Math.floor(random() * group.prototypes.length)];
                }
            }

            const fallbackGroup = this.prototypeGroups[this.prototypeGroups.length - 1];
            return fallbackGroup.prototypes[Math.floor(random() * fallbackGroup.prototypes.length)];
        }

        if (this.prototypes.length > 0) {
            return this.prototypes[Math.floor(random() * this.prototypes.length)];
        }

        if (!this.fallbackGeometry) {
            this.fallbackGeometry = new THREE.IcosahedronGeometry(18, 2);
        }

        return {
            geometry: this.fallbackGeometry,
            material: ASTEROID_FALLBACK_MATERIAL,
            scale: new THREE.Vector3(1, 1, 1)
        };
    }

    getRingDensityAt(x, z) {
        const distanceToCenter = Math.hypot(x - this.center.x, z - this.center.z);
        const { ringInnerRadius, ringPeakRadius, ringOuterRadius } = this.settings;

        if (distanceToCenter <= ringInnerRadius || distanceToCenter >= ringOuterRadius) {
            return 0;
        }

        if (distanceToCenter < ringPeakRadius) {
            return THREE.MathUtils.smoothstep(
                (distanceToCenter - ringInnerRadius) / (ringPeakRadius - ringInnerRadius),
                0,
                1
            );
        }

        return 1 - THREE.MathUtils.smoothstep(
            (distanceToCenter - ringPeakRadius) / (ringOuterRadius - ringPeakRadius),
            0,
            1
        );
    }

    createTarget(mesh, health) {
        if (!mesh.isMesh) {
            const bounds = new THREE.Box3().setFromObject(mesh);
            const sphere = new THREE.Sphere();

            bounds.getBoundingSphere(sphere);
            mesh.getWorldScale(this.asteroidScale);
            mesh.worldToLocal(sphere.center);
            sphere.radius /= Math.max(
                this.asteroidScale.x,
                this.asteroidScale.y,
                this.asteroidScale.z
            );

            return {
                mesh,
                localSphere: sphere,
                worldSphere: new THREE.Sphere(),
                health,
                maxHealth: health
            };
        }

        if (!mesh.geometry.boundingSphere) {
            mesh.geometry.computeBoundingSphere();
        }

        return {
            mesh,
            localSphere: mesh.geometry.boundingSphere.clone(),
            worldSphere: new THREE.Sphere(),
            health,
            maxHealth: health
        };
    }

    findHit(from, to, radius) {
        this.segment.subVectors(to, from);
        const segmentLength = this.segment.length();

        if (segmentLength === 0) {
            return null;
        }

        this.ray.origin.copy(from);
        this.ray.direction.copy(this.segment).divideScalar(segmentLength);

        let closestTarget = null;
        let closestDistance = Infinity;

        for (const target of this.targets) {
            if (!this.isObjectWorldVisible(target.mesh)) {
                continue;
            }

            this.updateWorldSphere(target);

            const hitDistance = this.getRaySphereSegmentHitDistance(
                this.ray,
                target.worldSphere,
                segmentLength + radius,
                radius
            );

            if (hitDistance === null || hitDistance >= closestDistance) {
                continue;
            }

            closestTarget = target;
            closestDistance = hitDistance;
        }

        if (!closestTarget) {
            return null;
        }

        this.closestHitPoint.copy(this.ray.origin)
            .addScaledVector(this.ray.direction, closestDistance);

        return {
            target: closestTarget,
            point: this.closestHitPoint.clone()
        };
    }

    damage(target, damage) {
        target.health -= damage;

        if (target.health > 0) {
            return;
        }

        this.destroyTarget(target);
    }

    resolvePlayerCollision(playerSphere, impactOptions = {}) {
        let collisionCount = 0;

        for (const target of this.targets) {
            if (!this.isObjectWorldVisible(target.mesh)) {
                continue;
            }

            this.updateWorldSphere(target);

            if (!target.worldSphere.intersectsSphere(playerSphere)) {
                continue;
            }

            const impactWorldPoint = target.worldSphere.clampPoint(
                playerSphere.center,
                this.closestHitPoint
            ).clone();

            this.destroyTarget(target, {
                ...impactOptions,
                impactWorldPoint,
                impactRadius: impactOptions.impactRadius ?? playerSphere.radius
            });
            collisionCount += 1;
        }

        return collisionCount;
    }

    destroyTarget(target, explosionOptions = {}) {
        target.health = 0;
        this.explosionEffect?.spawnFromMesh(target.mesh, explosionOptions);
        target.mesh.visible = false;
    }

    updateWorldSphere(target) {
        target.mesh.updateMatrixWorld(true);
        target.worldSphere.center.copy(target.localSphere.center)
            .applyMatrix4(target.mesh.matrixWorld);
        target.mesh.getWorldScale(this.asteroidScale);
        target.worldSphere.radius = target.localSphere.radius * Math.max(
            this.asteroidScale.x,
            this.asteroidScale.y,
            this.asteroidScale.z
        );
    }

    getRaySphereSegmentHitDistance(ray, sphere, segmentLength, radius) {
        const inflatedRadius = sphere.radius + radius;
        const inflatedRadiusSq = inflatedRadius * inflatedRadius;
        const toCenter = this.asteroidHitPoint.subVectors(sphere.center, ray.origin);
        const centerProjection = toCenter.dot(ray.direction);
        const centerDistanceSq = toCenter.lengthSq();
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

    removeCell(key) {
        const targets = this.cells.get(key);

        if (!targets) {
            return;
        }

        for (const target of targets) {
            this.scene.remove(target.mesh);
        }

        this.targets = this.targets.filter((target) => !targets.includes(target));
        this.cells.delete(key);
    }

    clear() {
        for (const key of Array.from(this.cells.keys())) {
            this.removeCell(key);
        }
    }

    getCellKey(x, z) {
        return `${x}:${z}`;
    }

    isDescendantOf(object, ancestor) {
        let current = object;

        while (current) {
            if (current === ancestor) {
                return true;
            }

            current = current.parent;
        }

        return false;
    }

    createRandom(cellX, cellZ, index) {
        let seed = (
            (cellX * 73856093) ^
            (cellZ * 19349663) ^
            (index * 83492791)
        ) >>> 0;

        return () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };
    }

    isObjectWorldVisible(object) {
        let current = object;

        while (current) {
            if (!current.visible) {
                return false;
            }

            current = current.parent;
        }

        return true;
    }
}
