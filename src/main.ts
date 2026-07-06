import { AudioEngine } from "./engine/audio";
import { PointerInput } from "./engine/input";
import { GameLoop } from "./engine/loop";
import { Game } from "./game/game";
import { Renderer } from "./game/render";
import { GameOverScreen } from "./ui/gameover";
import { Hud } from "./ui/hud";

function boot(): void {
  const canvas = document.getElementById("game") as HTMLCanvasElement | null;
  const ui = document.getElementById("ui");
  if (!canvas || !ui) throw new Error("Missing #game canvas / #ui overlay");

  const renderer = new Renderer(canvas);
  // Steer from the canvas so DOM overlay controls (buttons) stay clickable.
  const input = new PointerInput(canvas);
  const audio = new AudioEngine();
  input.onFirstGesture = () => audio.unlock();

  const hud = new Hud(ui);
  const gameOver = new GameOverScreen(ui, () => {
    gameOver.hide();
    game.restart();
  });

  const game = new Game(input, renderer, {
    onGameOver: (stats) => gameOver.show(stats),
  });

  const loop = new GameLoop({
    update: (dt) => game.update(dt),
    render: (alpha) => {
      game.render(alpha);
      hud.update(game);
    },
  });

  // Dev-only handle for automated verification; tree-shaken from prod builds.
  if (import.meta.env.DEV) {
    (window as unknown as { __game: Game }).__game = game;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) loop.stop();
    else loop.start();
  });

  loop.start();
}

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}

boot();
registerServiceWorker();
