import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { CharacterSelect } from './scenes/CharacterSelect';
import { MainMenu } from './scenes/MainMenu';
import { AUTO, Game, Scale, Core } from 'phaser';
import { Preloader } from './scenes/Preloader';

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

    const game = new Game({ ...config, parent });
    const container = document.getElementById(parent);
    // Safe-area padding and dynamic browser chrome can resize the parent without
    // changing the game's 1024 x 768 simulation coordinates.
    if (container && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
            if (game.isBooted) game.scale.refresh();
        });
        observer.observe(container);
        game.events.once(Core.Events.DESTROY, () => observer.disconnect());
    }
    return game;

}

export default StartGame;
