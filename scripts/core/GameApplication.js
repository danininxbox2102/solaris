import * as THREE from 'three';
import { GameLoop } from './GameLoop.js';
import { RendererService } from './RendererService.js';
import { CameraController } from './CameraController.js';
import { SceneController } from '../scene/SceneController.js';
import { ModelLoader } from '../assets/ModelLoader.js';
import { LoadingOverlay } from '../ui/LoadingOverlay.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';
import { MenuState } from '../states/MenuState.js';
import { OpenWorldState } from '../states/OpenWorldState.js';
import { HangarState } from '../states/HangarState.js';
import { MenuOverlay } from '../ui/MenuOverlay.js';
import { SoundManager } from '../audio/SoundManager.js';

export class GameApplication {
    constructor(config) {
        this.config = {
            backgroundColor: 0x111111,
            camera: {
                fov: 60,
                near: 0.1,
                far: 1000,
                startPosition: new THREE.Vector3(2, 2, 4),
                target: new THREE.Vector3(0, 1, 0)
            },
            audio: {
                settings: {},
                assets: {}
            },
            ...config
        };

        this.sceneController = new SceneController(this.config.backgroundColor, this);
        this.rendererService = new RendererService(this.config.canvasParent);
        this.cameraController = new CameraController(
            this.config.camera,
            this.rendererService.domElement
        );
        this.modelLoader = new ModelLoader();
        this.soundManager = new SoundManager(this.config.audio.settings);
        this.soundManager.registerMany(this.config.audio.assets);

        this.loadingOverlay = new LoadingOverlay(this.config.loaderSelector);
        this.debugOverlay = new DebugOverlay(this.config.debugSelector, this);

        const sceneDependencies = {
            sceneController: this.sceneController,
            cameraController: this.cameraController,
            modelLoader: this.modelLoader,
            loadingOverlay: this.loadingOverlay,
            config: this.config
        };

        this.sceneStates = new Map([
            ['menu', new MenuState(sceneDependencies)],
            ['open-world', new OpenWorldState(sceneDependencies)],
            ['hangar', new HangarState(sceneDependencies)]
        ]);
        this.activeSceneName = null;
        this.activeSceneState = null;

        this.menuOverlay = new MenuOverlay(this.config.menuSelector, this);

        this.clock = new THREE.Clock();
        this.loop = new GameLoop({
            onUpdate: () => this.update(),
            onRender: () => this.render()
        });

        this.handleResize = this.handleResize.bind(this);
    }

    async start() {
        this.soundManager.installUnlockListeners();

        window.addEventListener('resize', this.handleResize);
        this.handleResize();

        this.skybox = await this.prepareSkybox()

        await this.switchScene('menu');
        this.loop.start();
    }

    async prepareSkybox() {
        const texture = new THREE.CubeTextureLoader().load([
            './assets/img/skybox/T_CentaurusA_pos_x.png',
            './assets/img/skybox/T_CentaurusA_neg_x.png',
            './assets/img/skybox/T_CentaurusA_pos_z.png',
            './assets/img/skybox/T_CentaurusA_neg_z.png',
            './assets/img/skybox/T_CentaurusA_neg_y.png',
            './assets/img/skybox/T_CentaurusA_pos_y.png',
        ]);

        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    async switchScene(sceneName) {
        const nextSceneState = this.sceneStates.get(sceneName);

        if (!nextSceneState || nextSceneState === this.activeSceneState) {
            return;
        }

        this.activeSceneState?.exit();
        this.activeSceneName = sceneName;
        this.activeSceneState = nextSceneState;

        try {
            await nextSceneState.enter();
        } catch (error) {
            console.error('Ошибка загрузки сцены:', error);
            this.loadingOverlay.setError('Ошибка загрузки сцены');
        }
    }

    update() {
        const delta = this.clock.getDelta();

        this.activeSceneState?.update(delta);
        this.cameraController.update();
        this.debugOverlay.update(this.cameraController.camera);
        this.menuOverlay.update();
    }

    render() {
        if (this.getAlwaysOnTopObjects().size > 0) {
            this.renderWithAlwaysOnTopObjects();
            return;
        }

        this.rendererService.render(
            this.sceneController.scene,
            this.cameraController.camera
        );
    }

    getAlwaysOnTopObjects() {
        return this.activeSceneState?.alwaysOnTopObjects ?? new Set();
    }

    renderWithAlwaysOnTopObjects() {
        const topObjects = [...this.getAlwaysOnTopObjects()];
        const hiddenTopObjects = this.setObjectsVisible(topObjects, false);

        try {
            this.rendererService.render(
                this.sceneController.scene,
                this.cameraController.camera
            );
        } finally {
            this.restoreObjectVisibility(hiddenTopObjects);
        }

        this.rendererService.clearDepth();

        const hiddenSceneObjects = this.hideObjectsOutsideTopPass(topObjects);
        const previousBackground = this.sceneController.scene.background;
        this.sceneController.scene.background = null;

        try {
            this.rendererService.renderWithoutClear(
                this.sceneController.scene,
                this.cameraController.camera
            );
        } finally {
            this.sceneController.scene.background = previousBackground;
            this.restoreObjectVisibility(hiddenSceneObjects);
        }
    }

    hideObjectsOutsideTopPass(topObjects) {
        const changedObjects = [];

        this.sceneController.scene.traverse((object) => {
            if (object === this.sceneController.scene) {
                return;
            }

            if (this.shouldRenderInTopPass(object, topObjects)) {
                return;
            }

            if (!object.visible) {
                return;
            }

            changedObjects.push({ object, visible: object.visible });
            object.visible = false;
        });

        return changedObjects;
    }

    shouldRenderInTopPass(object, topObjects) {
        return object.isLight
            || this.isObjectInsideTopObject(object, topObjects)
            || this.isObjectAncestorOfTopObject(object, topObjects);
    }

    isObjectInsideTopObject(object, topObjects) {
        let current = object;

        while (current) {
            if (topObjects.includes(current)) {
                return true;
            }

            current = current.parent;
        }

        return false;
    }

    isObjectAncestorOfTopObject(object, topObjects) {
        for (const topObject of topObjects) {
            let current = topObject.parent;

            while (current) {
                if (current === object) {
                    return true;
                }

                current = current.parent;
            }
        }

        return false;
    }

    setObjectsVisible(objects, visible) {
        const changedObjects = [];

        for (const object of objects) {
            if (object.visible === visible) {
                continue;
            }

            changedObjects.push({ object, visible: object.visible });
            object.visible = visible;
        }

        return changedObjects;
    }

    restoreObjectVisibility(changedObjects) {
        for (const { object, visible } of changedObjects) {
            object.visible = visible;
        }
    }

    handleResize() {
        this.cameraController.resize(window.innerWidth, window.innerHeight);
        this.rendererService.resize(window.innerWidth, window.innerHeight);
    }

    destroy() {
        this.loop.stop();
        this.activeSceneState?.exit();
        window.removeEventListener('resize', this.handleResize);
        this.soundManager.dispose();
        this.rendererService.dispose();
    }
}
