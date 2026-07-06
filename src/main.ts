import { AudioEngine } from "./engine/audio";
import { PointerInput } from "./engine/input";
import { GameLoop } from "./engine/loop";
import { Game } from "./game/game";
import { Renderer } from "./game/render";

function boot(): void {
  const canvas = document.getElementById("game") as HTMLCanvasElement | null;
  const app = document.getElementById("app");
  if (!canvas || !app) throw new Error("Missing #game canvas / #app root");

  const renderer = new Renderer(canvas);
  const input = new PointerInput(app);
  const audio = new AudioEngine();
  input.onFirstGesture = () => audio.unlock();

  const game = new Game(input, renderer);
  const loop = new GameLoop({
    update: (dt) => game.update(dt),
    render: (alpha) => game.render(alpha),
  });

  // Pause the loop when hidden to save battery; resume on return.
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
