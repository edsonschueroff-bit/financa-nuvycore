#!/usr/bin/env python3
"""
Standardize Page Headers and KPI Cards across all admin and super pages.
"""
import os
import re

ADMIN_DIR = '/var/www/hotspot/frontend/src/pages/admin'
SUPER_DIR = '/var/www/hotspot/frontend/src/pages/super'

def clean_page(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    orig = content

    # Fix accidental label classes in subtitle paragraphs
    content = re.sub(
        r'<p className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">([^<]+)</p>',
        r'<p className="text-xs text-slate-500 mt-0.5">\1</p>',
        content
    )
    content = re.sub(
        r'<p className="text-slate-500 text-sm">([^<]+)</p>',
        r'<p className="text-xs text-slate-500 mt-0.5">\1</p>',
        content
    )
    content = re.sub(
        r'<p className="text-sm text-slate-500">([^<]+)</p>',
        r'<p className="text-xs text-slate-500 mt-0.5">\1</p>',
        content
    )
    content = re.sub(
        r'<p className="text-sm text-slate-400">([^<]+)</p>',
        r'<p className="text-xs text-slate-500 mt-0.5">\1</p>',
        content
    )

    # Standardize header icons
    content = re.sub(r'p-3 bg-blue-500/10 rounded-xl', 'p-2 bg-[#2563eb] rounded-xl shadow-sm text-white', content)
    content = re.sub(r'p-2 bg-blue-500/10 rounded-xl', 'p-2 bg-[#2563eb] rounded-xl shadow-sm text-white', content)
    content = re.sub(r'p-2 bg-blue-50 rounded-xl', 'p-2 bg-[#2563eb] rounded-xl shadow-sm text-white', content)

    # Standardize titles
    content = re.sub(
        r'<h1 className="text-3xl font-bold text-slate-900">',
        '<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">',
        content
    )
    content = re.sub(
        r'<h1 className="text-2xl font-bold text-slate-900">',
        '<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">',
        content
    )

    # Card containers: fix double border classes like "border border-slate-200 border border-..."
    content = re.sub(r'border border-slate-200 border border-[a-z]+-[0-9]+/[0-9]+', 'border border-slate-200 shadow-sm rounded-2xl', content)
    content = re.sub(r'bg-white rounded-lg border border-slate-200', 'bg-white rounded-2xl border border-slate-200 shadow-sm', content)
    content = re.sub(r'bg-white rounded-xl border border-slate-200', 'bg-white rounded-2xl border border-slate-200 shadow-sm', content)

    # Card KPI titles
    content = re.sub(
        r'<div className="text-sm font-medium text-slate-500 mb-2">([^<]+)</div>',
        r'<div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">\1</div>',
        content
    )
    content = re.sub(
        r'<p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">([^<]+)</p>',
        r'<p className="text-xs font-bold text-slate-500 uppercase tracking-wide">\1</p>',
        content
    )
    content = re.sub(
        r'<p className="text-xs text-slate-400 uppercase tracking-wide">([^<]+)</p>',
        r'<p className="text-xs font-bold text-slate-500 uppercase tracking-wide">\1</p>',
        content
    )

    # Numbers in cards
    content = re.sub(r'text-2xl font-bold text-slate-900', 'text-3xl font-black text-slate-900', content)

    if content != orig:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ Polished: {os.path.basename(filepath)}")

def main():
    for d in [ADMIN_DIR, SUPER_DIR]:
        for fname in sorted(os.listdir(d)):
            if fname.endswith('.jsx'):
                clean_page(os.path.join(d, fname))

if __name__ == '__main__':
    main()
