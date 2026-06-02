import { Flagman } from '../entities/Flagman.js';

export class BossFight {
    constructor(state) {
        this.state = state;
        this.scene = state.scene;
        this.modelLoader = state.modelLoader;
        this.config = state.config;
        this.flagman = null;
        this.isActive = false;
        this.isStopping = false;
        this.startToken = 0;
    }

    async start() {
        if (this.isActive || this.flagman) {
            return;
        }

        const playerShip = this.state.playerShip;
        const flagmanUrl = this.config.models?.flagman;

        if (!playerShip || !flagmanUrl) {
            return;
        }

        this.isActive = true;
        const token = ++this.startToken;
        const flagmanModel = await this.modelLoader.load(flagmanUrl);

        if (!this.isActive || token !== this.startToken) {
            new Flagman({ object: flagmanModel.root }).dispose();
            return;
        }

        this.flagman = new Flagman({
            object: flagmanModel.root,
            target: playerShip
        });
        this.flagman.addToScene(this.scene);
        this.state.gameApp.soundManager.playSfx("warp")
        this.flagman.spawn();
        this.state.gameApp.soundManager.playSfx("explosion")
    }

    stop() {
        if (!this.isActive || this.isStopping) {
            return;
        }

        this.isActive = false;
        this.isStopping = true;
        this.startToken += 1;

        if (!this.flagman) {
            this.isStopping = false;
            return;
        }

        const stoppingFlagman = this.flagman;

        stoppingFlagman.despawn(() => {
            if (this.flagman !== stoppingFlagman) {
                return;
            }

            this.disposeFlagman();
            this.isStopping = false;
        });
    }

    end() {
        this.isActive = false;
        this.isStopping = false;
        this.startToken += 1;
        this.disposeFlagman();
    }

    disposeFlagman() {
        if (this.flagman) {
            this.flagman.removeFromScene();
            this.flagman.dispose();
            this.flagman = null;
        }
    }

    update(delta) {
        if (this.flagman) {
            this.flagman.update(delta);
        }
    }
}
