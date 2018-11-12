/**
* Represents a single hexagon in the axial coordinate system
*/
class HexagonAxial {
    q: number;
    r: number;

    constructor(q: number, r: number) {
        this.q = q;
        this.r = r;
    }

    equals(other: HexagonAxial): boolean {
        return this.q == other.q && this.r == other.r;
    }

    // Convert axial coordinates into absolute pixels
    to_px(short_dist: number): Position2D {
        let long_dist = short_dist / Math.cos(30 * (Math.PI / 180));
        return new Position2D(
            this.q * short_dist + round(this.r * short_dist / 2),
            this.r * (3 * long_dist / 4)
        );
    }

    // TODO: Verify if this is correct
    to_map_coords(): [number, number] {
        return [
            this.q + round(this.r / 2),
            this.r
        ];
    }

    static from_map_coords(x: number, y: number): HexagonAxial {
        return new HexagonAxial(
            x - round(y / 2),
            y
        );
    }

    round(): HexagonAxial {
        let x = round(this.q);
        let y = round(this.r);
        let z = round(-this.q - this.r);
        let dx = Math.abs(this.q - x);
        let dy = Math.abs(this.r - y);
        let dz = Math.abs((-this.q - this.r) - z);
        if (dx > dy && dx > dz) {
            x = -y - z;
        } else if (dy > dz) {
            y = -x - z;
        } else {
            // Changing z doesn't make sense since we don't use it.
        }
        return new HexagonAxial(x, y);
    }

    sub(other: HexagonAxial): HexagonAxial {
        return new HexagonAxial(this.q - other.q, this.r - other.r);
    }

    to_txt(): string {
        return "[" + this.q + ":" + this.r + "]";
    }

    neighbors(): Array<HexagonAxial> {
        return [
           new HexagonAxial(this.q + 1, this.r),
           new HexagonAxial(this.q - 1, this.r),
           new HexagonAxial(this.q + 1, this.r - 1),
           new HexagonAxial(this.q - 1, this.r + 1),
           new HexagonAxial(this.q, this.r - 1),
           new HexagonAxial(this.q, this.r + 1),
        ]
    }

    // Used as a unique key
    convert_to_number(): number {
        return this.q << 16 | this.r;
    }

    // TODO: Remove this when finishing the project if it is still not used.
    static from_number(n: number): HexagonAxial {
        let q = n >> 16;
        let r = n - (q << 16);
        return new HexagonAxial(q, r);
    }
};

// We need this for the A*
interface Dictionary<T> {
    [Key: string]: T;
}

class PlayingField {
    map: MapStorage;
    current_selected_char: number | null;
    width: number;
    height: number;
    hex_size: number;

    constructor(width: number, height: number, hex_size: number, rng: RNG) {
        this.width = width;
        this.height = height;
        this.hex_size = hex_size;
        this.map = new MapStorage(this.hwidth(), this.hheight(), hex_size, rng);
    }

    /**
    * Return list of coordinates where the line from `from` to `to` will pass
    * through
    */
    map_line(from: HexagonAxial, to: HexagonAxial): Array<HexagonAxial> {
        const N = 50;
        let diff = to.sub(from);
        // Let's always do N steps.
        let q = diff.q / N;
        let r = diff.r / N;
        let res = new Array();

        for (let i = 0; i < N; i++) {
            let obj = new HexagonAxial(from.q + q * i, from.r + r * i).round();
            let found = false;
            for (let ii of res) {
                if (ii.q == obj.q && ii.r == obj.r) {
                    found = true;
                }
            }
            if (!found) {
                res.push(obj);
            }
        }

        return res;
    }

    run_pathfinding_algorithm(from: HexagonAxial): Dictionary<number> {
        let visited_nodes: Dictionary<number> = {};
        visited_nodes[from.convert_to_number()] = 0;

        let nodes_to_visit = [from];
        while (nodes_to_visit.length > 0) {
            // Visit a single node
            let node = nodes_to_visit.shift();
            // Not possible
            if (!node) break;
            let node_idx = node.convert_to_number();
            let node_cost = visited_nodes[node_idx];
            for (let ni of node.neighbors()) {
                // Check that the neighbor is an valid field.
                let [x, y] = ni.to_map_coords();
                // Only highlight floor.
                if (tile_is_solid(this.map.get_tile(x, y))) {
                    continue;
                }
                // Check if neighbors are not visited known or have a higher cost.
                let ni_idx = ni.convert_to_number();
                if (visited_nodes[ni_idx] === undefined ||
                    visited_nodes[ni_idx] > node_cost + 1)
                {
                    visited_nodes[ni_idx] = node_cost + 1;
                    nodes_to_visit.push(ni);
                }
            }
        }

        return visited_nodes;
    }

    distance_between(from: HexagonAxial, to: HexagonAxial): number | undefined {
        // Run the A* algorithm to determine the distance between the two points
        return this.run_pathfinding_algorithm(from)[to.convert_to_number()];
    }

    long_hex_size() {
        return this.hex_size / Math.cos(30 * (Math.PI / 180));
    }

    // # of hextiles that fit horizontally
    hwidth() {
        return this.hex_axial_from_coord(new Position2D(this.width, 0)).q;
    }

    // # of hextiles that fit vertically
    hheight() {
        return this.hex_axial_from_coord(new Position2D(0, this.height)).r;
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Draw the map
        let long_dist = this.long_hex_size();
        for (let x = 0; x < this.hwidth(); x++) {
            for (let y = 0; y < this.hheight(); y++) {
                // Convert square coordinates to axial coordinates to pixels
                let px_pos = new HexagonAxial(x - round(y / 2), y).to_px(
                    this.hex_size);

                let color = undefined;
                switch (this.map.get_tile(x, y)) {
                    case TileFloor:
                        color = "#EEE";
                    break;

                    case TileConcreteWall:
                        color = "#444";
                    break;

                    case TileGlass:
                        color = "powderblue";
                    break;

                    default:
                        // This should not happen
                        fatal();
                        break;
                }

                // Make sure that the top left corner is on screen.
                px_pos = px_pos.add(
                    new Position2D(this.hex_size, long_dist / 2));
                let hex = new Hexagon(px_pos, long_dist / 2, color);
                hex.draw(ctx);
            }
        }
    }

    hex_axial_from_coord(pos: Position2D): HexagonAxial {
        // Undo adjustment which put everything on the screen.
        pos = pos.add(new Position2D(-this.hex_size, -this.long_hex_size() / 2));
        // Don't ask. There was already a bug in here x)
        let r = round(2 * Math.sqrt(3) * pos.y / (3 * this.hex_size));
        let q = round((pos.x + (r % 2) * this.hex_size * 0.5) / this.hex_size - round(r / 2));
        return new HexagonAxial(q, r);
    }

    get_tile_for_px(pos: Position2D): number {
        let p = this.hex_axial_from_coord(pos);
        let [x, y] = p.to_map_coords();
        if (x >= this.hwidth() || y >= this.hheight()) {
            return TileEmpty;
        }
        return this.map.get_tile(x, y);
    }

    fill_hexagon(ctx: CanvasRenderingContext2D, pos: HexagonAxial,
                 color: string, line_width: number) {
        let px_pos = pos.to_px(this.hex_size).add(
            new Position2D(this.hex_size, this.long_hex_size() / 2)
        );
        new Hexagon(px_pos, this.long_hex_size() / 2, color, line_width).draw(ctx);
    }
}
