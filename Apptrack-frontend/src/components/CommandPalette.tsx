import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useRegisterActions, Priority } from 'kbar';
import { useTheme } from '@/components/refine-ui/theme/theme-provider';

/**
 * Custom Cmd-K actions on top of Refine's auto-registered resource navigation.
 * Mount this inside the Refine + Kbar provider tree (App.tsx).
 */
export default function CommandPalette() {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();

    const actions = useMemo(() => [
        // ---- Create flows ----
        {
            id: 'new-application',
            name: 'New application',
            shortcut: ['n'],
            keywords: 'create add new application track',
            section: 'Create',
            priority: Priority.HIGH,
            perform: () => navigate('/applications/create'),
        },
        {
            id: 'import-url',
            name: 'Import from URL',
            keywords: 'import paste link greenhouse lever ashby scrape',
            section: 'Create',
            priority: Priority.HIGH,
            perform: () => navigate('/applications/create#import'),
        },

        // ---- View switching ----
        {
            id: 'view-board',
            name: 'Switch to board view',
            keywords: 'kanban drag board',
            section: 'Views',
            perform: () => {
                localStorage.setItem('apptrack:viewMode', 'board');
                navigate('/applications');
            },
        },
        {
            id: 'view-list',
            name: 'Switch to list view',
            keywords: 'table list rows',
            section: 'Views',
            perform: () => {
                localStorage.setItem('apptrack:viewMode', 'table');
                navigate('/applications');
            },
        },

        // ---- Status filters ----
        {
            id: 'filter-offer',
            name: 'Show only Offers',
            section: 'Filter by status',
            keywords: 'offer offers won accepted',
            perform: () => navigate('/applications?filters[0][field]=status&filters[0][operator]=eq&filters[0][value]=Offer'),
        },
        {
            id: 'filter-interview',
            name: 'Show only Interviews',
            section: 'Filter by status',
            keywords: 'interview interviewing',
            perform: () => navigate('/applications?filters[0][field]=status&filters[0][operator]=eq&filters[0][value]=Interview'),
        },
        {
            id: 'filter-oa',
            name: 'Show only OAs',
            section: 'Filter by status',
            keywords: 'oa online assessment',
            perform: () => navigate('/applications?filters[0][field]=status&filters[0][operator]=eq&filters[0][value]=OA'),
        },
        {
            id: 'filter-applied',
            name: 'Show only Applied',
            section: 'Filter by status',
            keywords: 'applied pending waiting',
            perform: () => navigate('/applications?filters[0][field]=status&filters[0][operator]=eq&filters[0][value]=Applied'),
        },

        // ---- Theme ----
        {
            id: 'theme-toggle',
            name: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
            shortcut: ['t'],
            keywords: 'theme dark light mode',
            section: 'Preferences',
            perform: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
        },
        {
            id: 'theme-system',
            name: 'Use system theme',
            keywords: 'theme system auto',
            section: 'Preferences',
            perform: () => setTheme('system'),
        },
    ], [navigate, theme, setTheme]);

    useRegisterActions(actions, [actions]);

    return null;
}
