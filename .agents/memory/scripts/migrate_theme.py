#!/usr/bin/env python3
"""
ReceitaNet ERP Theme Migration Script
Migrates all JSX pages from dark theme to ReceitaNet ERP light theme.
"""
import re
import os

ADMIN_DIR = '/var/www/hotspot/frontend/src/pages/admin'
SUPER_DIR = '/var/www/hotspot/frontend/src/pages/super'

# Files already migrated (skip)
SKIP = {'Dashboard.jsx', 'SuperDashboard.jsx'}

# Background replacements (order matters — more specific first)
BG_REPLACEMENTS = [
    # Main card/panel backgrounds
    (r'bg-\[#1a1d27\]',     'bg-white'),
    (r'bg-\[#161b22\]',     'bg-white'),
    (r'bg-\[#141620\]',     'bg-slate-50'),
    (r'bg-\[#151821\]',     'bg-slate-50'),
    (r'bg-\[#0f111a\]',     'bg-[#f1f5f9]'),
    (r'bg-\[#0d1117\]',     'bg-[#f1f5f9]'),
    # Hover / secondary
    (r'bg-\[#252b3b\]/60',  'bg-slate-50'),
    (r'bg-\[#252b3b\]/70',  'bg-slate-100'),
    (r'bg-\[#252b3b\]',     'bg-slate-100'),
    (r'bg-\[#21262d\]',     'bg-slate-100'),
    (r'bg-\[#30363d\]',     'bg-slate-200'),
    # Gray backgrounds
    (r'bg-gray-900/50',     'bg-slate-100'),
    (r'bg-gray-900/30',     'bg-slate-50'),
    (r'bg-gray-900',        'bg-slate-100'),
    (r'bg-gray-800/50',     'bg-slate-100'),
    (r'bg-gray-800',        'bg-slate-100'),
    (r'bg-gray-700',        'bg-slate-200'),
    # Badge dark backgrounds → light
    (r'bg-emerald-950/60',  'bg-emerald-100'),
    (r'bg-emerald-950/30',  'bg-emerald-50'),
    (r'bg-emerald-950/50',  'bg-emerald-100'),
    (r'bg-blue-950/60',     'bg-blue-100'),
    (r'bg-blue-950/30',     'bg-blue-50'),
    (r'bg-blue-950/50',     'bg-blue-100'),
    (r'bg-red-950/60',      'bg-red-100'),
    (r'bg-red-950/30',      'bg-red-50'),
    (r'bg-red-950/50',      'bg-red-100'),
    (r'bg-amber-950/60',    'bg-amber-100'),
    (r'bg-amber-950/30',    'bg-amber-50'),
    (r'bg-amber-950/50',    'bg-amber-100'),
    (r'bg-purple-950/60',   'bg-purple-100'),
    (r'bg-purple-950/30',   'bg-purple-50'),
    (r'bg-purple-950/50',   'bg-purple-100'),
    (r'bg-orange-950/60',   'bg-orange-100'),
    (r'bg-orange-950/30',   'bg-orange-50'),
    (r'bg-cyan-950/60',     'bg-cyan-100'),
    (r'bg-cyan-950/30',     'bg-cyan-50'),
    (r'bg-yellow-950/60',   'bg-yellow-100'),
    (r'bg-pink-950/60',     'bg-pink-100'),
    (r'bg-violet-950/60',   'bg-violet-100'),
    (r'bg-indigo-950/60',   'bg-indigo-100'),
    (r'bg-teal-950/60',     'bg-teal-100'),
    (r'bg-rose-950/60',     'bg-rose-100'),
]

HOVER_REPLACEMENTS = [
    (r'hover:bg-\[#252b3b\]/60', 'hover:bg-slate-50'),
    (r'hover:bg-\[#252b3b\]',    'hover:bg-slate-50'),
    (r'hover:bg-\[#21262d\]',    'hover:bg-slate-50'),
    (r'hover:bg-\[#30363d\]',    'hover:bg-slate-100'),
    (r'hover:bg-gray-800',       'hover:bg-slate-100'),
    (r'hover:bg-gray-700',       'hover:bg-slate-200'),
    (r'hover:bg-gray-900',       'hover:bg-slate-100'),
]

BORDER_REPLACEMENTS = [
    (r'border-\[#30363d\]',      'border-slate-200'),
    (r'border-gray-800/80',      'border-slate-200'),
    (r'border-gray-800/60',      'border-slate-200'),
    (r'border-gray-800/40',      'border-slate-200'),
    (r'border-gray-800/30',      'border-slate-200'),
    (r'border-gray-800',         'border-slate-200'),
    (r'border-gray-700/80',      'border-slate-300'),
    (r'border-gray-700/60',      'border-slate-300'),
    (r'border-gray-700',         'border-slate-300'),
    (r'border-gray-600',         'border-slate-400'),
    # Badge borders (dark → light)
    (r'border-emerald-800/50',   'border-emerald-200'),
    (r'border-emerald-800/40',   'border-emerald-200'),
    (r'border-emerald-800',      'border-emerald-200'),
    (r'border-blue-800/50',      'border-blue-200'),
    (r'border-blue-800/40',      'border-blue-200'),
    (r'border-blue-800',         'border-blue-200'),
    (r'border-red-800/50',       'border-red-200'),
    (r'border-red-800/40',       'border-red-200'),
    (r'border-red-800',          'border-red-200'),
    (r'border-amber-800/50',     'border-amber-200'),
    (r'border-amber-800/40',     'border-amber-200'),
    (r'border-amber-800',        'border-amber-200'),
    (r'border-purple-800/50',    'border-purple-200'),
    (r'border-purple-800/40',    'border-purple-200'),
    (r'border-purple-800',       'border-purple-200'),
    (r'border-orange-800/50',    'border-orange-200'),
    (r'border-orange-800',       'border-orange-200'),
    (r'border-cyan-800/50',      'border-cyan-200'),
    (r'border-cyan-800',         'border-cyan-200'),
    (r'border-indigo-800/50',    'border-indigo-200'),
    (r'border-indigo-800',       'border-indigo-200'),
    (r'border-teal-800/50',      'border-teal-200'),
    (r'border-teal-800',         'border-teal-200'),
    (r'border-violet-800/50',    'border-violet-200'),
    (r'border-violet-800',       'border-violet-200'),
    (r'border-rose-800/50',      'border-rose-200'),
    (r'border-rose-800',         'border-rose-200'),
    (r'border-pink-800/50',      'border-pink-200'),
    (r'border-pink-800',         'border-pink-200'),
]

DIVIDE_REPLACEMENTS = [
    (r'divide-gray-800/60',  'divide-slate-200'),
    (r'divide-gray-800',     'divide-slate-200'),
    (r'divide-gray-700',     'divide-slate-200'),
]

TEXT_REPLACEMENTS = [
    # Neutral grays
    (r'text-gray-100\b',   'text-slate-900'),
    (r'text-gray-200\b',   'text-slate-800'),
    (r'text-gray-300\b',   'text-slate-700'),
    (r'text-gray-400\b',   'text-slate-500'),
    (r'text-gray-500\b',   'text-slate-400'),
    (r'text-gray-600\b',   'text-slate-600'),
    # Badge text: dark variant → light variant
    (r'text-emerald-400\b', 'text-emerald-700'),
    (r'text-emerald-300\b', 'text-emerald-700'),
    (r'text-blue-400\b',    'text-blue-700'),
    (r'text-blue-300\b',    'text-blue-700'),
    (r'text-red-400\b',     'text-red-700'),
    (r'text-red-300\b',     'text-red-700'),
    (r'text-amber-400\b',   'text-amber-700'),
    (r'text-amber-300\b',   'text-amber-700'),
    (r'text-purple-400\b',  'text-purple-700'),
    (r'text-purple-300\b',  'text-purple-700'),
    (r'text-orange-400\b',  'text-orange-700'),
    (r'text-orange-300\b',  'text-orange-700'),
    (r'text-cyan-400\b',    'text-cyan-700'),
    (r'text-cyan-300\b',    'text-cyan-700'),
    (r'text-indigo-400\b',  'text-indigo-700'),
    (r'text-indigo-300\b',  'text-indigo-700'),
    (r'text-teal-400\b',    'text-teal-700'),
    (r'text-teal-300\b',    'text-teal-700'),
    (r'text-violet-400\b',  'text-violet-700'),
    (r'text-violet-300\b',  'text-violet-700'),
    (r'text-rose-400\b',    'text-rose-700'),
    (r'text-rose-300\b',    'text-rose-700'),
    (r'text-pink-400\b',    'text-pink-700'),
    (r'text-pink-300\b',    'text-pink-700'),
    (r'text-yellow-400\b',  'text-yellow-700'),
    (r'text-yellow-300\b',  'text-yellow-700'),
]

INPUT_REPLACEMENTS = [
    (r'placeholder-gray-600',  'placeholder-slate-400'),
    (r'placeholder-gray-500',  'placeholder-slate-400'),
    (r'placeholder-gray-400',  'placeholder-slate-300'),
]

ALL_REPLACEMENTS = (
    BG_REPLACEMENTS +
    HOVER_REPLACEMENTS +
    BORDER_REPLACEMENTS +
    DIVIDE_REPLACEMENTS +
    TEXT_REPLACEMENTS +
    INPUT_REPLACEMENTS
)

# Patterns that indicate a line has a colored button/badge bg (keep text-white)
COLORED_BG_PATTERN = re.compile(
    r'bg-(blue|red|green|emerald|orange|amber|purple|indigo|cyan|teal|rose|violet|pink|yellow|sky|lime)-\d+|'
    r'bg-\[#2563eb\]|bg-\[#1f6feb\]|bg-\[#16a34a\]|bg-\[#dc2626\]|bg-\[#d97706\]|bg-\[#7c3aed\]'
)

def process_file(filepath):
    filename = os.path.basename(filepath)
    if filename in SKIP:
        print(f'  SKIP (already done): {filename}')
        return 0

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Apply all bulk replacements
    for pattern, replacement in ALL_REPLACEMENTS:
        content = re.sub(pattern, replacement, content)

    # Smart text-white → text-slate-900
    # Only replace when the line doesn't have a colored background (non-button/badge context)
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if 'text-white' in line:
            # If line has a colored background class, it's probably a button → keep text-white
            if COLORED_BG_PATTERN.search(line):
                new_lines.append(line)
            else:
                # Replace text-white with text-slate-900 (heading/card content on white bg)
                new_lines.append(line.replace('text-white', 'text-slate-900'))
        else:
            new_lines.append(line)
    content = '\n'.join(new_lines)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        changes = len(re.findall(r'\n', original)) - len(re.findall(r'\n', content)) + 1
        print(f'  ✅ Updated: {filename}')
        return 1
    else:
        print(f'  ⬜ No changes: {filename}')
        return 0

def main():
    total = 0
    updated = 0

    for directory, label in [(ADMIN_DIR, 'Admin'), (SUPER_DIR, 'Super')]:
        print(f'\n📁 Processing {label} pages...')
        for filename in sorted(os.listdir(directory)):
            if not filename.endswith('.jsx'):
                continue
            filepath = os.path.join(directory, filename)
            updated += process_file(filepath)
            total += 1

    print(f'\n✅ Done! Updated {updated}/{total} files.')

if __name__ == '__main__':
    main()
