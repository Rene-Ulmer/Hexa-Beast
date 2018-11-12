class RNG {
    seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    raw_sample(): number {
        return round(Math.abs(Math.sin(this.seed++) * 0x7FFFFFFF));
    }

    // If a and b is given, a = min, b = max.
    // If only a is given: a = max
    // otherwise return rnd number
    rand(a?: number, b?: number): number {
        let N = this.raw_sample();
        if (a !== undefined && b !== undefined) {
            return a + (N % (b - a));
        } else if (a !== undefined) {
            return N % a;
        }
        return N;
    }
}
