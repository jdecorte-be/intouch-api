import { DEFAULT_BEAM_COLORS, renderBeamAvatarSvg } from './boring-avatar.util';

describe('renderBeamAvatarSvg', () => {
  it('renders a sized SVG document', () => {
    const svg = renderBeamAvatarSvg('seed', 64);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="64"');
    expect(svg).toContain('height="64"');
  });

  it('is deterministic per seed', () => {
    expect(renderBeamAvatarSvg('same')).toBe(renderBeamAvatarSvg('same'));
  });

  it('varies between seeds', () => {
    const svgs = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => renderBeamAvatarSvg(s)),
    );
    expect(svgs.size).toBeGreaterThan(1);
  });

  it('uses only palette colours for the background', () => {
    const svg = renderBeamAvatarSvg('seed');
    expect(DEFAULT_BEAM_COLORS.some((c) => svg.includes(c))).toBe(true);
  });

  it('respects a custom palette', () => {
    expect(renderBeamAvatarSvg('seed', 40, ['#123456'])).toContain('#123456');
  });
});
