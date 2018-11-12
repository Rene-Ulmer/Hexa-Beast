function fatal() {
    alert("Fatal error :(");
}

let c: HTMLCanvasElement = <any>document.getElementById("x");
let ctx = c.getContext('2d');
if (!ctx) fatal();

// Used for character sizes as well. TODO: clean this mess up
let tile_size = 30;
let tile_size2 = tile_size / Math.cos(30 * (Math.PI / 180));
let gr: GameRound | undefined = undefined;
let ui: UI | undefined = undefined;

function new_game(ctx: CanvasRenderingContext2D, seed: number) {
    append_log(" == Welcome to HexaBeast! ==");
    if (!ui) return;
    if (gr !== undefined) {
        ui.remove_component(gr);
    }
    gr = new GameRound(
        new Position2D(0, 0), 1280, 768, tile_size, new RNG(seed)
    );
    ui.add_component(gr);
    gr.draw(ctx);
}

window.onload = function() {
    ui = new UI(new Position2D(0, 0), 0, 0);
    ui.setup_hooks();
    if (ctx) {
        new_game(ctx, rnd(0xFFFFFFFF));
    } else fatal();
}
