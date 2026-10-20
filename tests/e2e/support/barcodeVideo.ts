// Video Y4M (640×480, 30 fotogrammi) con un codice EAN-13 disegnato, per la fotocamera finta di Chromium.
// Si genera durante il test (circa 14 MB): così non sta nel repo.
import { writeFileSync } from 'node:fs'

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

/** Cifra di controllo EAN-13 delle prime 12 cifre. */
export function ean13(code12: string): string {
  const sum = [...code12].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0)
  return code12 + String((10 - (sum % 10)) % 10)
}

/** Scrive il video in `path` e restituisce il codice completo (13 cifre). */
export function writeBarcodeVideo(code12: string, path: string): string {
  const code = ean13(code12)
  let bits = '101'
  for (const [i, digit] of [...code.slice(1, 7)].entries()) {
    bits += (PARITY[Number(code[0])]![i] === 'L' ? L : G)[Number(digit)]
  }
  bits += '01010'
  for (const digit of code.slice(7)) bits += R[Number(digit)]
  bits += '101'

  const W = 640
  const H = 480
  const M = 4 // pixel per modulo
  const quiet = Math.floor((W - bits.length * M) / 2)
  const yPlane = Buffer.alloc(W * H, 235)
  for (let y = 140; y < 340; y += 1) {
    for (const [i, bit] of [...bits].entries()) {
      if (bit === '1') yPlane.fill(16, y * W + quiet + i * M, y * W + quiet + (i + 1) * M)
    }
  }
  const uv = Buffer.alloc((W / 2) * (H / 2), 128)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), yPlane, uv, uv])
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`)
  writeFileSync(path, Buffer.concat([header, ...Array.from({ length: 30 }, () => frame)]))
  return code
}
