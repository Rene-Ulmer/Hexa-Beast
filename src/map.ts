class Hexagon {
    center: Position2D;
    radius: number;
    color: string | undefined;
    line_width: number | undefined;

    constructor(center: Position2D, radius: number, color?: string,
                line_width?: number) {
        this.center = center;
        this.radius = radius;
        this.color = color;
        this.line_width = line_width;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        // We count to 7 to draw the last edge going to the first point.
        for (let i = 0; i < 7; i++) {
            let angle_deg = 60 * i + 30;
            let angle = angle_deg * (Math.PI / 180);
            let x = round(this.center.x + this.radius * Math.cos(angle));
            let y = round(this.center.y + this.radius * Math.sin(angle));

            if (i == 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        if (this.color !== undefined) {
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        if (this.line_width !== undefined) {
            ctx.lineWidth = this.line_width;
        } else {
            ctx.lineWidth = 1;
        }
        ctx.stroke();
    }
}

// No enum to make it easily compressible using the closure compiler
const TileEmpty = 0;
const TileFloor = 1;
const TileConcreteWall = 2;
const TileGlass = 3;

function tile_is_solid(t: number): boolean {
    return t == TileEmpty || t == TileConcreteWall || t == TileGlass || t == TileEmpty;
}

function tile_is_transparent(t: number): boolean {
    return t == TileFloor || t == TileGlass || t == TileEmpty;
}

class Room2D {
    x: number;
    y: number;
    w: number;
    h: number;

    constructor(x: number, y: number, w: number, h: number) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    set_map(map: MapStorage, tile: number) {
        for (let x = 0; x <= this.w; x++) {
            map.set_tile(x + this.x, this.y, tile);
            map.set_tile(x + this.x, this.y + this.h, tile);
        }

        for (let y = 0; y < this.h; y++) {
            map.set_tile(this.x, y + this.y, tile);
            map.set_tile(this.x + this.w, y + this.y, tile);
        }
    }

    window_hack(map: MapStorage, rng: RNG) {
        const window_chance: number = 5;
        for (let x = 0; x <= this.w; x++) {
            // Variables used to decrease code size (and increase readability)
            let a = x + this.x;
            let y = this.y;
            let yh = y + this.h;
            if (map.get_tile(a, y) != TileFloor &&                        // Make sure the current pos is a wall.
                map.get_tile(a, y + 1) == TileFloor &&                    // Behind the wall is floor
                (x < this.w && map.get_tile(a + 1, y) != TileFloor) &&    // Before and after the wall there is not the door
                (x > 0 && map.get_tile(a - 1, y) != TileFloor) &&
                rng.rand(0, 10) <= window_chance)
            {
                map.set_tile(a, y, TileGlass);
            }

            if (map.get_tile(a, yh) != TileFloor &&
                map.get_tile(a, yh - 1) == TileFloor &&
                (x < this.w && map.get_tile(a + 1, yh - 1) != TileFloor) &&
                (x > 0 && map.get_tile(a - 1, yh - 1) != TileFloor) &&
                rng.rand(0, 10) <= window_chance)
            {
                map.set_tile(a, yh, TileGlass);
            }
        }

        for (let y = 0; y < this.h; y++) {
            let b = y + this.y;
            let x = this.x;
            let xw = x + this.w;

            if (map.get_tile(x, b) != TileFloor &&
                map.get_tile(x + 1, b) == TileFloor &&
                (y < this.h && map.get_tile(x, b + 1) != TileFloor) &&
                (y > 0 && map.get_tile(x, b - 1) != TileFloor) &&
                rng.rand(0, 10) <= window_chance)
            {
                map.set_tile(x, b, TileGlass);
            }

            if (map.get_tile(xw, b) != TileFloor &&
                map.get_tile(xw - 1, b) == TileFloor &&
                (y < this.h && map.get_tile(xw - 1, b + 1) != TileFloor) &&
                (y > 0 && map.get_tile(xw - 1, b - 1) != TileFloor) &&
                rng.rand(0, 10) <= window_chance)
            {
                map.set_tile(xw, b, TileGlass);
            }
        }
    }
}

/**
Functions for the procedural generated map
*/
function generate_random_house(map: MapStorage, rng: RNG) {
    const min_room_w = 2;
    const min_room_h = 2;

    let map_tiles_w = map.width;
    let map_tiles_h = map.height;

    // Get dimensions of the building
    let building_w = rng.rand(8, round(0.70 * map_tiles_w));
    let building_h = rng.rand(7, round(0.60 * map_tiles_h));

    // Get start offset of the building
    let offset_x = rng.rand(2, map_tiles_w - building_w - 2);
    let offset_y = rng.rand(2, map_tiles_h - building_h - 2);

    let rooms = [new Room2D(offset_x, offset_y, building_w, building_h)];
    let rooms_splittable = [rooms[0]];

    // Cheat method: Store doors during splitting...
    let doors = [];
    for (let wall_nr = 0; wall_nr < 4; wall_nr++) {
        if (rng.rand(0, 10) <= 4 && !(wall_nr == 3 && doors.length == 0)) {
            continue;
        }
        let x = 0;
        let y = 0;
        switch (wall_nr) {
            case 0:
                x = rooms[0].x + rng.rand(0, rooms[0].w);
                y = rooms[0].y;
            break;
            case 1:
                x = rooms[0].x + rng.rand(0, rooms[0].w);
                y = rooms[0].y + rooms[0].h;
            break;
            case 2:
                x = rooms[0].x;
                y = rooms[0].y + rng.rand(0, rooms[0].h);
            break;
            default: // case 3
                x = rooms[0].x + rooms[0].w;
                y = rooms[0].y + rng.rand(0, rooms[0].h);
            break;
        }

        doors.push(
            new Position2D(x, y)
        );
    }

    let timeout = 10;
    while (timeout-- > 0) {
        let room_to_split = rooms_splittable.shift();
        if (room_to_split === undefined) {
            break;
        }

        if (rng.rand(0, 10) >= 7) {
            continue;
        }

        if (rng.rand(0, 2) == 1) {
            // Split W
            if (room_to_split.w > 2 * min_room_w) {
                let ox = rng.rand(0, room_to_split.w - 2 * min_room_w);
                let r = new Room2D(
                    room_to_split.x + ox + min_room_w,
                    room_to_split.y,
                    room_to_split.w - ox - min_room_w,
                    room_to_split.h
                );
                rooms_splittable.push(r);
                rooms.push(r);

                // Create doors between both halves
                doors.push(
                    new Position2D(
                        room_to_split.x + ox + min_room_w,
                        room_to_split.y + rng.rand(1, room_to_split.h - 1)
                    )
                );
            }
        } else {
            // Split H
            if (room_to_split.h > 2 * min_room_h) {
                let oy = rng.rand(0, room_to_split.h - 2 * min_room_h);
                let r = new Room2D(
                    room_to_split.x,
                    room_to_split.y + oy + min_room_h,
                    room_to_split.w,
                    room_to_split.h - oy - min_room_h
                );
                rooms_splittable.push(r);
                rooms.push(r);

                doors.push(
                    new Position2D(
                        room_to_split.x + rng.rand(1, room_to_split.w - 1),
                        room_to_split.y + oy + min_room_h
                    )
                );
            }
        }
    }

    // Set walls
    for (let room of rooms) {
        room.set_map(map, TileConcreteWall);
    }

    // Set doors
    for (let door of doors) {
        map.set_tile(door.x, door.y, TileFloor);
    }

    // Generate windows.
    // Dirty hack: Go through the outermost wall segments and check whether
    // the block on the inside is visible or not
    rooms[0].window_hack(map, rng);
}

class MapStorage {
    tiles: number[][];
    width: number;
    height: number;
    center_to_edge: number;
    center_to_corner: number;

    /**
     * Storage class for the map (of one battlefield)
     * @param {number}      width              Width in tiles
     * @param {number}      height             Height in tiles
     * @param {number}      hex_center_to_edge Distance between hexagon center and hexagon edge
     */
    constructor(width: number, height: number, hex_center_to_edge: number,
                rng: RNG) {
        this.width = width;
        this.height = height;
        this.center_to_edge = hex_center_to_edge;
        this.center_to_corner = (this.center_to_edge / 2) / Math.cos(30 * (Math.PI / 180));
        this.tiles = this.empty_map();

        // Test out our set_tile function to draw borders
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                if (x == 0 || y == 0 || x == this.width - 1 || y == this.height - 1) {
                    this.set_tile(x, y, TileConcreteWall);
                }
            }
        }

        generate_random_house(this, rng);
    }

    set_tile(x: number, y: number, tile: number) {
        // Convert the square screen coordinates in 'real' coordinates on our
        // storage array.
        let rx = x + (round(this.height / 2) - round(y / 2));
        let ry = y;

        if (rx >= 0 && rx < this.tiles.length) {
            if (ry >= 0 && ry < this.tiles[rx].length) {
                this.tiles[rx][ry] = tile;
            }
        }
    }

    get_tile(x: number, y: number): number {
        let rx = x + (round(this.height / 2) - round(y / 2));
        let ry = y;
        if (rx >= 0 && rx < this.tiles.length) {
            if (ry >= 0 && ry < this.tiles[rx].length) {
                return this.tiles[rx][ry];
            }
        }
        return TileEmpty;
    }

    get_tile_hex(p: HexagonAxial): number {
        let [x, y] = p.to_map_coords();
        return this.get_tile(x, y);
    }

    empty_map(): number[][] {
        let tiles: number[][] = new Array();
        for (let x = 0; x < this.width + round(this.height / 2); x++) {
            tiles[x] = new Array();
            for (let y = 0; y < this.height; y++) {
                if (x + round(y / 2) < round(this.height / 2)) {
                    tiles[x][y] = TileEmpty;
                } else if (x + round(y / 2) >= round(1.5 * this.width)) {
                    tiles[x][y] = TileEmpty;
                } else {
                    tiles[x][y] = TileFloor;
                }
            }
        }
        return tiles;
    }
}
