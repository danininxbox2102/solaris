export class PauseOverlay {
    constructor(selector, gameApp) {
        this.element = document.querySelector(selector);
        this.gameApp = gameApp;

        if (!this.element) {
            return;
        }

        this.resumeButton = this.element.querySelector('[data-pause-action="resume"]');
        this.menuButton = this.element.querySelector('[data-pause-action="menu"]');

        for (const button of this.element.querySelectorAll('button')) {
            button.addEventListener('mouseover', () => {
                this.gameApp.soundManager.playSfx('clickUi').then();
            });
        }

        this.resumeButton?.addEventListener('click', () => {
            this.gameApp.setPaused(false);
        });

        this.menuButton?.addEventListener('click', () => {
            this.gameApp.setPaused(false);
            this.gameApp.switchScene('menu').then();
        });
    }

    update() {
        if (!this.element) {
            return;
        }

        this.element.style.display = this.gameApp.isPaused ? 'flex' : 'none';
    }
}
