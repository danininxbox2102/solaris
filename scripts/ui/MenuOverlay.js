export class MenuOverlay {
    constructor(selector, gameApp) {
        this.element = document.querySelector(selector);
        this.gameApp = gameApp;

        if (!this.element) {
            return;
        }

        const buttons = document.querySelectorAll('button');

        for (const button of buttons) {
            button.addEventListener('mouseover', () => {
                this.gameApp.soundManager.playSfx('clickUi').then();
            });

            button.addEventListener('click', () => {
                this.gameApp.switchScene(button.dataset.scene).then();
            });
        }

        this.gameApp.soundManager.playMusic('menuTheme').then();
    }

    update() {
        if (!this.element) {
            return;
        }

        if (this.gameApp.activeSceneName !== "menu"){
            this.gameApp.soundManager.stopMusic();
        }

        this.element.style.display = this.gameApp.activeSceneName === 'menu' ? 'flex' : 'none';
    }
}
