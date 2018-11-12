const SIDEBAR_X = 1100;
const SIDEBAR_W = 200;
const SIDEBAR_H = 768;

class Component {
    pos: Position2D;
    width: number;
    height: number;

    constructor(pos: Position2D, width: number, height: number) {
        this.pos = pos;
        this.width = width;
        this.height = height;
    }

    is_target(p: Position2D): boolean {
        let t = p.sub(this.pos);
        return (
            t.x >= 0 && t.x <= this.width &&
            t.y >= 0 && t.y <= this.height
        );
    }

    draw(ctx: CanvasRenderingContext2D) { }
    on_mouse_move(p: Position2D) {}
    on_mouse_down(p: Position2D) {}
}

class Button extends Component {
    label: string;
    font_size: number;
    offset: number;
    onclick: () => void;

    constructor(label: string, pos: Position2D, width: number,
                height: number, offset: number, onclick: () => void) {
        super(pos, width, height);
        this.onclick = onclick;
        this.label = label;
        this.offset = offset;
        this.font_size = Math.floor(this.height - 2);
    }

    draw(ctx: CanvasRenderingContext2D) {
        draw_rectangle(ctx, this.pos.x, this.pos.y, this.width, this.height);
        ctx.fillStyle = "#000";
        ctx.font = "" + this.font_size + "px Courier New";
        // Can't center the text, whatever.
        ctx.fillText(
            this.label, this.pos.x + this.offset,
            this.pos.y + this.font_size - 2
        );
    }

    on_mouse_down(p: Position2D) {
        this.onclick();
    }
}

class UI extends Component {
    components: Component[];

    constructor(pos: Position2D, width: number, height: number) {
        super(pos, width, height);
        this.components = new Array();
    }

    add_component(component: Component) {
        this.components.push(component);
    }

    remove_component(component: Component) {
        // Why does JS not have a delete function on arrays? WTF JS.
        let new_components = new Array();
        for (let c of this.components) {
            if (c != component) {
                new_components.push(c);
            }
        }
        this.components = new_components;
    }

    // In the ideal case (no overlapping components) this should return exactly
    // one component
    get_components_for(p: Position2D): Component[] {
        let res = new Array();
        for (let component of this.components) {
            if (component.is_target(p)) {
                res.push(component);
            }
        }
        return res;
    }

    on_mouse_down(p: Position2D) {
        for (let component of this.get_components_for(p)) {
            component.on_mouse_down(p.sub(component.pos));
        }
    }

    on_mouse_move(p: Position2D) {
        for (let component of this.get_components_for(p)) {
            component.on_mouse_move(p.sub(component.pos));
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        for (let component of this.components) {
            component.draw(ctx);
        }
    }

    setup_hooks() {
        let ui = this;
        let c: HTMLCanvasElement = <any>document.getElementById("x");
        let r = c.getBoundingClientRect();
        c.addEventListener("mousedown", function(e) {
            ui.on_mouse_down(
                new Position2D(e.clientX - r.left, e.clientY - r.top));
        });
        c.addEventListener("mousemove", function(e) {
            ui.on_mouse_move(
                new Position2D(e.clientX - r.left, e.clientY - r.top));
        });
    }
}

function draw_rectangle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x, y);
    ctx.stroke();
}

function draw_health_icon(ctx: CanvasRenderingContext2D, pos: HexagonAxial,
                          color: string) {
    let px_pos = pos.to_px(tile_size).add(
        new Position2D(tile_size, tile_size2 / 2)
    );
    const ratio = 0.8;
    const thickness = tile_size * (1 - ratio);
    // Cross = 2 rects
    // Vertical thingy first
    // Backup old stroke style
    let s = ctx.strokeStyle;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    draw_rectangle(
        ctx,
        px_pos.x - (tile_size / 2) * ratio,
        px_pos.y - thickness * 0.5,
        tile_size * ratio,
        thickness
    );
    ctx.fill();

    draw_rectangle(
        ctx,
        px_pos.x - thickness * 0.5,
        px_pos.y - (tile_size / 2) * ratio,
        thickness,
        tile_size * ratio
    );
    ctx.fill();
    ctx.strokeStyle = s;
}

let log_first = true;
function append_log(l: string) {
    let e: HTMLTextAreaElement = <HTMLTextAreaElement>document.getElementById("t");
    if (e) {
        if (log_first) {
            e.value = l;
            log_first = false;
        } else {
            e.value += "\n" + l;
        }
        e.scrollTop = e.scrollHeight;
    }
}
