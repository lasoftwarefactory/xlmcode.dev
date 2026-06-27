import JSZip from 'jszip'
import type { FileTree } from '../../shared/types'

/**
 * Turns the in-preview file tree (classic-bundler layout: app code at the root,
 * e.g. /App.tsx) into a COMPLETE, real Vite + React + TS project that runs
 * locally with `pnpm install && pnpm dev`. Tailwind is loaded via its CDN in
 * index.html (works locally with zero build config).
 *
 * App files move under /src so the layout matches a standard Vite project; the
 * preview's cosmetic package.json/README are replaced by the real scaffold.
 */

const SCAFFOLD: FileTree = {
  '/index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Stellar App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  '/src/main.tsx': `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,
  '/src/index.css': `:root {
  font-family: system-ui, -apple-system, sans-serif;
}
`,
  '/vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
`,
  '/package.json': `{
  "name": "stellar-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "typescript": "~6.0.0",
    "vite": "^8.1.0"
  }
}
`,
  '/tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
`,
  '/.gitignore': `node_modules
dist
*.local
.DS_Store
`,
  '/README.md': `# Stellar App

Generated with Stellable. A real Vite + React + TypeScript + TailwindCSS project.

## Run locally

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

Tailwind is loaded via CDN in \`index.html\` — no build config needed.
`,
}

/** Files from the preview tree that the export replaces with the real scaffold. */
const REPLACED = new Set(['/package.json', '/README.md', '/index.html'])

/** Build the complete exportable Vite project tree. Pure. */
export function buildExportTree(fileTree: FileTree): FileTree {
  const out: FileTree = { ...SCAFFOLD }
  for (const [path, content] of Object.entries(fileTree)) {
    if (REPLACED.has(path)) continue
    const rel = path.replace(/^\/+/, '')
    const dest = rel.startsWith('src/') ? `/${rel}` : `/src/${rel}`
    out[dest] = content
  }
  return out
}

/** Zip the exported project and trigger a browser download. */
export async function downloadProjectZip(
  name: string,
  fileTree: FileTree,
): Promise<void> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(buildExportTree(fileTree))) {
    zip.file(path.replace(/^\/+/, ''), content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name || 'stellar-app'}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
