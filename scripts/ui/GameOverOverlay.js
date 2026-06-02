export class GameOverOverlay {
    constructor(selector, gameApp) {
        this.element = document.querySelector(selector);
        this.gameApp = gameApp;

        if (!this.element) {
            return;
        }

        this.restartButton = this.element.querySelector('[data-game-over-action="restart"]');
        this.menuButton = this.element.querySelector('[data-game-over-action="menu"]');

        for (const button of this.element.querySelectorAll('button')) {
            button.addEventListener('mouseover', () => {
                this.gameApp.soundManager.playSfx('clickUi').then();
            });
        }

        this.restartButton?.addEventListener('click', () => {
            this.gameApp.restartOpenWorld().then();
        });

        this.menuButton?.addEventListener('click', () => {
            this.gameApp.setGameOver(false);
            this.gameApp.switchScene('menu').then();
        });
    }

    update() {
        if (!this.element) {
            return;
        }

        this.element.style.display = this.gameApp.isGameOver ? 'flex' : 'none';
    }
}
