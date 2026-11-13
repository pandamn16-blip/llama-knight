import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { CharacterSelect } from './scenes/CharacterSelect';
import { MainMenu } from './scenes/MainMenu';
import { AUTO, Game, Scale, Core } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { isMobileLayout, viewportWidth } from './ui/layout';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    // The default 120-frame smoothing cooldown clamps delta to the 60 FPS target,
    // making simulation run at half speed on a steady 30 FPS device after boot/focus.
    // Game.update already bounds elapsed time and splits it into safe physics steps.
    fps: { smoothStep: false },
    width: 1024,
    height: 768,
    parent: 'game-container',
    // Apply Vite's base to every scene loader, including Boot and Preloader.
    loader: { baseURL: import.meta.env.BASE_URL },
    input: { activePointers: 4 },
    scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
    backgroundColor: '#028af8',
    scene: [
        Boot,
        Preloader,
        MainMenu,
        CharacterSelect,
        MainGame,
        GameOver
    ]
};

const StartGame = (parent: string) => {

    const container = document.getElementById(parent);
    const mobile = isMobileLayout();
    const width = viewportWidth(container?.clientWidth ?? 1024, container?.clientHeight ?? 768, mobile);
    const game = new Game({ ...config, width, parent });
    // Safe areas/browser chrome resize the usable parent. Height stays 768 in world units.
    if (container && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
            if (!game.isBooted) return;
            game.scale.getParentBounds();
            const nextWidth = viewportWidth(container.clientWidth, container.clientHeight, mobile);
            if (game.scale.width !== nextWidth) game.scale.setGameSize(nextWidth, 768);
            else game.scale.refresh();
        });
        observer.observe(container);
        game.events.once(Core.Events.DESTROY, () => observer.disconnect());
    }
    return game;

}

export default StartGame;
