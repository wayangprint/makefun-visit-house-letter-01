// The kettle is on: posting the invitation.
//
// This entry is one picture, not a picture-making program. The letter
// to the AI judge already lives beside this file as letter.png, painted
// in the session that built the entry. All this script does is carry
// that picture to the single place and name the rules ask for:
// $MAKEFUN_OUTPUT_DIR/entry.png.
//
// Before posting it, the script checks the picture against the three
// limits the gate publishes — a whole PNG, no more than a mebibyte, no
// side longer than 1024 pixels — and refuses to post anything that
// breaks them. The same bytes go in every run, so the same bytes come
// out: nothing random, nothing fetched, no clock involved.

import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The letter as it ships in this repo, and the name the grader wants.
const LETTER_NAME = "letter.png";
const ENTRY_NAME = "entry.png";

// The gate's three published limits.
const BYTES_ALLOWED = 1048576;
const SIDE_ALLOWED = 1024;

// Every PNG begins with these eight bytes; anything else is not a PNG.
const PNG_MARK = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The folder holding this file: the picture travels with the code, so
// the script looks next to itself, never at the caller's directory.
const HOME = fileURLToPath(new URL(".", import.meta.url));

// The tray the grader reads, or /output when nothing is named.
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Decode one unsigned 32-bit big-endian integer from four bytes.
function u32be(chunk: Buffer): number {
  let value = 0;
  for (const byte of chunk) {
    value = value * 256 + byte;
  }
  return value;
}

// Refuse anything that is not a small, well-formed PNG letter: check
// the byte count, the PNG mark, then the width and height the IHDR
// chunk stores right after the mark.
function inspectLetter(picture: Buffer): { wide: number; tall: number } {
  if (picture.byteLength > BYTES_ALLOWED) {
    throw new Error(
      `letter is ${picture.byteLength} bytes, over the ${BYTES_ALLOWED} limit`,
    );
  }
  if (Buffer.compare(picture.subarray(0, 8), PNG_MARK) !== 0) {
    throw new Error("letter is not a PNG file");
  }
  const wide = u32be(picture.subarray(16, 20));
  const tall = u32be(picture.subarray(20, 24));
  if (wide > SIDE_ALLOWED || tall > SIDE_ALLOWED) {
    throw new Error(
      `letter is ${wide}x${tall}, over the ${SIDE_ALLOWED}x${SIDE_ALLOWED} limit`,
    );
  }
  return { wide, tall };
}

// Post the letter through a fresh file handle, then read the copy back
// off disk and refuse to finish unless it matches the letter exactly,
// byte for byte. A silent short write must never pass as a delivery.
function postLetter(picture: Buffer): string {
  mkdirSync(OUT_DIR, { recursive: true });
  const target = join(OUT_DIR, ENTRY_NAME);
  const handle = openSync(target, "w");
  try {
    let written = 0;
    while (written < picture.length) {
      written += writeSync(handle, picture, written, picture.length - written);
    }
  } finally {
    closeSync(handle);
  }
  const back = readFileSync(target);
  if (!back.equals(picture)) {
    throw new Error("written entry does not match the letter");
  }
  return target;
}

const picture = readFileSync(join(HOME, LETTER_NAME));
const size = inspectLetter(picture);
const target = postLetter(picture);
console.log(
  `posted ${size.wide}x${size.tall} letter to ${target} (${picture.byteLength} bytes)`,
);
