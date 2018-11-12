/*
"Objects" on the map (e.g. powerups and characters)
*/

interface GameObject {
    draw(ctx: CanvasRenderingContext2D): void;
}

class Character implements GameObject {
    pos: HexagonAxial;
    name: string;
    aim: number;
    agility: number;
    damage: number;
    hp: number;
    defence: number;
    ap: number;
    max_ap: number;
    team: number;
    remaining_steps: number;
    color: string;
    shots_per_turn: number;

    constructor(name: string, pos: HexagonAxial, team: number, color: string,
                aim: number, agility: number, damage: number, hp: number,
                defence: number, shots_per_turn: number) {
        this.name = name;
        this.pos = pos;
        this.team = team;
        this.aim = aim;
        this.agility = agility;
        this.damage = damage;
        this.hp = hp;
        this.defence = defence;
        this.max_ap = 2;
        this.ap = 0;
        this.remaining_steps = 0;
        this.color = color;
        this.shots_per_turn = shots_per_turn;
    }

    range(): number {
        return round(1 + this.agility * 0.25);
    }

    effective_damage(defence: number): number {
        if (this.damage >= defence) {
            return this.damage - defence;
        } else {
            return 0;
        }
    }

    is_alive(): boolean {
        return this.hp > 0;
    }

    // Returns the current range of the player (= in this round)
    current_range(): number {
        if (this.remaining_steps > 0) {
            return this.remaining_steps;
        } else if (this.ap > 0) {
            return this.range();
        } else {
            return 0;
        }
    }

    // TODO: Move to subclasses. Enemies should look different depending
    // on their type.
    draw(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        let pos = this.pos.to_px(tile_size).add(
            new Position2D(tile_size, tile_size2 / 2)
        );

        let radius = tile_size / 2;
        let n_edges = 3 + round(this.hp / 10);

        for (let i = 0; i <= n_edges; i++) {
            let angle_deg = (360 / n_edges) * i;
            let angle = angle_deg * (Math.PI / 180);
            let x = round(pos.x + radius * Math.cos(angle));
            let y = round(pos.y + radius * Math.sin(angle));

            if (i == 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Helper method
    reachable_fields(playingfield: PlayingField): Map<number, number> {
        let res = new Map<number, number>();
        let cp = this.pos;
        let cr = this.current_range();
        let distances = playingfield.run_pathfinding_algorithm(cp);
        for (let qi = cp.q - cr * 2; qi < cp.q + cr * 2; qi++) {
            for (let ri = cp.r - cr * 2; ri < cp.r + cr * 2; ri++) {
                let pi = new HexagonAxial(qi, ri);
                let distance = distances[pi.convert_to_number()];
                if (distance !== undefined && distance <= cr) {
                    res.set(pi.convert_to_number(), distance);
                }
            }
        }
        return res;
    }
}

class PlayerCharacter extends Character {
    constructor(pos: HexagonAxial, team: number, rng: RNG) {
        super(
            "Player",
            pos,
            team,
            "green",
            10,
            10,
            5,
            50,
            3,
            2
        );
    }
}

const HP_UP = 0;
const AGI_UP = 1;
const AIM_UP = 2;
const DMG_UP = 3;
const AMMO_UP = 4;

function random_powerup_type() {
    return round(rnd(4));
}

function powerup_name(n: number) {
    const names = ["HP+", "Agility+", "Aim+", "Damage+", "Ammo+"];
    if (n >= names.length) {
        return "";
    } else {
        return ["HP+", "Agility+", "Aim+", "Damage+", "Ammo+"][n];
    }
}

const POWERUP_COLORS = ["red", "blue", "orange", "black", "lime"];

class Powerup {
    pos: HexagonAxial;
    type: number;
    value: number;

    constructor(pos: HexagonAxial, type: number, value: number) {
        this.pos = pos;
        this.type = type;
        this.value = value;
    }
}
