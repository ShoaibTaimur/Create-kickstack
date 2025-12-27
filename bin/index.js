#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import inquirer from "inquirer";

/* ---------- helpers ---------- */
const toPkgName = (n) => n.toLowerCase().replace(/[^a-z0-9-]/g, "-");

/* ---------- project name ---------- */
const rawName = process.argv[2];
if (!rawName) {
  console.log("❌ Please provide a project name");
  process.exit(1);
}

const projectName = rawName;
const projectDir = path.resolve(process.cwd(), projectName);

if (fs.existsSync(projectDir)) {
  console.log("❌ Folder already exists");
  process.exit(1);
}

/* ---------- variant ---------- */
const { variant } = await inquirer.prompt([
  {
    type: "list",
    name: "variant",
    message: "Select a project variant:",
    choices: [
      "React (JavaScript)",
      "React + Tailwind (JavaScript)",
      "React + TypeScript",
      "React + TypeScript + Tailwind"
    ]
  }
]);

const isTS = variant.includes("TypeScript");
const isTW = variant.includes("Tailwind");
const ext = isTS ? "tsx" : "jsx";

/* ---------- folders ---------- */
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
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
      lint: "eslint ."
    }
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
const mainFile = isTS
  ? `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const root = document.getElementById('root')!

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
`
  : `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const root = document.getElementById('root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
`;

await fs.writeFile(path.join(projectDir, `src/main.${ext}`), mainFile);

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

/* ---------- ESLint (FINAL FIX) ---------- */
await fs.writeFile(
  path.join(projectDir, "eslint.config.js"),
  `import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import babelParser from "@babel/eslint-parser";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-react"]
        }
      },
      globals: {
        window: "readonly",
        document: "readonly"
      }
    },
    plugins: {
      react,
      "react-hooks": reactHooks
    },
    rules: {
      "react/jsx-uses-vars": "error",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error"
    },
    settings: {
      react: { version: "detect" }
    }
  }
];
`
);

/* ---------- VS Code ---------- */
await fs.writeFile(
  path.join(projectDir, ".vscode/extensions.json"),
  `{
  "recommendations": ["dbaeumer.vscode-eslint"]
}`
);

/* ---------- README ---------- */
await fs.writeFile(
  path.join(projectDir, "README.md"),
  `# ${projectName}

Created with **create-kickstack**.

\`\`\`bash
npm install
npm run dev
\`\`\`
`
);

/* ---------- install deps ---------- */
console.log("📦 Installing dependencies...");

const deps = ["react", "react-dom", "vite", "@vitejs/plugin-react"];
const devDeps = [
  "eslint",
  "eslint-plugin-react",
  "eslint-plugin-react-hooks",
  "@babel/eslint-parser",
  "@babel/preset-react",
  ...(isTS ? ["typescript"] : []),
  ...(isTW ? ["tailwindcss", "@tailwindcss/vite"] : [])
];

await execa("npm", ["install", ...deps, "-D", ...devDeps], {
  cwd: projectDir,
  stdio: "inherit"
});

console.log("✅ Project ready!");
console.log(`👉 cd ${projectName}`);
console.log("👉 npm run dev");
