# SynthView AI — Frontend

Real-time, AI-assisted **adaptive mock interview platform**.
React 18 · TypeScript · Tailwind CSS 4 · Vite

## Quickstart

npm install
npm run dev      # http://localhost:5173
npm run build    # production build

## Design system

- Single source of truth: src/index.css (oklch tokens, light + dark, signal colors,
  radius scale, full animation language — ported 1:1 from the finalized landing page).
- Primitives: shadcn/ui base-nova style in src/components/ui/.
- Fonts: Inter (UI) + JetBrains Mono (data), loaded in index.html.
- Theme: dark default, class-based, localStorage key synthview-theme, no-flash script.

## Vite adaptation notes (vs. the original Next.js project)

1. next/font → Google Fonts in index.html, exposed as --font-inter / --font-jetbrains-mono.
2. 'use client' directives removed (not applicable outside Next.js).
3. usePathname → useLocation from react-router-dom.
4. @import 'shadcn/tailwind.css' removed — every token it provides is defined in index.css.
5. Theme no-flash script moved from layout.tsx into index.html.