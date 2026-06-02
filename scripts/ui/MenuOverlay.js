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
                if (button.dataset.scene){
                    this.gameApp.switchScene(button.dataset.scene).then();
                    this.gameApp.soundManager.stopMusic("menuTheme");
                    this.gameApp.soundManager.stopMusic("stationAmbient");
                } else {

                }
            });
        }

        this.gameApp.soundManager.playMusic('menuTheme').then();
        this.gameApp.soundManager.playMusic('stationAmbient').then();
    }

    update() {
        if (!this.element) {
            return;
        }

        this.element.style.display = this.gameApp.activeSceneName === 'menu' ? 'flex' : 'none';
    }
}
