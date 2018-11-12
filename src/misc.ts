// Now it's more like Vec2D but whatever ^.^
class Position2D {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    add(o: Position2D): Position2D {
        return new Position2D(
            this.x + o.x,
            this.y + o.y
        );
    }

    sub(o: Position2D): Position2D {
        return this.add(o.div(-1));
    }

    div(n: number): Position2D {
        return new Position2D (
            this.x / n,
            this.y / n
        );
    }

    vect_length(): number {
        return Math.sqrt(
            this.x * this.x + this.y * this.y
        );
    }
}

// Round
function round(a: number): number {
    return Math.round(a);
}

// Random
function rnd(a: number): number {
    return round(Math.random() * a);
}

// Random choice
function rnd_c(a: Array<HexagonAxial>): HexagonAxial {
    return a[rnd(a.length - 1)];
}
