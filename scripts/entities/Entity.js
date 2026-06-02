import * as THREE from 'three';

let nextEntityId = 1;

export class Entity {
    constructor({
        name = 'Entity',
        object = new THREE.Group(),
        maxHealth = 1,
        health = maxHealth
    } = {}) {
        this.id = nextEntityId++;
        this.name = name;
        this.object = object;
        this.isAlive = true;
        this.maxHealth = Math.max(1, maxHealth);
        this.health = THREE.MathUtils.clamp(health, 0, this.maxHealth);

        if (!this.object.name) {
            this.object.name = name;
        }

        this.object.userData.entity = this;
    }

    get position() {
        return this.object.position;
    }

    get quaternion() {
        return this.object.quaternion;
    }

    get rotation() {
        return this.object.rotation;
    }

    get scale() {
        return this.object.scale;
    }

    addToScene(scene) {
        scene.add(this.object);

        return this;
    }

    removeFromScene() {
        this.object.removeFromParent();

        return this;
    }

    update() {
    }

    setMaxHealth(maxHealth, { preserveRatio = false } = {}) {
        const nextMaxHealth = Math.max(1, maxHealth);
        const ratio = this.health / this.maxHealth;

        this.maxHealth = nextMaxHealth;
        this.health = preserveRatio
            ? this.maxHealth * ratio
            : Math.min(this.health, this.maxHealth);

        return this.getHealthState();
    }

    setHealth(health) {
        const previousHealth = this.health;

        this.health = THREE.MathUtils.clamp(health, 0, this.maxHealth);

        if (this.health <= 0 && this.isAlive) {
            this.die();
        } else if (this.health > 0 && !this.isAlive) {
            this.isAlive = true;
        }

        return this.health - previousHealth;
    }

    damage(amount, source = null) {
        if (!this.isAlive || amount <= 0) {
            return 0;
        }

        const previousHealth = this.health;

        this.health = Math.max(0, this.health - amount);
        this.onDamage({
            amount,
            actualAmount: previousHealth - this.health,
            source
        });

        if (this.health === 0) {
            this.die(source);
        }

        return previousHealth - this.health;
    }

    heal(amount) {
        if (amount <= 0 || this.health >= this.maxHealth) {
            return 0;
        }

        const previousHealth = this.health;

        this.health = Math.min(this.maxHealth, this.health + amount);

        if (this.health > 0) {
            this.isAlive = true;
        }

        this.onHeal({
            amount,
            actualAmount: this.health - previousHealth
        });

        return this.health - previousHealth;
    }

    die(source = null) {
        if (!this.isAlive) {
            return;
        }

        this.isAlive = false;
        this.onDeath({ source });
    }

    kill() {
        this.die();
        this.removeFromScene();
    }

    getHealthState() {
        return {
            health: this.health,
            maxHealth: this.maxHealth,
            ratio: this.health / this.maxHealth,
            isAlive: this.isAlive
        };
    }

    onDamage() {
    }

    onHeal() {
    }

    onDeath() {
    }
}
