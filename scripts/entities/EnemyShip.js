import * as THREE from 'three';
import { Entity } from './Entity.js';
import { EnemyAIController } from '../ai/EnemyAIController.js';

const HULL_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x8f1724,
    roughness: 0.42,
    metalness: 0.55,
    emissive: 0x220006,
    emissiveIntensity: 0.45
});
const ENGINE_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xff5533,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    toneMapped: false
});
const HULL_GEOMETRY = new THREE.ConeGeometry(1.2, 4.2, 5);
const WING_GEOMETRY = new THREE.BoxGeometry(3.2, 0.18, 1.05);
const ENGINE_GEOMETRY = new THREE.SphereGeometry(0.36, 12, 8);
HULL_GEOMETRY.rotateX(Math.PI / 2);

export class EnemyShip extends Entity {
    constructor({
        position,
        target = null,
        profile = 'pirateScout',
        role,
        getAllies = null,
        obstacleProvider = null,
        lineOfSightProvider = null,
        projectileSpeed = 125
    } = {}) {
        super({
            name: 'EnemyShip',
            object: new THREE.Group(),
            maxHealth: 5
        });

        this.target = target;
        this.velocity = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.radius = 4.4;

        this.object.name = this.name;
        this.object.position.copy(position ?? new THREE.Vector3());
        this.object.scale.setScalar(2.8);
        this.object.add(this.createVisual());
        this.ai = new EnemyAIController({
            enemy: this,
            player: target,
            profile,
            role,
            getAllies,
            obstacleProvider,
            lineOfSightProvider,
            projectileSpeed
        });
    }

    createVisual() {
        const visual = new THREE.Group();
        const hull = new THREE.Mesh(HULL_GEOMETRY, HULL_MATERIAL);
        const leftWing = new THREE.Mesh(WING_GEOMETRY, HULL_MATERIAL);
        const rightWing = new THREE.Mesh(WING_GEOMETRY, HULL_MATERIAL);
        const engine = new THREE.Mesh(ENGINE_GEOMETRY, ENGINE_MATERIAL);

        leftWing.position.set(-1.25, 0, 0.45);
        leftWing.rotation.z = -0.2;
        rightWing.position.set(1.25, 0, 0.45);
        rightWing.rotation.z = 0.2;
        engine.position.set(0, 0, 1.9);
        engine.scale.set(1, 1, 1.8);

        visual.add(hull, leftWing, rightWing, engine);

        return visual;
    }

    setTarget(target) {
        this.target = target;
        this.ai.setPlayer(target);
    }

    update(delta, onFire = null) {
        if (!this.isAlive) {
            return;
        }

        this.ai.update(delta, onFire);
    }

    onDamage() {
        this.object.scale.multiplyScalar(0.94);
    }

    onDeath() {
        this.object.visible = false;
    }
}
