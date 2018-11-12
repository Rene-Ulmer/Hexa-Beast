class ShotAnimation {
    current_position: Position2D;
    delta: Position2D;
    frames_left: number;

    constructor(src: Position2D, dst: Position2D) {
        // TODO: Fix references to global tile_size, so ugly :<
        // Drawing offset of the map
        let offset = new Position2D(tile_size, tile_size2 / 2);
        let s = src.add(offset);
        let d = dst.add(offset);

        // Projectile velocity (pixels per frame)
        const v = tile_size / 3;

        // Calculate projectile path and the required # of animation frames
        let path = d.sub(s);
        let path_len = path.vect_length();
        this.frames_left = round(path_len / v);
        this.delta = path.div(this.frames_left);
        this.current_position = s;
    }

    draw_shot(ctx: CanvasRenderingContext2D, p: Position2D) {
        // Cool 'ball' :>
        draw_rectangle(ctx, p.x - 2, p.y - 2, 4, 4);
    }
}

function animate_shot(s: ShotAnimation, on_done: () => void) {
    if (s.frames_left-- < 0) {
        // Make sure we redraw the screen so that the bullet disappears
        // afterwards.
        if (gr && ctx) {
            gr.draw(ctx);
        }
        on_done();
    } else {
        // Draw stuff.
        if (gr && ctx) {
            gr.draw(ctx);
            s.draw_shot(ctx, s.current_position);
            s.current_position = s.current_position.add(s.delta);
        }
        // Frame duration (ms)
        const frame_delay = 10;
        window.setTimeout(function() {
            animate_shot(s, on_done);
        }, frame_delay);
    }
}
