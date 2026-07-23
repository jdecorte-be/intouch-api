// Self-hosted port of boring-avatars' "Beam" variant (MIT licensed,
// https://github.com/boringdesigners/boring-avatars) so default profile
// pictures don't depend on the third-party source.boringavatars.com API,
// which turned out to be a paid/subscription service rather than a free
// public endpoint. Same algorithm, same default palette, rendered to a
// plain SVG string instead of a React component.

const SIZE = 36;

// The palette boring-avatars documents as its own default.
export const DEFAULT_BEAM_COLORS = ["#92A1C6", "#146A7C", "#F0AB3D", "#C271B4", "#C20D90"];

function hashCode(name: string): number {
  let hash = 0;

  for (let i = 0; i < name.length; i += 1) {
    const character = name.charCodeAt(i);
    hash = (hash << 5) - hash + character;
    hash &= hash; // Convert to 32bit integer
  }

  return Math.abs(hash);
}

function getDigit(number: number, ntn: number): number {
  return Math.floor((number / Math.pow(10, ntn)) % 10);
}

function getBoolean(number: number, ntn: number): boolean {
  return getDigit(number, ntn) % 2 === 0;
}

function getUnit(number: number, range: number, index?: number): number {
  const value = number % range;

  if (index !== undefined && getDigit(number, index) % 2 === 0) {
    return -value;
  }

  return value;
}

function getRandomColor(number: number, colors: string[]): string {
  return colors[number % colors.length];
}

function getContrast(hexColor: string): string {
  const hex = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  return yiq >= 128 ? "#000000" : "#FFFFFF";
}

function generateBeamData(name: string, colors: string[]) {
  const numFromName = hashCode(name);
  const wrapperColor = getRandomColor(numFromName, colors);
  const preTranslateX = getUnit(numFromName, 10, 1);
  const wrapperTranslateX = preTranslateX < 5 ? preTranslateX + SIZE / 9 : preTranslateX;
  const preTranslateY = getUnit(numFromName, 10, 2);
  const wrapperTranslateY = preTranslateY < 5 ? preTranslateY + SIZE / 9 : preTranslateY;

  return {
    wrapperColor,
    faceColor: getContrast(wrapperColor),
    backgroundColor: getRandomColor(numFromName + 13, colors),
    wrapperTranslateX,
    wrapperTranslateY,
    wrapperRotate: getUnit(numFromName, 360),
    wrapperScale: 1 + getUnit(numFromName, SIZE / 12) / 10,
    isMouthOpen: getBoolean(numFromName, 2),
    isCircle: getBoolean(numFromName, 1),
    eyeSpread: getUnit(numFromName, 5),
    mouthSpread: getUnit(numFromName, 3),
    faceRotate: getUnit(numFromName, 10, 3),
    faceTranslateX: wrapperTranslateX > SIZE / 6 ? wrapperTranslateX / 2 : getUnit(numFromName, 8, 1),
    faceTranslateY: wrapperTranslateY > SIZE / 6 ? wrapperTranslateY / 2 : getUnit(numFromName, 7, 2),
  };
}

// Renders the same "Beam" avatar boring-avatars' React component would,
// as a standalone SVG document sized to `size` px square.
export function renderBeamAvatarSvg(seed: string, size = 120, colors: string[] = DEFAULT_BEAM_COLORS): string {
  const data = generateBeamData(seed, colors);
  const maskId = "beam-mask";
  const center = SIZE / 2;

  const mouth = data.isMouthOpen
    ? `<path d="M15 ${19 + data.mouthSpread}c2 1 4 1 6 0" stroke="${data.faceColor}" fill="none" stroke-linecap="round" />`
    : `<path d="M13,${19 + data.mouthSpread} a1,0.75 0 0,0 10,0" fill="${data.faceColor}" />`;

  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" fill="none" role="img" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}">
    <rect width="${SIZE}" height="${SIZE}" rx="${SIZE * 2}" fill="#FFFFFF" />
  </mask>
  <g mask="url(#${maskId})">
    <rect width="${SIZE}" height="${SIZE}" fill="${data.backgroundColor}" />
    <rect
      x="0"
      y="0"
      width="${SIZE}"
      height="${SIZE}"
      transform="translate(${data.wrapperTranslateX} ${data.wrapperTranslateY}) rotate(${data.wrapperRotate} ${center} ${center}) scale(${data.wrapperScale})"
      fill="${data.wrapperColor}"
      rx="${data.isCircle ? SIZE : SIZE / 6}"
    />
    <g transform="translate(${data.faceTranslateX} ${data.faceTranslateY}) rotate(${data.faceRotate} ${center} ${center})">
      ${mouth}
      <rect x="${14 - data.eyeSpread}" y="14" width="1.5" height="2" rx="1" stroke="none" fill="${data.faceColor}" />
      <rect x="${20 + data.eyeSpread}" y="14" width="1.5" height="2" rx="1" stroke="none" fill="${data.faceColor}" />
    </g>
  </g>
</svg>`;
}
