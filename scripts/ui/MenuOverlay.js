export class MenuOverlay {
    constructor(selector, gameApp) {
        this.element = document.querySelector(selector);
        this.gameApp = gameApp;

        if (!this.element) {
            return;
        }

        const buttons = document.querySelectorAll('button[data-scene]');

        for (const button of buttons) {
            button.addEventListener('mouseover', () => {
                this.gameApp.soundManager.playSfx('clickUi').then();
            });

            button.addEventListener('click', () => {
                this.gameApp.switchScene(button.dataset.scene).then();
            });
        }
    }

    update() {
        if (!this.element) {
            return;
        }

        this.element.style.display = this.gameApp.activeSceneName === 'menu' ? 'flex' : 'none';
    }
}
