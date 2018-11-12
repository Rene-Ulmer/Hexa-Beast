class Enemy extends Character {
    get_target(gameround: GameRound): Character | undefined {
        let closest_character: Character | undefined = undefined;
        let distance: number = 0;
        for (let player of gameround.characters) {
            if (player.team != this.team && player.is_alive()) {
                let d = gameround.playingfield.distance_between(
                    this.pos, player.pos);
                if (closest_character == undefined || (d && d < distance)) {
                    closest_character = player;
                    if (!d) {
                        d = 9999;
                    }
                    distance = d;
                }
            }
        }
        return closest_character;
    }

    shooty_shooty_logic(gameround: GameRound, target: Character) {
        // Don't move at all, just try to sniper the enemy
        if (!this.perform_ranged_attack(gameround, target)) {
            // Except when the sniper wants to move
            this.stabby_stabby_logic(gameround, target);
        }
    }

    stabby_stabby_logic(gameround: GameRound, target: Character) {
        // Distances from the player (enemy)
        let reachable_fields = this.reachable_fields(gameround.playingfield);
        let p_dist = gameround.playingfield.run_pathfinding_algorithm(
            target.pos);
        let closest = 1337;
        let closest_at = undefined;
        for (let pi of reachable_fields) {
            let coords = HexagonAxial.from_number(pi[0]);
            let d = p_dist[pi[0]];
            if (gameround.get_character_on(coords) === undefined &&
                d < closest
            ) {
                closest = d;
                closest_at = coords;
            }
        }

        if (closest_at) {
            this.pos = closest_at;
        }
        if (closest == 1) {
            this.on_melee_range(gameround, target);
        }
    }

    yoloki_handle_turn(gameround: GameRound) {
        // Yoloki default suicide logic.
        let enemy = this.get_target(gameround);
        if (!enemy) {
            return;
        }

        // 1) Check reachable fields, pick the one with the best hit rate > N
        if (this.can_perform_ranged_attack()) {
            this.shooty_shooty_logic(gameround, enemy);
        } else if(this.can_perform_melee_attack()) {
            // 2) Go to the closest field (to the player) as possible. Probably very
            // similar to the first case, so we might need to merge both and just
            // shoot when the resulting hit chance is high enough.
            this.stabby_stabby_logic(gameround, enemy);
        } else {
            console.log("Warning: No AI mode enabled for this one :/");
        }

        this.on_end_of_turn(gameround);
    }

    can_perform_ranged_attack() {
        return false;
    }

    can_perform_melee_attack() {
        return false;
    }

    perform_ranged_attack(gameround: GameRound, char: Character) {
        return false;
    }

    on_die(gameround: GameRound) {}
    on_melee_range(gameround: GameRound, char: Character) {}
    on_end_of_turn(gameround: GameRound) {}

    stat_increment() {
        return round(rnd(2) + 1)
    }
}

class RegularEnemy extends Enemy {
    constructor(pos: HexagonAxial) {
        super(
            "Weakling",
            pos,
            2,
            "red",
            0, // aim
            2, // agility
            5, // damage
            5, // hp
            3, // defense
            1 // shot per thingy
        );
    }

    on_melee_range(gameround: GameRound, char: Character) {
        append_log(this.name + " bites in your foot, ugh!");
        gameround.attack_direct(this, char, 5);
    }

    can_perform_melee_attack() {
        return true;
    }
}

class MotherEnemy extends Enemy {
    constructor(pos: HexagonAxial) {
        super(
            "The Mother",
            pos,
            2,
            "blue",
            1, // aim
            2, // agility
            10, // damage
            150, // hp
            1, // defense
            5 // shots per thingy
        );
    }

    give_birth(gameround: GameRound): number {
        let count = 0;
        for (let n of this.pos.neighbors()) {
            // Let's spawn a new child
            if (gameround.get_character_on(n) == undefined &&
                !tile_is_solid(gameround.playingfield.map.get_tile_hex(n)) &&
                Math.random() < 0.30
            ) {
                gameround.characters.push(
                    new RegularEnemy(n)
                );
                count += 1;
            }
        }

        // If we die we will spawn a child at our position
        if (!this.is_alive()) {
            gameround.characters.push(
                new RegularEnemy(this.pos)
            );
            count += 1;
        }

        return count;
    }

    on_die(gameround: GameRound) {
        append_log(
            "But wait - With it's final breath it's spawning " +
            this.give_birth(gameround) + " more children!"
        );
    }

    on_end_of_turn(gameround: GameRound) {
        if (Math.random() < 0.10) {
            let count = this.give_birth(gameround);
            if (count > 0) {
                append_log(
                    "Oh oh, the mother is giving birth! " + count +
                    " children spawned"
                );
            }
        }
    }

    stat_increment() {
        return round(rnd(19) + 1)
    }
}

// More like a sniper one?
class HolyEnemy extends Enemy {
    constructor(pos: HexagonAxial) {
        super(
            "Sniper",
            pos,
            2,
            "black",
            30, // aim
            1, // agility
            20, // damage
            1, // hp
            3, // defense
            1 // shots per thingy
        );
    }

    can_perform_ranged_attack() {
        return true;
    }

    can_perform_melee_attack() {
        return false;
    }

    perform_ranged_attack(gameround: GameRound, char: Character) {
        let hitchance = gameround.calc_chance_on_hit(this.pos, char.pos, this.aim);
        if (hitchance > 0.3) {
            gameround.attack(this, char, function() {});
        } else if (hitchance > 0) {
            append_log(this.name + " is aiming for you! Better get behind cover");
            this.aim++;
        } else {}

        // We don't want to move, so we say this is always done.
        return true;
    }

    stat_increment() {
        return round(rnd(4) + 1)
    }
}
