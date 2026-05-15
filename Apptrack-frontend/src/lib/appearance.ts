/**
 * Appearance system — controls global look & feel via classes on <html>.
 *
 * Axes are independent, but Presets stamp combinations of them.
 * Settings persist in localStorage and apply pre-mount via initAppearance()
 * (called from src/index.tsx) so there's no flash on load.
 */

import { useEffect, useState, useCallback } from 'react';

export type Density = 'compact' | 'comfortable' | 'cozy';
export type Font = 'sans' | 'mono' | 'serif';
export type Radius = 'sharp' | 'default' | 'soft' | 'pill';
export type Accent = 'default' | 'rose' | 'blue' | 'green' | 'violet' | 'orange';
export type Background = 'none' | 'dots' | 'grid' | 'lines' | 'noise';
export type Motion = 'full' | 'reduced';

export type Preset = 'default' | 'terminal' | 'editorial' | 'brutal' | 'soft' | 'custom';

export type Appearance = {
    preset: Preset;
    density: Density;
    font: Font;
    radius: Radius;
    accent: Accent;
    background: Background;
    motion: Motion;
};

export const DEFAULT_APPEARANCE: Appearance = {
    preset: 'default',
    density: 'comfortable',
    font: 'sans',
    radius: 'default',
    accent: 'default',
    background: 'dots',
    motion: 'full',
};

// Each preset is a complete stamp — picking one rewrites every axis.
export const PRESETS: Record<Exclude<Preset, 'custom'>, Omit<Appearance, 'preset'>> = {
    default: {
        density: 'comfortable',
        font: 'sans',
        radius: 'default',
        accent: 'default',
        background: 'dots',
        motion: 'full',
    },
    terminal: {
        density: 'compact',
        font: 'mono',
        radius: 'sharp',
        accent: 'green',
        background: 'grid',
        motion: 'reduced',
    },
    editorial: {
        density: 'cozy',
        font: 'serif',
        radius: 'soft',
        accent: 'orange',
        background: 'none',
        motion: 'full',
    },
    brutal: {
        density: 'comfortable',
        font: 'sans',
        radius: 'sharp',
        accent: 'default',
        background: 'lines',
        motion: 'reduced',
    },
    soft: {
        density: 'cozy',
        font: 'sans',
        radius: 'pill',
        accent: 'violet',
        background: 'noise',
        motion: 'full',
    },
};

const STORAGE_KEY = 'apptrack-appearance';

const ALL_DENSITY: Density[] = ['compact', 'comfortable', 'cozy'];
const ALL_FONT: Font[] = ['sans', 'mono', 'serif'];
const ALL_RADIUS: Radius[] = ['sharp', 'default', 'soft', 'pill'];
const ALL_ACCENT: Accent[] = ['default', 'rose', 'blue', 'green', 'violet', 'orange'];
const ALL_BG: Background[] = ['none', 'dots', 'grid', 'lines', 'noise'];
const ALL_MOTION: Motion[] = ['full', 'reduced'];

function classFor(axis: string, value: string) {
    return `${axis}-${value}`;
}

function removeAxisClasses(html: HTMLElement, axis: string, values: readonly string[]) {
    for (const v of values) html.classList.remove(classFor(axis, v));
}

export function applyAppearance(a: Appearance) {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;

    removeAxisClasses(html, 'density', ALL_DENSITY);
    removeAxisClasses(html, 'font', ALL_FONT);
    removeAxisClasses(html, 'radius', ALL_RADIUS);
    removeAxisClasses(html, 'bg', ALL_BG);
    removeAxisClasses(html, 'motion', ALL_MOTION);
    // Accent uses the legacy `theme-*` class names already wired in App.css.
    for (const acc of ALL_ACCENT) {
        if (acc !== 'default') html.classList.remove(`theme-${acc}`);
    }

    html.classList.add(classFor('density', a.density));
    html.classList.add(classFor('font', a.font));
    html.classList.add(classFor('radius', a.radius));
    html.classList.add(classFor('bg', a.background));
    html.classList.add(classFor('motion', a.motion));
    if (a.accent !== 'default') html.classList.add(`theme-${a.accent}`);
}

export function readAppearance(): Appearance {
    if (typeof localStorage === 'undefined') return DEFAULT_APPEARANCE;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_APPEARANCE;
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_APPEARANCE, ...parsed };
    } catch {
        return DEFAULT_APPEARANCE;
    }
}

export function writeAppearance(a: Appearance) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    } catch {
        /* quota or private mode — swallow */
    }
}

/** Apply persisted appearance synchronously on app boot. */
export function initAppearance() {
    applyAppearance(readAppearance());
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook
// ─────────────────────────────────────────────────────────────────────────────
export function useAppearance() {
    const [appearance, setAppearance] = useState<Appearance>(() => readAppearance());

    useEffect(() => {
        applyAppearance(appearance);
        writeAppearance(appearance);
    }, [appearance]);

    const update = useCallback((patch: Partial<Appearance>) => {
        setAppearance((prev) => {
            const next: Appearance = { ...prev, ...patch };
            // Any manual edit (other than picking a preset) drops us into 'custom'.
            if (!('preset' in patch)) next.preset = 'custom';
            return next;
        });
    }, []);

    const applyPreset = useCallback((preset: Exclude<Preset, 'custom'>) => {
        setAppearance({ preset, ...PRESETS[preset] });
    }, []);

    const reset = useCallback(() => setAppearance(DEFAULT_APPEARANCE), []);

    return { appearance, update, applyPreset, reset };
}
