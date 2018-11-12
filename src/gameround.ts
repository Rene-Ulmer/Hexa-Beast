const always_highlight_current_pos: boolean = false;

class GameRound extends Component {
    playingfield: PlayingField;
    characters: Array<Character>;
    powerups: Array<Powerup>;
    selected_hexagon: HexagonAxial | null;
    // Selection
    selected_character_idx: number;
    aimed_at_character_idx: number;
    selected_powerup_idx: number;

    attack_button: Button;
    endturn_button: Button;
    // Used to optimize drawing. The current map will be stored in this canvas.
    // This results in quicker draw()'s as only the overlay has to be updated.
    buffer_dirty: boolean;     // Indicates if the buffer needs a redraw (e.g.
                               // map has changed)
    buffer: HTMLCanvasElement;
    buffer_ctx: CanvasRenderingContext2D;

    fow_buffer: HTMLCanvasElement;
    fow_buffer_ctx: CanvasRenderingContext2D;
    fow_buffer_dirty: boolean;
    //round settings
    active_team: number;

    wave: number;
    in_animation: boolean;

    visible_blocks: Array<HexagonAxial>;

    constructor(pos: Position2D, width: number, height: number,
                hex_size: number, rng: RNG) {
        super(pos, width, height);
        this.playingfield = new PlayingField(
            width - SIDEBAR_W, height, hex_size, rng);

        this.powerups = new Array();
        this.characters = []
        this.selected_character_idx = -1;
        this.aimed_at_character_idx = -1;
        this.selected_powerup_idx = -1;
        this.attack_button = new Button(
            "Attack", new Position2D(SIDEBAR_X, 440), 120, 20,
            10, this.attack_button_clicked
        );
        this.endturn_button = new Button(
            "End Turn", new Position2D(SIDEBAR_X, 480), 120, 20,
            20, this.endturn_button_clicked
        );
        this.selected_hexagon = null;

        this.buffer = document.createElement('canvas');
        this.buffer.width = width;
        this.buffer.height = height;
        let c = this.buffer.getContext('2d');
        if (!c) {
            fatal();
            return;
        }
        this.buffer_ctx = c;
        this.buffer_dirty = true;

        // FoW buffer
        this.fow_buffer = document.createElement('canvas');
        this.fow_buffer.width = width;
        this.fow_buffer.height = height;
        c = this.fow_buffer.getContext('2d');
        if (!c) {
            fatal();
            return;
        }
        this.fow_buffer_ctx = c;
        this.fow_buffer_dirty = true;

        this.active_team = 1;
        this.wave = 0;
        this.in_animation = false;
        this.visible_blocks = new Array();
        // Add player at a random location
        this.characters.push(
            new PlayerCharacter(this.get_spawnable_coord(), 1, rng));
        this.characters.push(
            new PlayerCharacter(this.get_spawnable_coord(), 1, rng));
        this.spawn_wave();
        this.update_fog_of_war();
    }

    // We want to spawn enemies only where:
    // 1) They are on the floor
    // 2) They are reachable for the player
    // 3) The distance between them and the player is > N
    get_spawnable_coord(): HexagonAxial {
        // TODO: Spawn only in FoW
        const min_distance = 3;
        let timeout = 1000;
        while (timeout--) {
            let p = HexagonAxial.from_map_coords(
                rnd(this.playingfield.hwidth() - 1),
                rnd(this.playingfield.hheight() - 1)
            );
            if (tile_is_solid(this.playingfield.map.get_tile_hex(p))) {
                continue;
            }
            if (this.get_character_on(p) !== undefined) {
                continue;
            }
            if (!this.is_in_fog_of_war(p)) {
                continue;
            }

            let player_chars = this.characters.filter(function(c) {
                return c.team == 1 && c.is_alive()
            });

            let bad = false;
            for (let c of player_chars) {
                var d = this.playingfield.distance_between(c.pos, p);
                if (d === undefined || d < min_distance) {
                    bad = true;
                }
            }
            if (bad) {
                continue;
            }

            return p;
        }
        fatal();
        return new HexagonAxial(1, 1);
    }

    spawn_wave() {
        this.wave++;
        append_log("Spawning wave #" + this.wave);
        let n_regulars = this.wave * 3;
        let n_mothers = Math.floor(this.wave / 4);
        let n_snipers = Math.floor(this.wave / 3);

        for (let i = 0; i < n_regulars; i++) {
            this.characters.push(new RegularEnemy(this.get_spawnable_coord()));
        }

        for (let i = 0; i < n_mothers; i++) {
            this.characters.push(new MotherEnemy(this.get_spawnable_coord()));
        }

        for (let i = 0; i < n_snipers; i++) {
            this.characters.push(new HolyEnemy(this.get_spawnable_coord()));
        }

        this.prepare_round();
    }

    can_be_seen(a: HexagonAxial, b: HexagonAxial): boolean {
        if (a.equals(b)) return true;
        let path = this.playingfield.map_line(a, b);
        for (let po of path) {
            let [x, y] = po.to_map_coords();
            if (!tile_is_transparent(this.playingfield.map.get_tile(x, y))) {
                return false;
            }
        }

        return true;
    }

    is_in_fog_of_war(a: HexagonAxial) {
        for (let x of this.visible_blocks) {
            if (a.equals(x)) return false;
        }
        return true;
    }

    update_fog_of_war() {
        let vis_blocks = new Array();
        let cp = this.characters.filter(c => c.team == 1).map(c => c.pos);
        for (let x = 0; x < this.playingfield.hwidth(); x++) {
            for (let y = 0; y < this.playingfield.hheight(); y++) {
                let vis = false;
                for (let c of cp) {
                    if (this.can_be_seen(c, HexagonAxial.from_map_coords(x, y))) {
                        vis = true;
                    }
                }
                if (vis) {
                    vis_blocks.push(HexagonAxial.from_map_coords(x, y));
                }
            }
        }
        this.visible_blocks = vis_blocks;
        this.fow_buffer_dirty = true;
    }

    draw_fog_of_war(ctx: CanvasRenderingContext2D) {
        if (this.fow_buffer_dirty) {
            this.fow_buffer_ctx.clearRect(0, 0, 9999, 9999);
            // Figure out invisible blocks
            for (let x = 0; x < this.playingfield.hwidth(); x++) {
                for (let y = 0; y < this.playingfield.hheight(); y++) {
                    if (this.is_in_fog_of_war(HexagonAxial.from_map_coords(x, y))) {
                        this.playingfield.fill_hexagon(
                            this.fow_buffer_ctx,
                            HexagonAxial.from_map_coords(x, y),
                            'rgba(0, 0, 0, 0.3)',
                            0
                        );
                    }
                }
            }
            this.fow_buffer_dirty = false;
            console.log("updated fow");
        }
        ctx.drawImage(this.fow_buffer, 0, 0);
    }

    draw_character_info(ctx: CanvasRenderingContext2D, pos: Position2D,
                        char: Character) {
        const line_height = 20;
        ctx.fillStyle = "#000";
        ctx.font = "20px Courier New";
        ctx.fillText(
            char.name,
            pos.x, pos.y
        );
        ctx.fillText("Aim    : " + char.aim, pos.x, pos.y + line_height);
        ctx.fillText("Agility: " + char.agility, pos.x, pos.y + line_height * 2);
        ctx.fillText("Damage : " + char.shots_per_turn + "x" + char.damage, pos.x, pos.y + line_height * 3);
        ctx.fillText("HP     : " + char.hp, pos.x, pos.y + line_height * 4);
        ctx.fillText("Defence: " + char.defence, pos.x, pos.y + line_height * 5);
        ctx.fillText("max AP : " + char.max_ap, pos.x, pos.y + line_height * 6);
        if (char.team == this.active_team) {
            ctx.fillText("AP     : " + char.ap, pos.x, pos.y + line_height * 7);
            ctx.fillText("Steps  : " + char.remaining_steps, pos.x, pos.y + line_height * 8);
        }
    }

    draw_powerup_info(ctx: CanvasRenderingContext2D, pos: Position2D,
                      p: Powerup) {
        const line_height = 20;
        ctx.fillStyle = "#000";
        ctx.font = "20px Courier New";
        ctx.fillText("[Powerup Info]", pos.x, pos.y);
        ctx.fillText(powerup_name(p.type), pos.x, pos.y + 1 * line_height);
        ctx.fillText("Value  : " + p.value, pos.x, pos.y + 2 * line_height);
    }

    get_character_on(pos: HexagonAxial): Character | undefined {
        return this.characters.find(c => c.is_alive() && c.pos.equals(pos));
    }

    get_powerup_on(pos: HexagonAxial): Array<Powerup> {
        return this.powerups.filter(c => c.pos.equals(pos));
    }

    // ===================================================================
    // Round logic
    // ===================================================================
    is_team_dead(team: number): boolean {
        return this.characters.filter(function(c){
            return c.team == team && c.is_alive()
        }).length == 0;
    }

    game_ended(): boolean {
        return this.is_team_dead(1) || this.is_team_dead(2);
    }

    prepare_round() {
        for (let character of this.characters) {
            if (!character.is_alive()) continue;
            // Reset character attributes
            character.remaining_steps = 0;
            character.ap = character.max_ap;
        }
    }

    team_finished(): boolean {
        for (let character of this.characters) {
            if (!character.is_alive() || character.team != this.active_team) {
                continue;
            }
            if (character.ap > 0 || character.remaining_steps > 0) {
                return false;
            }
        }
        return true;
    }

    switch_active_team() {
        append_log("-------- Next turn --------");
        this.selected_character_idx = -1;
        this.aimed_at_character_idx = -1;
        this.active_team = 2;
        for (let character of this.characters) {
            if (!character.is_alive()) continue;
            // Embedded the KI logic here
            if (character.team == this.active_team) {
                let e = <Enemy>character;
                if (e && e.yoloki_handle_turn) {
                    e.yoloki_handle_turn(this);
                }
            }
        }
        this.prepare_round();
        this.active_team = 1;
    }

    endturn_button_clicked() {
        if (this.in_animation || this.is_team_dead(1)) {
            // Nope, you're dead. Nothing left to do for you.
            return;
        }
        this.switch_active_team();
    }

    auto_endturn_check() {
        if (this.in_animation) return;
        if (this.team_finished()) {
            this.switch_active_team();
        }
    }

    // ===================================================================
    // Combat system
    // ===================================================================
    attack_direct(src: Character, target: Character, dmg: number) {
        let d = Math.min(target.hp, dmg);
        append_log(
            src.name + " hit " + target.name + " for " + dmg + " damage"
        );
        target.hp -= d;
        if (!target.is_alive()) {
            let e = <Enemy>target;
            if (e && e.on_die) {
                append_log(e.name + " killed");
                e.on_die(this);
            }
            this.aimed_at_character_idx = -1;

            if (e.team == 2) {
                // Spawn powerup
                if (rnd(1) == 0) {
                    let inc = e.stat_increment();
                    let type = random_powerup_type();
                    if (type == HP_UP) {
                        inc *= 5;
                    } else if (type == AMMO_UP) {
                        inc = 1;
                    }
                    this.powerups.push(new Powerup(e.pos, type, inc));
                }
            }

            if (this.is_team_dead(1)) {
                append_log("You were defeated @ wave " + this.wave + ". Rest in Pieces ;)");
            } else if (this.is_team_dead(2)) {
                append_log("You defeated this wave, congratulations!");
                this.spawn_wave();
            }
            // Force redraw
            if (ctx) this.draw(ctx);
        }
    }

    noop() {}

    attack(src: Character, target: Character, on_done: () => void) {
        this.in_animation = true;
        // Very clever helper function!
        function shoot_n(src: Position2D, dst: Position2D,
                         dst_fail: Array<HexagonAxial>,
                         hitmap: Array<boolean>,
                         n: number, on_finish: () => void) {
            if (n <= 0) return on_finish();
            let target = dst;
            if (!hitmap[n]) {
                target = rnd_c(dst_fail).to_px(tile_size);
            }

            animate_shot(
                new ShotAnimation(
                    src,
                    target
                ),
                function() {
                    shoot_n(src, dst, dst_fail, hitmap, n - 1, on_finish)
                }
            );
        }

        let hitmap: Array<boolean> = new Array();
        for (let i = 0; i < src.shots_per_turn; i++) {
            hitmap.push(
                Math.random() < this.calc_chance_on_hit(src.pos, target.pos,
                                                        src.aim)
            );
        }

        let total_dmg = hitmap.filter(
            function(e) { return e; }
        ).length * src.effective_damage(target.defence);

        // Find possible locations where the shot could go to
        let miss_at: HexagonAxial | undefined = undefined;
        let possible_misses: Array<HexagonAxial> = new Array();
        for (let tile of this.playingfield.map_line(src.pos, target.pos)) {
            let [x, y] = tile.to_map_coords();
            if (tile_is_solid(this.playingfield.map.get_tile(x, y))) {
                miss_at = tile;
                break;
            }
        }

        if (miss_at == undefined) {
            // Let's just pick one of the neighbors
            possible_misses = target.pos.neighbors();
        } else {
            possible_misses.push(miss_at);
        }

        let t = this;
        shoot_n(
            src.pos.to_px(tile_size),
            target.pos.to_px(tile_size),
            possible_misses,
            hitmap,
            hitmap.length,
            function() {
                if (total_dmg > 0) {
                    t.attack_direct(src, target, total_dmg);
                } else {
                    append_log(src.name + " shot at " + target.name + " but missed.");
                }
                on_done();
                t.in_animation = false;
                t.auto_endturn_check();
            }
        );
    }

    attack_button_clicked() {
        if (this.in_animation) return;
        if (this.selected_character_idx != -1 &&
            this.aimed_at_character_idx != -1 &&
            this.characters[this.selected_character_idx].ap >= 1)
        {
            let src = this.characters[this.selected_character_idx];
            let dst = this.characters[this.aimed_at_character_idx];
            src.ap -= 1;
            let distance = this.playingfield.distance_between(src.pos, dst.pos);
            if (distance) {
                let t = this;
                this.attack(src, dst, function() {
                    // auto deselect when out of ap/steps
                    if (src.ap <= 0 && src.remaining_steps <= 0) {
                        t.selected_character_idx = -1
                        t.aimed_at_character_idx = -1
                    }
                });
            }
        }
    }

    calc_chance_on_hit(src: HexagonAxial, aimed_at: HexagonAxial, aim: number) {
        let hit_chance = 1;

        for (let tile of this.playingfield.map_line(src, aimed_at)) {
            let [x, y] = tile.to_map_coords();
            if (tile_is_solid(this.playingfield.map.get_tile(x, y))) {
                return 0;
            } else {
                hit_chance *= 0.9;
            }
        }
        hit_chance *= aim / 10;
        return round(hit_chance * 100) / 100;
    }

    // ===================================================================
    // Handler for user input
    // ===================================================================
    on_mouse_move(pos: Position2D) {
        if (this.in_animation) return;
        let posh = this.playingfield.hex_axial_from_coord(pos);
        let [cx, cy] = posh.to_map_coords();
        // Make sure we can only select hexagons in the play area
        if (cx >= 0 && cx < this.playingfield.hwidth() &&
            cy >= 0 && cy < this.playingfield.hheight()) {
            this.selected_hexagon = posh;
        }
        // If a character is selected highlight the current selected position
        // (as movement indicator)
        if (this.selected_character_idx != -1 || always_highlight_current_pos) {
            let tile = this.playingfield.get_tile_for_px(pos);
            if (!tile || tile_is_solid(tile)) {
                return;
            }

            let c: HTMLCanvasElement = <any>document.getElementById("x");
            let ctx = c.getContext('2d');
            if (ctx) {
                this.draw(ctx);
            }
        }
    }

    on_mouse_down(pos: Position2D) {
        if (this.in_animation) return;
        let new_position = this.playingfield.hex_axial_from_coord(pos);
        let c: HTMLCanvasElement = <any>document.getElementById("x");
        let ctx = c.getContext('2d');
        if (!ctx) {
            return;
        }

        if (this.selected_character_idx != -1) {
            let selected_char = this.characters[this.selected_character_idx];
            // Make sure you can't move characters from the other team ;)
            if (selected_char.team != this.active_team) {
                // deselect the char
                this.selected_character_idx = -1;
                this.draw(ctx);
                return;
            }
            // Move the char to the new position if the position is valid.
            if (tile_is_solid(this.playingfield.get_tile_for_px(pos))) {
                // Can only move to floor tiles.
            } else {
                // Attack / Set the new character position.
                let taken_by: Character | undefined = this.get_character_on(
                        new_position);
                if (taken_by && taken_by.team != this.active_team){
                    this.aimed_at_character_idx = this.characters.indexOf(
                        taken_by);
                        this.attack_button.label = "Attack:" + (this.calc_chance_on_hit(
                            this.characters[this.selected_character_idx].pos,
                            this.characters[this.aimed_at_character_idx].pos,
                            this.characters[this.selected_character_idx].aim
                        ) * 100).toFixed(0) + "%";
                    this.attack_button.draw(ctx);
                } else if (taken_by == selected_char) {
                    this.selected_character_idx = -1;
                    this.aimed_at_character_idx = -1;
                } else if (taken_by && taken_by.team == selected_char.team){
                    this.selected_character_idx = this.characters.indexOf(taken_by);
                    this.aimed_at_character_idx = -1;
                } else {
                    let distance = this.playingfield.distance_between(
                        selected_char.pos, new_position);
                    let range = selected_char.range()
                    if (distance) {
                        if (selected_char.remaining_steps == 0) {
                            if (distance <= range && selected_char.ap >= 1) {
                                this.move_selected_character(new_position);
                                this.selected_character_idx = -1;
                                this.aimed_at_character_idx = -1;
                                selected_char.remaining_steps = range;
                                selected_char.ap -= 1;
                                selected_char.remaining_steps -= distance;
                            } else {
                                this.selected_character_idx = -1;
                                this.aimed_at_character_idx = -1;
                            }
                        } else {
                            if (distance <= selected_char.remaining_steps) {
                                this.move_selected_character(new_position);
                                this.selected_character_idx = -1;
                                this.aimed_at_character_idx = -1;
                                selected_char.remaining_steps -= distance;
                            } else {
                                this.selected_character_idx = -1;
                                this.aimed_at_character_idx = -1;
                            }
                        }
                    }
                }
            }

            // Check for attack button as well
            // Note: We do not check whether the button is enabled as the
            // callback itself will validate this.
            if (this.attack_button.is_target(pos)) {
                this.attack_button_clicked();
            }
        } else {
            // Click on a tile while no char is selected.
            // Assume that the player wants to move a character or show it's
            // stats (in the case of an enemy)
            let c = this.get_character_on(new_position);
            if (c) {
                this.selected_character_idx = this.characters.indexOf(c);
                this.selected_powerup_idx = -1;
            } else {
                let i = this.get_powerup_on(new_position);
                if (i.length > 0) {
                    if (this.selected_powerup_idx != -1 &&
                        i.indexOf(this.powerups[this.selected_powerup_idx]) != -1)
                    {
                        let new_index = i.indexOf(this.powerups[this.selected_powerup_idx]) + 1;
                        if (new_index == i.length) {
                            this.selected_powerup_idx = -1;
                        } else {
                            this.selected_powerup_idx = this.powerups.indexOf(
                                i[new_index])
                        }
                    } else {
                        this.selected_powerup_idx = this.powerups.indexOf(i[0]);
                    }
                } else {
                    this.selected_powerup_idx = -1;
                }
            }
        }
        if (!this.game_ended() && this.endturn_button.is_target(pos)) {
            this.endturn_button_clicked();
        }
        this.auto_endturn_check();
        this.draw(ctx);
    }

    move_selected_character(pos: HexagonAxial) {
        let selected_char = this.characters[this.selected_character_idx];
        if (selected_char.team != 1) return;
        selected_char.pos = pos;
        for (let p of this.get_powerup_on(pos)) {
            this.pickup_powerup(selected_char, p);
        }
        this.update_fog_of_war();
    }

    pickup_powerup(character: Character, powerup: Powerup){
        if (powerup.type == HP_UP) {
            character.hp += powerup.value;
        } else if (powerup.type == AIM_UP) {
            character.aim += powerup.value;
        } else if (powerup.type == DMG_UP) {
            character.damage += powerup.value;
        } else if (powerup.type == AMMO_UP) {
            character.shots_per_turn += 1;
        } else if (powerup.type == AGI_UP) {
            character.agility += powerup.value;
        }

        let new_powerups = new Array();
        for (let p of this.powerups) {
            if (p != powerup) {
                new_powerups.push(p);
            }
        }
        this.powerups = new_powerups;
    }

    // ===================================================================
    // Rendering functions
    // ===================================================================
    draw(ctx: CanvasRenderingContext2D) {
        ctx.clearRect(0, 0, 9999, 9999);
        if (this.buffer_dirty) {
            this.buffer_ctx.clearRect(0, 0, 9999, 9999);
            this.playingfield.draw(this.buffer_ctx);
            this.buffer_dirty = false;
        }
        ctx.drawImage(this.buffer, 0, 0);

        // Draw sidebar
        ctx.clearRect(SIDEBAR_X, 0, SIDEBAR_W, SIDEBAR_H);
        if (this.selected_character_idx != -1) {
            this.draw_character_info(
                ctx, new Position2D(SIDEBAR_X, 50),
                this.characters[this.selected_character_idx]
            );
            if (this.aimed_at_character_idx != -1) {
                this.draw_character_info(
                    ctx, new Position2D(SIDEBAR_X, tile_size2 + 210),
                    this.characters[this.aimed_at_character_idx]
                );

                this.attack_button.draw(ctx);
            }

            // Very inefficient drawing of which tiles the player can reach.
            let reachable_fields = (
                this.characters[this.selected_character_idx].reachable_fields(
                    this.playingfield
                )
            );
            for (let pi of reachable_fields) {
                this.playingfield.fill_hexagon(
                    ctx, HexagonAxial.from_number(pi[0]),
                    'rgba(255, 255, 0, 0.5)',
                    0
                );
            }
        } else if (this.selected_powerup_idx != -1) {
            this.draw_powerup_info(
                ctx, new Position2D(SIDEBAR_X, 50),
                this.powerups[this.selected_powerup_idx]
            );
            // Also highlight the powerup
            this.playingfield.fill_hexagon(
                ctx, this.powerups[this.selected_powerup_idx].pos,
                'rgba(255, 255, 255, 0.8)',
                5
            );
            // XXX: Antibug
            ctx.lineWidth = 1;
        }

        // The code is the documentation!111
        // (Draw highlighted hexagon when moving but only if the position is
        //  walkable or the override is enabled)
        if (this.selected_hexagon !== null && (
                this.selected_character_idx != -1 &&
                !tile_is_solid(
                    this.playingfield.map.get_tile_hex(this.selected_hexagon)
                ) ||
                always_highlight_current_pos)
            )
        {
            this.playingfield.fill_hexagon(
                ctx,
                this.selected_hexagon,
                'deepskyblue',
                0
            );
        }

        // Draw FoW
        this.draw_fog_of_war(ctx);

        // Draw powerups
        for (let powerup of this.powerups) {
            if (!this.is_in_fog_of_war(powerup.pos)) {
                draw_health_icon(ctx, powerup.pos, POWERUP_COLORS[powerup.type]);
            }
        }

        // Draw characters
        for (let char of this.characters) {
            if (char.is_alive() && !this.is_in_fog_of_war(char.pos)) {
                char.draw(ctx);
            }
        }

        if (!this.game_ended()) {
            this.endturn_button.draw(ctx);
        }
    }
}
