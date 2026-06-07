import * as THREE from 'three';
import {
    DestructibleMesh,
    FractureOptions
} from '/node_modules/@dgreenheck/three-pinata/build/three-pinata.es.js';

const DEFAULT_SETTINGS = {
    poolSize: 28,
    lifetime: 1.15,
    fragmentCount: 28,
    blastStrength: 5.2,
    rotationStrength: 8.5,
    fallbackTriangleFragments: false,
    maxPrepareTimeMs: 6,
    fadeStart: 0.42
};

const FALLBACK_COLOR = new THREE.Color(0x8a8177);
const scratchColor = new THREE.Color();
const scratchMatrix = new THREE.Matrix4();
const scratchCenter = new THREE.Vector3();
const scratchBox = new THREE.Box3();
const scratchVectorA = new THREE.Vector3();
const scratchVectorB = new THREE.Vector3();
const scratchVectorC = new THREE.Vector3();

const vertexShader = `
    attribute vec3 aFragmentCenter;
    attribute vec3 aFragmentDirection;
    attribute vec3 aFragmentAxis;
    attribute float aFragmentSeed;

    uniform float uProgress;
    uniform float uRadius;
    uniform float uBlastStrength;
    uniform float uRotationStrength;
    uniform vec3 uImpactDirection;
    uniform float uImpactInfluence;

    varying vec2 vUv;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    varying float vFragmentSeed;

    mat3 rotationAroundAxis(vec3 axis, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;

        return mat3(
            oc * axis.x * axis.x + c,
            oc * axis.x * axis.y - axis.z * s,
            oc * axis.z * axis.x + axis.y * s,
            oc * axis.x * axis.y + axis.z * s,
            oc * axis.y * axis.y + c,
            oc * axis.y * axis.z - axis.x * s,
            oc * axis.z * axis.x - axis.y * s,
            oc * axis.y * axis.z + axis.x * s,
            oc * axis.z * axis.z + c
        );
    }

    float cubicBezierValue(float t, float p1, float p2) {
        float invT = 1.0 - t;

        return 3.0 * invT * invT * t * p1 +
            3.0 * invT * t * t * p2 +
            t * t * t;
    }

    float cubicBezierDerivative(float t, float p1, float p2) {
        float invT = 1.0 - t;

        return 3.0 * invT * invT * p1 +
            6.0 * invT * t * (p2 - p1) +
            3.0 * t * t * (1.0 - p2);
    }

    float explosionEase(float x) {
        float t = x;

        for (int i = 0; i < 5; i++) {
            float currentX = cubicBezierValue(t, 0.0, 0.03) - x;
            float derivative = cubicBezierDerivative(t, 0.0, 0.03);

            if (abs(derivative) < 0.0001) {
                break;
            }

            t = clamp(t - currentX / derivative, 0.0, 1.0);
        }

        return cubicBezierValue(t, -0.04, 0.99);
    }

    void main() {
        float delayedProgress = clamp((uProgress - aFragmentSeed * 0.18) / 0.82, 0.0, 1.0);
        float progress = explosionEase(delayedProgress);
        vec3 fragmentOffset = position - aFragmentCenter;
        float rotationAngle = (aFragmentSeed - 0.5) * uRotationStrength * progress;
        vec3 localPosition = aFragmentCenter +
            rotationAroundAxis(normalize(aFragmentAxis), rotationAngle) * fragmentOffset;

        float speed = mix(0.82, 1.35, aFragmentSeed);

        vec3 blastDirection = normalize(mix(
            normalize(aFragmentDirection),
            normalize(uImpactDirection),
            uImpactInfluence
        ));

        localPosition += blastDirection * uRadius * uBlastStrength * speed * progress;

        vec4 worldPosition = modelMatrix * vec4(localPosition, 1.0);

        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldPosition = worldPosition.xyz;
        vFragmentSeed = aFragmentSeed;

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`;

const fragmentShader = `
    uniform vec3 uBaseColor;
    uniform sampler2D uMap;
    uniform bool uUseMap;
    uniform float uProgress;
    uniform float uOpacity;

    varying vec2 vUv;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    varying float vFragmentSeed;

    void main() {
        vec3 albedo = uBaseColor;

        if (uUseMap) {
            albedo *= texture2D(uMap, vUv).rgb;
        }

        vec3 normalDirection = normalize(vWorldNormal);
        vec3 lightDirection = normalize(vec3(-0.42, 0.78, 0.46));
        float diffuse = max(dot(normalDirection, lightDirection), 0.0);
        float rim = pow(1.0 - max(dot(normalDirection, normalize(cameraPosition - vWorldPosition)), 0.0), 2.0);
        float shade = 0.88 + vFragmentSeed * 0.16;
        vec3 color = albedo * shade * (0.28 + diffuse * 0.92) + rim * vec3(0.16, 0.18, 0.2);
        float alpha = uOpacity;

        if (alpha <= 0.01) {
            discard;
        }

        gl_FragColor = vec4(color, alpha);
    }
`;

export class AsteroidVoronoiExplosion {
    constructor({ scene, settings = {} }) {
        this.scene = scene;
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...settings
        };
        this.effects = [];
        this.geometryCache = new WeakMap();
        this.prepareQueue = [];
        this.isPreparing = false;
    }

    prepareGeometry(sourceGeometry, sourceMaterial = null) {
        if (!sourceGeometry || this.geometryCache.has(sourceGeometry)) {
            return;
        }

        this.geometryCache.set(sourceGeometry, {
            status: 'queued',
            geometry: null,
            material: sourceMaterial
        });
        this.prepareQueue.push({ geometry: sourceGeometry, material: sourceMaterial });
        this.schedulePrepareQueue();
    }

    spawnFromMesh(sourceObject, options = {}) {
        const cacheEntry = sourceObject.isMesh
            ? this.geometryCache.get(sourceObject.geometry)
            : null;
        const canUseCachedGeometry = !options.impactVelocity && !options.impactWorldPoint;
        const cachedGeometry = sourceObject.isMesh && canUseCachedGeometry
            ? this.getCachedExplosionGeometry(sourceObject.geometry)
            : null;
        const isWaitingForPreparedGeometry = sourceObject.isMesh &&
            cacheEntry &&
            cacheEntry.status !== 'ready' &&
            cacheEntry.status !== 'failed';

        if (isWaitingForPreparedGeometry) {
            return false;
        }

        const usesRuntimeFracture = sourceObject.isMesh && !cachedGeometry;
        const fragmentMeshes = cachedGeometry
            ? []
            : sourceObject.isMesh
                ? this.createVoronoiFragments(sourceObject, options)
                : this.collectPreparedFragments(sourceObject);

        if (!cachedGeometry && fragmentMeshes.length <= 1 && !this.settings.fallbackTriangleFragments) {
            return false;
        }

        const effect = this.getAvailableEffect();

        if (!effect) {
            return false;
        }

        const geometry = cachedGeometry ??
            (fragmentMeshes.length > 1
                ? this.createPreparedFragmentGeometry(sourceObject, fragmentMeshes)
                : this.createTriangleFallbackGeometry(sourceObject.geometry));
        const material = this.createMaterial(this.getSourceMaterial(sourceObject, fragmentMeshes));
        const mesh = new THREE.Mesh(geometry, material);
        const radius = this.getGeometryRadius(geometry);
        const impactUniforms = this.createImpactUniforms(sourceObject, options);

        sourceObject.updateMatrixWorld(true);
        sourceObject.getWorldPosition(mesh.position);
        sourceObject.getWorldQuaternion(mesh.quaternion);
        sourceObject.getWorldScale(mesh.scale);

        mesh.name = 'AsteroidVoronoiExplosion';
        mesh.frustumCulled = false;
        mesh.renderOrder = sourceObject.renderOrder + 1;

        material.uniforms.uRadius.value = radius;
        material.uniforms.uImpactDirection.value.copy(impactUniforms.direction);
        material.uniforms.uImpactInfluence.value = impactUniforms.influence;
        material.uniforms.uBlastStrength.value = this.getBlastStrength(options);

        effect.mesh = mesh;
        effect.geometry = geometry;
        effect.disposeGeometry = !cachedGeometry;
        effect.material = material;
        effect.age = 0;
        effect.lifetime = this.settings.lifetime;
        effect.active = true;

        this.scene.add(mesh);

        if (usesRuntimeFracture) {
            this.disposeFragments(fragmentMeshes);
        }

        return true;
    }

    getCachedExplosionGeometry(sourceGeometry) {
        const cached = this.geometryCache.get(sourceGeometry);

        if (cached?.status !== 'ready') {
            return null;
        }

        return cached.geometry;
    }

    schedulePrepareQueue() {
        if (this.isPreparing) {
            return;
        }

        this.isPreparing = true;
        this.requestIdleWork(() => this.processPrepareQueue());
    }

    processPrepareQueue() {
        const startedAt = performance.now();

        while (this.prepareQueue.length > 0) {
            const item = this.prepareQueue.shift();
            const cached = this.geometryCache.get(item.geometry);

            if (!cached || cached.status !== 'queued') {
                continue;
            }

            cached.status = 'preparing';

            try {
                const sourceMesh = new THREE.Mesh(item.geometry, item.material);
                const fragments = this.createVoronoiFragments(sourceMesh);

                if (fragments.length > 1) {
                    cached.geometry = this.createPreparedFragmentGeometry(sourceMesh, fragments);
                    cached.status = 'ready';
                    this.disposeFragments(fragments);
                } else {
                    cached.status = 'failed';
                }
            } catch (error) {
                console.warn('Asteroid Voronoi pre-fracture failed:', error);
                cached.status = 'failed';
            }

            if (performance.now() - startedAt > this.settings.maxPrepareTimeMs) {
                this.requestIdleWork(() => this.processPrepareQueue());
                return;
            }
        }

        this.isPreparing = false;
    }

    requestIdleWork(callback) {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(callback, { timeout: 500 });
            return;
        }

        window.setTimeout(callback, 0);
    }

    update(delta) {
        for (const effect of this.effects) {
            if (!effect.active) {
                continue;
            }

            effect.age += delta;
            const progress = Math.min(effect.age / effect.lifetime, 1);
            const fadeProgress = THREE.MathUtils.clamp(
                (progress - this.settings.fadeStart) / (1 - this.settings.fadeStart),
                0,
                1
            );
            const opacity = 1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress);

            effect.material.uniforms.uProgress.value = progress;
            effect.material.uniforms.uOpacity.value = opacity;

            if (progress >= 1) {
                this.releaseEffect(effect);
            }
        }
    }

    clear() {
        for (const effect of this.effects) {
            if (effect.active) {
                this.releaseEffect(effect);
            }
        }
    }

    collectPreparedFragments(root) {
        const fragments = [];

        root.traverse((object) => {
            if (!object.isMesh || !object.geometry) {
                return;
            }

            fragments.push(object);
        });

        return fragments;
    }

    createVoronoiFragments(sourceMesh, options = {}) {
        const material = this.getSourceMaterial(sourceMesh, [sourceMesh]);
        const destructible = new DestructibleMesh(
            sourceMesh.geometry.clone(),
            material,
            material
        );

        sourceMesh.updateMatrixWorld(true);
        sourceMesh.getWorldPosition(destructible.position);
        sourceMesh.getWorldQuaternion(destructible.quaternion);
        sourceMesh.getWorldScale(destructible.scale);
        destructible.updateMatrixWorld(true);

        try {
            const voronoiOptions = {
                mode: '3D',
                useApproximation: false
            };

            if (options.impactWorldPoint) {
                const impactPoint = sourceMesh.worldToLocal(options.impactWorldPoint.clone());
                const radius = this.getGeometryRadius(sourceMesh.geometry);

                voronoiOptions.impactPoint = impactPoint;
                voronoiOptions.impactRadius = options.impactRadius ?? radius * 0.65;
            }

            return destructible.fracture(new FractureOptions({
                fractureMethod: 'voronoi',
                fragmentCount: this.settings.fragmentCount,
                voronoiOptions,
                seed: Math.floor(this.hash(sourceMesh.position.length() + sourceMesh.id) * 100000)
            }));
        } catch (error) {
            console.warn('Asteroid Voronoi fracture failed:', error);
            return [];
        } finally {
            destructible.geometry?.dispose();
        }
    }

    disposeFragments(fragments) {
        for (const fragment of fragments) {
            fragment.geometry?.dispose();
        }
    }

    getSourceMaterial(sourceObject, fragmentMeshes) {
        if (sourceObject.material) {
            return sourceObject.material;
        }

        return fragmentMeshes.find((fragment) => fragment.material)?.material ?? null;
    }

    createPreparedFragmentGeometry(root, fragmentMeshes) {
        root.updateMatrixWorld(true);

        const rootInverse = scratchMatrix.copy(root.matrixWorld).invert();
        const explosionCenter = this.getObjectLocalCenter(root);
        const parts = fragmentMeshes.map((fragmentMesh, index) => {
            fragmentMesh.updateMatrixWorld(true);

            const geometry = fragmentMesh.geometry.index
                ? fragmentMesh.geometry.toNonIndexed()
                : fragmentMesh.geometry.clone();
            const positions = geometry.getAttribute('position');
            const normals = geometry.getAttribute('normal');
            const uvs = geometry.getAttribute('uv');
            const matrix = rootInverse.clone().multiply(fragmentMesh.matrixWorld);
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
            const center = this.getTransformedGeometryCenter(geometry, matrix);

            return {
                geometry,
                positions,
                normals,
                uvs,
                matrix,
                normalMatrix,
                center,
                seed: this.hash(index * 31.17 + center.length() * 0.73),
                axis: this.createAxis(index),
                direction: this.createFragmentDirection(center, explosionCenter, index),
                count: positions.count
            };
        });

        return this.mergeFragmentParts(parts);
    }

    createTriangleFallbackGeometry(sourceGeometry) {
        const geometry = sourceGeometry.index
            ? sourceGeometry.toNonIndexed()
            : sourceGeometry.clone();
        const positions = geometry.getAttribute('position');
        const normals = geometry.getAttribute('normal');
        const uvs = geometry.getAttribute('uv');
        const explosionCenter = this.getGeometryCenter(geometry);
        const parts = [];

        for (let i = 0; i < positions.count; i += 3) {
            scratchVectorA.fromBufferAttribute(positions, i);
            scratchVectorB.fromBufferAttribute(positions, i + 1);
            scratchVectorC.fromBufferAttribute(positions, i + 2);
            scratchCenter.copy(scratchVectorA)
                .add(scratchVectorB)
                .add(scratchVectorC)
                .multiplyScalar(1 / 3);

            parts.push({
                positions,
                normals,
                uvs,
                matrix: null,
                normalMatrix: null,
                center: scratchCenter.clone(),
                seed: this.hash(i * 17.11 + scratchCenter.length() * 0.73),
                axis: this.createAxis(i),
                direction: this.createFragmentDirection(scratchCenter, explosionCenter, i),
                start: i,
                count: 3
            });
        }

        geometry.dispose();

        return this.mergeFragmentParts(parts);
    }

    mergeFragmentParts(parts) {
        const totalCount = parts.reduce((sum, part) => sum + part.count, 0);
        const positions = new Float32Array(totalCount * 3);
        const normals = new Float32Array(totalCount * 3);
        const uvs = new Float32Array(totalCount * 2);
        const fragmentCenters = new Float32Array(totalCount * 3);
        const fragmentDirections = new Float32Array(totalCount * 3);
        const fragmentAxes = new Float32Array(totalCount * 3);
        const fragmentSeeds = new Float32Array(totalCount);
        let writeIndex = 0;

        for (const part of parts) {
            const sourceStart = part.start ?? 0;

            if (part.direction.lengthSq() === 0) {
                part.direction.set(0, 1, 0);
            }

            for (let i = 0; i < part.count; i++) {
                const sourceIndex = sourceStart + i;
                const targetVectorIndex = writeIndex * 3;
                const targetUvIndex = writeIndex * 2;

                scratchVectorA.fromBufferAttribute(part.positions, sourceIndex);

                if (part.matrix) {
                    scratchVectorA.applyMatrix4(part.matrix);
                }

                positions[targetVectorIndex] = scratchVectorA.x;
                positions[targetVectorIndex + 1] = scratchVectorA.y;
                positions[targetVectorIndex + 2] = scratchVectorA.z;

                if (part.normals) {
                    scratchVectorB.fromBufferAttribute(part.normals, sourceIndex);

                    if (part.normalMatrix) {
                        scratchVectorB.applyMatrix3(part.normalMatrix).normalize();
                    }

                    normals[targetVectorIndex] = scratchVectorB.x;
                    normals[targetVectorIndex + 1] = scratchVectorB.y;
                    normals[targetVectorIndex + 2] = scratchVectorB.z;
                }

                if (part.uvs) {
                    uvs[targetUvIndex] = part.uvs.getX(sourceIndex);
                    uvs[targetUvIndex + 1] = part.uvs.getY(sourceIndex);
                }

                fragmentCenters[targetVectorIndex] = part.center.x;
                fragmentCenters[targetVectorIndex + 1] = part.center.y;
                fragmentCenters[targetVectorIndex + 2] = part.center.z;
                fragmentDirections[targetVectorIndex] = part.direction.x;
                fragmentDirections[targetVectorIndex + 1] = part.direction.y;
                fragmentDirections[targetVectorIndex + 2] = part.direction.z;
                fragmentAxes[targetVectorIndex] = part.axis.x;
                fragmentAxes[targetVectorIndex + 1] = part.axis.y;
                fragmentAxes[targetVectorIndex + 2] = part.axis.z;
                fragmentSeeds[writeIndex] = part.seed;
                writeIndex += 1;
            }

            part.geometry?.dispose();
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.setAttribute('aFragmentCenter', new THREE.BufferAttribute(fragmentCenters, 3));
        geometry.setAttribute('aFragmentDirection', new THREE.BufferAttribute(fragmentDirections, 3));
        geometry.setAttribute('aFragmentAxis', new THREE.BufferAttribute(fragmentAxes, 3));
        geometry.setAttribute('aFragmentSeed', new THREE.BufferAttribute(fragmentSeeds, 1));
        geometry.computeBoundingSphere();

        return geometry;
    }

    createMaterial(sourceMaterial) {
        const source = Array.isArray(sourceMaterial) ? sourceMaterial[0] : sourceMaterial;
        const color = source?.color ? scratchColor.copy(source.color) : FALLBACK_COLOR;
        const map = source?.map ?? null;

        return new THREE.ShaderMaterial({
            uniforms: {
                uProgress: { value: 0 },
                uRadius: { value: 1 },
                uBlastStrength: { value: this.settings.blastStrength },
                uRotationStrength: { value: this.settings.rotationStrength },
                uImpactDirection: { value: new THREE.Vector3(0, 1, 0) },
                uImpactInfluence: { value: 0 },
                uBaseColor: { value: color.clone() },
                uMap: { value: map },
                uUseMap: { value: Boolean(map) },
                uOpacity: { value: 1 }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
    }

    createImpactUniforms(sourceObject, options) {
        const velocity = options.impactVelocity;

        if (!velocity || velocity.lengthSq() <= 0.000001) {
            return {
                direction: new THREE.Vector3(0, 1, 0),
                influence: 0
            };
        }

        const inverseQuaternion = sourceObject.getWorldQuaternion(new THREE.Quaternion()).invert();
        const direction = velocity.clone()
            .normalize()
            .applyQuaternion(inverseQuaternion)
            .normalize();

        return {
            direction,
            influence: options.impactInfluence ?? 0.82
        };
    }

    getBlastStrength(options) {
        if (!options.impactSpeed) {
            return this.settings.blastStrength;
        }

        const speedFactor = THREE.MathUtils.clamp(options.impactSpeed / 42, 0.75, 2.35);

        return this.settings.blastStrength * speedFactor;
    }

    getAvailableEffect() {
        let effect = this.effects.find((item) => !item.active);

        if (!effect && this.effects.length < this.settings.poolSize) {
            effect = {
                mesh: null,
                geometry: null,
                disposeGeometry: true,
                material: null,
                age: 0,
                lifetime: this.settings.lifetime,
                active: false
            };
            this.effects.push(effect);
        }

        return effect;
    }

    getTransformedGeometryCenter(geometry, matrix) {
        scratchBox.makeEmpty();
        scratchBox.setFromBufferAttribute(geometry.getAttribute('position'));
        scratchBox.getCenter(scratchCenter);

        return scratchCenter.clone().applyMatrix4(matrix);
    }

    getObjectLocalCenter(object) {
        if (object.isMesh && object.geometry) {
            return this.getGeometryCenter(object.geometry);
        }

        scratchBox.setFromObject(object);
        scratchBox.getCenter(scratchCenter);

        return object.worldToLocal(scratchCenter.clone());
    }

    getGeometryCenter(geometry) {
        if (!geometry.boundingSphere) {
            geometry.computeBoundingSphere();
        }

        return geometry.boundingSphere.center.clone();
    }

    createFragmentDirection(fragmentCenter, explosionCenter, index) {
        const direction = fragmentCenter.clone().sub(explosionCenter);

        if (direction.lengthSq() > 0.000001) {
            return direction.normalize();
        }

        return this.createAxis(index + 101);
    }

    createAxis(index) {
        return new THREE.Vector3(
            this.hash(index * 13.11 + 1.7) - 0.5,
            this.hash(index * 29.31 + 2.3) - 0.5,
            this.hash(index * 47.53 + 3.1) - 0.5
        ).normalize();
    }

    getGeometryRadius(geometry) {
        if (!geometry.boundingSphere) {
            geometry.computeBoundingSphere();
        }

        return geometry.boundingSphere.radius;
    }

    hash(value) {
        return THREE.MathUtils.euclideanModulo(Math.sin(value * 12.9898) * 43758.5453, 1);
    }

    releaseEffect(effect) {
        this.scene.remove(effect.mesh);

        if (effect.disposeGeometry) {
            effect.geometry.dispose();
        }

        effect.material.dispose();
        effect.mesh = null;
        effect.geometry = null;
        effect.disposeGeometry = true;
        effect.material = null;
        effect.age = 0;
        effect.active = false;
    }
}
