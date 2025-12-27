#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import inquirer from "inquirer";

/* ---------- helpers ---------- */
const toPkgName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

/* ---------- project name ---------- */
const rawName = process.argv[2];

if (!rawName) {
  console.error("❌ Please provide a project name");
  process.exit(1);
}

const projectName = rawName;
const projectDir = path.resolve(process.cwd(), projectName);

if (fs.existsSync(projectDir)) {
  console.error("❌ Folder already exists");
  process.exit(1);
}

/* ---------- select variant ---------- */
const { variant } = await inquirer.prompt([
  {
    type: "list",
    name: "variant",
    message: "Select a project variant:",
    choices: [
      "React (JavaScript)",
      "React + Tailwind (JavaScript)",
      "React + TypeScript",
      "React + TypeScript + Tailwind",
    ],
  },
]);

const isTS = variant.includes("TypeScript");
const isTW = variant.includes("Tailwind");
const ext = isTS ? "tsx" : "jsx";

/* ---------- create folders ---------- */
await fs.ensureDir(path.join(projectDir, "src"));
await fs.ensureDir(path.join(projectDir, "public"));
await fs.ensureDir(path.join(projectDir, ".vscode"));

/* ---------- package.json ---------- */
await fs.writeJson(
  path.join(projectDir, "package.json"),
  {
    name: toPkgName(projectName),
    private: true,
    type: "module",
    eslintConfig: { root: true },
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
      lint: "eslint .",
    },
  },
  { spaces: 2 }
);

/* ---------- index.html ---------- */
await fs.writeFile(
  path.join(projectDir, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${ext}"></script>
  </body>
</html>`
);

/* ---------- main ---------- */
await fs.writeFile(
  path.join(projectDir, `src/main.${ext}`),
  isTS
    ? `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
`
    : `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
`
);

/* ---------- App ---------- */
await fs.writeFile(
  path.join(projectDir, `src/App.${ext}`),
  `import './App.css'

function App() {
  return (
    <>
      <h1>Welcome to my project</h1>
    </>
  )
}

export default App
`
);

/* ---------- styles ---------- */
await fs.writeFile(path.join(projectDir, "src/App.css"), "");
await fs.writeFile(
  path.join(projectDir, "src/index.css"),
  isTW ? `@import "tailwindcss";` : ""
);

/* ---------- vite config ---------- */
await fs.writeFile(
  path.join(projectDir, `vite.config.${isTS ? "ts" : "js"}`),
  isTW
    ? `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
`
    : `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`
);

/* ---------- ESLint (FINAL, FORCE OVERWRITE) ---------- */
const eslintPath = path.join(projectDir, "eslint.config.js");
await fs.remove(eslintPath);

await fs.writeFile(
  eslintPath,
  `import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]' }],
    },
  },
])
`
);

/* ---------- VS Code settings ---------- */
await fs.writeFile(
  path.join(projectDir, ".vscode/settings.json"),
  `{
  "eslint.experimental.useFlatConfig": true
}`
);

/* ---------- gitignore ---------- */
await fs.writeFile(
  path.join(projectDir, ".gitignore"),
  `node_modules
dist
dist-ssr
*.local
.DS_Store
.vscode/*
!.vscode/extensions.json
`
);

/* ---------- install dependencies ---------- */
console.log("📦 Installing dependencies...");

await execa(
  "npm",
  [
    "install",
    "react",
    "react-dom",
    "vite",
    "@vitejs/plugin-react",
    "eslint",
    "@eslint/js",
    "globals",
    "eslint-plugin-react-hooks",
    "eslint-plugin-react-refresh",
    ...(isTS ? ["typescript"] : []),
    ...(isTW ? ["tailwindcss", "@tailwindcss/vite"] : []),
  ],
  { cwd: projectDir, stdio: "inherit" }
);

console.log("✅ Project ready!");
console.log(`👉 cd ${projectName}`);
console.log("👉 npm run dev");
