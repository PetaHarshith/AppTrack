import React from 'react';

type Props = {
    data: number[];
    width?: number;
    height?: number;
    stroke?: string;
    fill?: string;
    strokeWidth?: number;
    showDot?: boolean;
};

/**
 * Tiny SVG sparkline. Auto-scales to data range.
 * Used inline next to KPI numbers.
 */
export const Sparkline: React.FC<Props> = ({
    data,
    width = 80,
    height = 24,
    stroke = 'currentColor',
    fill,
    strokeWidth = 1.5,
    showDot = true,
}) => {
    if (!data || data.length === 0) {
        return <svg width={width} height={height} />;
    }

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = Math.max(max - min, 1);
    const pad = 2;
    const w = width - pad * 2;
    const h = height - pad * 2;

    const points = data.map((v, i) => {
        const x = pad + (i / Math.max(data.length - 1, 1)) * w;
        const y = pad + h - ((v - min) / range) * h;
        return { x, y };
    });

    const pathD = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ');

    const areaD = fill
        ? `${pathD} L ${points[points.length - 1]!.x.toFixed(2)} ${(height - pad).toFixed(2)} L ${points[0]!.x.toFixed(2)} ${(height - pad).toFixed(2)} Z`
        : '';

    const lastPoint = points[points.length - 1]!;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            {fill && <path d={areaD} fill={fill} opacity={0.18} />}
            <path
                d={pathD}
                stroke={stroke}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {showDot && (
                <circle
                    cx={lastPoint.x}
                    cy={lastPoint.y}
                    r={2}
                    fill={stroke}
                />
            )}
        </svg>
    );
};
