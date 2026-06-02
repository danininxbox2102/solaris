import * as THREE from 'three';
import { PlayerShip } from '../entities/PlayerShip.js';

const STATION_HITBOX_DEBUG_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xff3355,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
});
const PLANET_ATMOSPHERE_SCALE = 0.59;
const PLANET_ATMOSPHERE_MATERIAL = new THREE.ShaderMaterial({
    uniforms: {
        atmosphereColor: { value: new THREE.Color(0xB3E6FF) },
        intensity: { value: 0.4 },
        falloff: { value: 2.4 }
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);

            vNormal = normalize(mat3(modelMatrix) * normal);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 atmosphereColor;
        uniform float intensity;
        uniform float falloff;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float rim = 1.0 - max(dot(normalize(vNormal), viewDirection), 0.0);
            float alpha = pow(rim, falloff) * intensity;

            gl_FragColor = vec4(atmosphereColor, alpha);
        }
    `,
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

export class OpenWorldLoader {
    constructor({
        scene,
        input,
        cameraController,
        modelLoader,
        loadingOverlay,
        config,
        asteroidField,
        stationCollision,
        blasterSystem
    }) {
        this.scene = scene;
        this.input = input;
        this.cameraController = cameraController;
        this.modelLoader = modelLoader;
        this.loadingOverlay = loadingOverlay;
        this.config = config;
        this.asteroidField = asteroidField;
        this.stationCollision = stationCollision;
        this.blasterSystem = blasterSystem;
        this.stationHitbox = null;
    }

    async load() {
        const mixers = [];
        const stationModel = await this.loadStation(mixers);
        await this.loadAsteroidPrototypes();
        const stationCollisionMeshes = await this.loadStationHitbox(stationModel);
        const { playerShip, shipModel } = await this.loadPlayerShip();
        const shipCollisionMeshes = await this.loadShipHitbox(playerShip);

        this.stationCollision.configure({
            playerShip,
            stationHitbox: this.stationHitbox,
            stationMeshes: stationCollisionMeshes,
            shipMeshes: shipCollisionMeshes
        });

        playerShip.addToScene(this.scene);
        this.blasterSystem.setPlayerShip(playerShip);
        this.blasterSystem.createPools();

        if (shipModel.mixer) {
            mixers.push(shipModel.mixer);
        }

        const planetModel = await this.loadPlanet();

        this.loadingOverlay.hide();

        return {
            playerShip,
            planetModel,
            mixers,
            stationPos: { x: 0, y: 1.5, z: 0 }
        };
    }

    async loadStation(mixers) {
        const stationModel = await this.modelLoader.load(this.config.models.station, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        const asteroids = stationModel.root.getObjectByName('Asteroids_7');
        if (asteroids) {
            asteroids.visible = false;
        }

        const scatter = stationModel.root.getObjectByName('Cube_RScatter_6');
        if (scatter) {
            scatter.visible = false;
        }

        stationModel.root.position.set(0, 1.5, 0);
        stationModel.root.scale.set(100, 100, 100);
        stationModel.root.updateMatrixWorld(true);

        this.scene.add(stationModel.root);

        if (stationModel.mixer) {
            mixers.push(stationModel.mixer);
        }

        return stationModel;
    }

    async loadAsteroidPrototypes() {
        const [rockyModel, metallicModel] = await Promise.all([
            this.modelLoader.load(this.config.models.asteroidsRocky, {
                onProgress: (progress) => this.loadingOverlay.setProgress(progress)
            }),
            this.modelLoader.load(this.config.models.asteroidsMetallic, {
                onProgress: (progress) => this.loadingOverlay.setProgress(progress)
            })
        ]);

        this.asteroidField.collectPrototypes(rockyModel.root, { weight: 5 });
        this.asteroidField.collectPrototypes(metallicModel.root, { weight: 1 });
    }

    async loadStationHitbox(stationModel) {
        const stationHitboxModel = await this.modelLoader.load(this.config.models.stationHitbox, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        stationHitboxModel.root.name = 'StationHitbox';
        stationHitboxModel.root.position.copy(stationModel.root.position);
        stationHitboxModel.root.rotation.copy(stationModel.root.rotation);
        stationHitboxModel.root.scale.copy(stationModel.root.scale);
        stationHitboxModel.root.visible = true;
        stationHitboxModel.root.traverse((object) => {
            if (object.isMesh) {
                object.material = STATION_HITBOX_DEBUG_MATERIAL;
            }
        });
        this.scene.add(stationHitboxModel.root);

        this.stationHitbox = stationHitboxModel.root;

        return this.stationCollision.collectCollisionMeshes(stationHitboxModel.root);
    }

    async loadPlayerShip() {
        const shipModel = await this.modelLoader.load(this.config.models.ship, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        const playerShip = new PlayerShip({
            object: shipModel.root,
            input: this.input,
            cameraController: this.cameraController
        });

        return {
            playerShip,
            shipModel
        };
    }

    async loadShipHitbox(playerShip) {
        const shipHitboxModel = await this.modelLoader.load(this.config.models.shipHitbox, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });

        playerShip.setHitbox(shipHitboxModel.root);

        return this.stationCollision.collectCollisionMeshes(shipHitboxModel.root);
    }

    async loadPlanet() {
        const planetModel = await this.modelLoader.load(this.config.models.planet, {
            onProgress: (progress) => this.loadingOverlay.setProgress(progress)
        });
        const position = this.config.world?.planetPosition ?? { x: 5000, y: 0, z: -5000 };

        planetModel.root.position.set(position.x, position.y, position.z);
        planetModel.root.scale.set(1000, 1000, 1000);
        planetModel.root.traverse((object) => {
            object.frustumCulled = false;
        });
        this.scene.add(planetModel.root);
        this.scene.add(this.createPlanetAtmosphere(planetModel.root));

        return planetModel.root;
    }

    createPlanetAtmosphere(planetRoot) {
        const bounds = new THREE.Box3().setFromObject(planetRoot);
        const sphere = new THREE.Sphere();

        bounds.getBoundingSphere(sphere);

        const geometry = new THREE.SphereGeometry(
            sphere.radius * PLANET_ATMOSPHERE_SCALE,
            64,
            32
        );
        const atmosphere = new THREE.Mesh(geometry, PLANET_ATMOSPHERE_MATERIAL);

        atmosphere.name = 'PlanetAtmosphere';
        atmosphere.position.copy(sphere.center);
        atmosphere.frustumCulled = false;

        return atmosphere;
    }
}
