import React from 'react';

type Props = {
    name: string;
    size?: number;
    className?: string;
};

// Stable string hash → 0..1
const hash = (str: string): number => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h) / 2147483647;
};

/**
 * Deterministic gradient avatar generated from the user's name.
 * Two colors derived from a hash, joined at an angle that also comes from the hash.
 * Feels distinctive and recognizable for sharing.
 */
export const GenerativeAvatar: React.FC<Props> = ({ name, size = 32, className }) => {
    const h1 = hash(name);
    const h2 = hash(name + 'x');
    const h3 = hash(name + 'y');

    const hueA = Math.floor(h1 * 360);
    const hueB = (hueA + 40 + Math.floor(h2 * 60)) % 360;
    const angle = Math.floor(h3 * 360);

    const color1 = `oklch(0.62 0.18 ${hueA})`;
    const color2 = `oklch(0.54 0.22 ${hueB})`;
    const initial = name.charAt(0).toUpperCase() || '?';

    const id = `gav-${name.replace(/\W/g, '').slice(0, 8)}-${Math.floor(h1 * 100)}`;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            className={className}
            style={{ borderRadius: 8 }}
        >
            <defs>
                <linearGradient
                    id={id}
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                    gradientTransform={`rotate(${angle} 0.5 0.5)`}
                >
                    <stop offset="0%" stopColor={color1} />
                    <stop offset="100%" stopColor={color2} />
                </linearGradient>
            </defs>
            <rect width="100" height="100" rx="14" fill={`url(#${id})`} />
            <text
                x="50"
                y="50"
                dy="0.36em"
                textAnchor="middle"
                style={{
                    fontSize: 44,
                    fontWeight: 700,
                    fill: 'white',
                    letterSpacing: '-0.02em',
                }}
            >
                {initial}
            </text>
        </svg>
    );
};
