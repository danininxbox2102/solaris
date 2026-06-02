import * as THREE from 'three';
import { KeyboardMouseInput } from '../input/KeyboardMouseInput.js';
import { ShipEngineAudioController } from '../audio/ShipEngineAudioController.js';
import { ProceduralAsteroidField } from '../world/ProceduralAsteroidField.js';
import { BlasterSystem } from '../combat/BlasterSystem.js';
import { StationCollisionSystem } from '../world/StationCollisionSystem.js';
import { OpenWorldLoader } from '../world/OpenWorldLoader.js';
import { BossFight } from "../world/BossFight.js";
import { EnemySpawnSystem } from '../world/EnemySpawnSystem.js';

const PLANET_ROTATION_SPEED = 0.03;
const ASTEROID_COLLISION_DAMAGE = 10;
const ASTEROID_COLLISION_SPEED_MULTIPLIER = 0.72;
const ASTEROID_COLLISION_MIN_SPEED_FACTOR = 0.45;

export class OpenWorldState {
    constructor({ sceneController, cameraController, modelLoader, loadingOverlay, config, gameApp }) {
        this.sceneController = sceneController;
        this.cameraController = cameraController;
        this.modelLoader = modelLoader;
        this.loadingOverlay = loadingOverlay;
        this.config = config;
        this.gameApp = gameApp;

        this.scene = this.sceneController.createScene();
        this.mixers = [];
        this.alwaysOnTopObjects = new Set();
        this.playerCollisionSphere = new THREE.Sphere();
        this.input = new KeyboardMouseInput();
        this.playerShip = null;
        this.stationCollision = new StationCollisionSystem();
        this.asteroidField = new ProceduralAsteroidField({ scene: this.scene });
        this.blasterSystem = new BlasterSystem({
            scene: this.scene,
            input: this.input,
            asteroidField: this.asteroidField,
            soundManager: this.gameApp.soundManager
        });
        this.enemySpawnSystem = new EnemySpawnSystem({
            scene: this.scene,
            onPlayerDamage: () => {
                this.gameApp.hudOverlay.updateHealthBar(this.playerShip.getHealthState());
            }
        });
        this.blasterSystem.setEnemySystem(this.enemySpawnSystem);
        this.engineAudio = new ShipEngineAudioController({
            input: this.input,
            soundManager: this.gameApp.soundManager
        });
        this.openWorldLoader = new OpenWorldLoader({
            scene: this.scene,
            input: this.input,
            cameraController: this.cameraController,
            modelLoader: this.modelLoader,
            loadingOverlay: this.loadingOverlay,
            config: this.config,
            asteroidField: this.asteroidField,
            stationCollision: this.stationCollision,
            blasterSystem: this.blasterSystem
        });
        this.bossFight = new BossFight(this);

        this.isLoaded = false;
        this.isActive = false;
        this.isGameOver = false;
    }

    async enter() {
        this.isActive = true;
        this.isGameOver = false;
        this.sceneController.setActiveScene(this.scene);
        this.setupCamera();

        if (!this.isLoaded) {
            this.loadingOverlay.setMessage('Загрузка открытого мира...');
            this.sceneController.setupDefaultWorld(this.scene, { gridSize: 0, gridDivisions: 0 });
            this.setupLights();
            const loadedWorld = await this.openWorldLoader.load();
            this.playerShip = loadedWorld.playerShip;
            this.enemySpawnSystem.setPlayerShip(this.playerShip);
            this.planetModel = loadedWorld.planetModel;
            this.asteroidField.setCenter(this.getPlanetWorldPosition());
            this.stationPos = loadedWorld.stationPos;
            this.mixers.push(...loadedWorld.mixers);
            this.isLoaded = true;
        }

        if (this.playerShip) {
            this.input.start();
            this.gameApp.hudOverlay.showFlightReticle();
            this.gameApp.hudOverlay.showStationMarker();
            this.gameApp.hudOverlay.showHealthBar();
            this.gameApp.hudOverlay.updateHealthBar(this.playerShip.getHealthState());
        }

    }

    exit() {
        this.isActive = false;
        this.input.stop();
        this.engineAudio.stop();
        this.bossFight.end();
        this.enemySpawnSystem.clear();
        this.gameApp.hudOverlay.hideBorderWarning();
        this.gameApp.hudOverlay.hideFlightReticle();
        this.gameApp.hudOverlay.hideStationMarker();
        this.gameApp.hudOverlay.hideHealthBar();
    }

    setPaused(isPaused) {
        if (!this.isActive || !this.playerShip) {
            return;
        }

        if (isPaused) {
            this.input.stop();
            this.engineAudio.stop();
            this.gameApp.hudOverlay.hideFlightReticle();
            this.gameApp.hudOverlay.hideStationMarker();
            this.gameApp.hudOverlay.hideHealthBar();
            return;
        }

        this.input.start();
        this.gameApp.hudOverlay.showFlightReticle();
        this.gameApp.hudOverlay.showStationMarker();
        this.gameApp.hudOverlay.showHealthBar();
    }

    checkBorder(){

        const homeX = this.stationPos.x;
        const homeY = this.stationPos.y;
        const homeZ = this.stationPos.z;

        const player = this.playerShip.object;

        const playerX = player.position.x;
        const playerY = player.position.y;
        const playerZ = player.position.z;

        const d = Math.sqrt((playerX - homeX)**2 + (homeY - playerY)**2 + (homeZ - playerZ)**2);

        if (d > 5000){
            this.gameApp.hudOverlay.displayBorderWarning();
            if (!this.bossFight.isActive) {
                this.bossFight.start().then();
            }
        } else {
            this.gameApp.hudOverlay.hideBorderWarning();
            this.bossFight.stop();
        }
    }

    update(delta) {
        for (const mixer of this.mixers) {
            mixer.update(delta);
        }

        if (this.playerShip) {
            this.blasterSystem.update(delta);
            this.engineAudio.update();

            this.playerShip.update(delta, (previousPosition, previousQuaternion, frameDelta) => {
                this.stationCollision.resolve(previousPosition, previousQuaternion, frameDelta);
            });
            this.gameApp.hudOverlay.updateFlightReticle(this.playerShip.getFlightAimState());
            this.gameApp.hudOverlay.updateHealthBar(this.playerShip.getHealthState());
            this.gameApp.hudOverlay.updateStationMarker({
                worldPosition: this.stationPos,
                camera: this.cameraController.camera,
                playerPosition: this.playerShip.object.position
            });

            this.checkBorder();
            this.asteroidField.update(this.playerShip.object.position);
            this.enemySpawnSystem.update(delta);
            this.gameApp.hudOverlay.updateHealthBar(this.playerShip.getHealthState());
            this.resolvePlayerAsteroidCollision();
            this.bossFight.update(delta);

            if (!this.playerShip.isAlive) {
                this.triggerGameOver();
            }
        }

        this.updatePlanetBackground(delta);
    }

    updatePlanetBackground(delta) {
        if (!this.planetModel) {
            return;
        }

        this.planetModel.rotation.y -= delta * PLANET_ROTATION_SPEED;
    }

    resolvePlayerAsteroidCollision() {
        const playerSphere = this.stationCollision.getPlayerCollisionSphere(this.playerCollisionSphere);

        if (!playerSphere) {
            return;
        }

        const collisionCount = this.asteroidField.resolvePlayerCollision(playerSphere);

        if (collisionCount === 0) {
            return;
        }

        const source = {
            type: 'asteroidCollision',
            collisionCount
        };

        for (let i = 0; i < collisionCount; i++) {
            this.playerShip.damage(ASTEROID_COLLISION_DAMAGE, source);
        }

        this.gameApp.hudOverlay.updateHealthBar(this.playerShip.getHealthState());

        if (!this.playerShip.isAlive) {
            this.triggerGameOver();
        }

        const speedFactor = Math.max(
            ASTEROID_COLLISION_MIN_SPEED_FACTOR,
            ASTEROID_COLLISION_SPEED_MULTIPLIER ** collisionCount
        );

        this.playerShip.velocity.multiplyScalar(speedFactor);
    }

    triggerGameOver() {
        if (this.isGameOver) {
            return;
        }

        this.isGameOver = true;
        this.input.stop();
        this.engineAudio.stop();
        this.bossFight.end();
        this.gameApp.hudOverlay.hideBorderWarning();
        this.gameApp.hudOverlay.hideFlightReticle();
        this.gameApp.hudOverlay.hideStationMarker();
        this.gameApp.hudOverlay.updateHealthBar(this.playerShip.getHealthState());
        this.gameApp.showGameOver();
    }

    getPlanetWorldPosition() {
        const position = this.config.world?.planetPosition ?? { x: 5000, y: 0, z: -5000 };

        return new THREE.Vector3(position.x, position.y, position.z);
    }

    setupCamera() {
        this.cameraController.setControlsEnabled(false);
        this.cameraController.setView(
            new THREE.Vector3(18, 10, 18),
            new THREE.Vector3(0, 1.5, 0)
        );
    }

    setupLights() {
        const sun = new THREE.DirectionalLight(0xffffff, 2.2);
        sun.position.set(-14, 18, 10);

        const fill = new THREE.HemisphereLight(0x7aa7ff, 0x161616, 1);

        this.scene.add(sun, fill);
    }

}
