/**
 * escpos.ts — minimal ESC/POS byte builder for EPSON TM-T100.
 *
 * Phase 2 scope:
 *   - Init, alignment, bold, character size, code page selection.
 *   - Paper feed and partial cut with feed.
 *   - Latin-1 (CP1252) text encoding only. Arabic fallback to '?' so that
 *     bad encoding never blocks a print job — full Arabic support is
 *     deferred to Phase 3 (needs CP864/CP1256 verified against firmware).
 */
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
/** Raw byte builders for ESC/POS commands. */
export const Cmd = {
    /** ESC @ — initialize printer (clears state, line spacing, etc). */
    init: Buffer.from([ESC, 0x40]),
    /** ESC d n — feed n lines. */
    feed: (n) => Buffer.from([ESC, 0x64, Math.max(0, Math.min(255, n | 0))]),
    /** ESC a n — 0=left, 1=center, 2=right. */
    align: (n) => Buffer.from([ESC, 0x61, n]),
    /** ESC E n — bold on/off. */
    bold: (on) => Buffer.from([ESC, 0x45, on ? 1 : 0]),
    /** ESC - n — underline 0=off, 1=1-dot, 2=2-dot. */
    underline: (level) => Buffer.from([ESC, 0x2d, level]),
    /**
     * GS ! n — character size. w/h are 0-indexed multipliers
     * (0 = 1×, 1 = 2×, ..., 7 = 8×). Both axes max out at 8×.
     */
    size: (w, h) => Buffer.from([GS, 0x21, ((w & 7) << 4) | (h & 7)]),
    /** ESC t n — select character code page (16 = WPC1252 / Latin-1). */
    codepage: (n) => Buffer.from([ESC, 0x74, n & 0xff]),
    /** GS V B n — feed n dots then partial cut. Standard receipt cut. */
    cutPartial: (feedDots = 3) => Buffer.from([GS, 0x56, 0x42, Math.max(0, Math.min(255, feedDots | 0))]),
    /** GS V 0 — full cut (fewer printers support it). */
    cutFull: Buffer.from([GS, 0x56, 0x00]),
    /** ESC p 0 25 250 — pulse drawer connector pin 2 (standard cash drawer). */
    drawer: Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]),
    /** Plain LF (newline). */
    lf: Buffer.from([LF]),
};
/**
 * Encode a JS string into Latin-1 (CP1252-compatible) bytes for the printer.
 * Codepoints above 0xFF are replaced with '?' rather than crashing — this
 * keeps Arabic input from breaking the whole receipt during Phase 2 testing.
 */
export function latin1(str) {
    const safe = Array.from(str, (ch) => {
        const cp = ch.codePointAt(0);
        return cp <= 0xff ? ch : "?";
    }).join("");
    return Buffer.from(safe, "latin1");
}
/**
 * Fluent builder. Concatenates command and text buffers; call build() at the
 * end to materialize the final byte stream for the printer.
 */
export class EscposBuilder {
    chunks = [];
    raw(b) {
        this.chunks.push(b);
        return this;
    }
    text(s) {
        this.chunks.push(latin1(s));
        return this;
    }
    textln(s = "") {
        this.chunks.push(latin1(s));
        this.chunks.push(Cmd.lf);
        return this;
    }
    lf(n = 1) {
        for (let i = 0; i < n; i++)
            this.chunks.push(Cmd.lf);
        return this;
    }
    init() {
        return this.raw(Cmd.init);
    }
    align(a) {
        return this.raw(Cmd.align(a));
    }
    bold(on) {
        return this.raw(Cmd.bold(on));
    }
    size(w, h) {
        return this.raw(Cmd.size(w, h));
    }
    codepage(n) {
        return this.raw(Cmd.codepage(n));
    }
    feed(n) {
        return this.raw(Cmd.feed(n));
    }
    cutPartial(feedDots = 3) {
        return this.raw(Cmd.cutPartial(feedDots));
    }
    build() {
        return Buffer.concat(this.chunks);
    }
}
//# sourceMappingURL=escpos.js.map