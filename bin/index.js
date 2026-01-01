#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import inquirer from "inquirer";

/* ---------- helpers ---------- */
const run = (command, args, options = {}) =>
  execa(command, args, { stdio: "inherit", ...options });

const log = (message) => console.log(message);

const startSpinner = (text) => {
  if (!process.stdout.isTTY) {
    log(text);
    return (success = true) => {
      if (!success) log("Failed.");
    };
  }

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  process.stdout.write(`${frames[0]} ${text}`);
  const timer = setInterval(() => {
    i = (i + 1) % frames.length;
    process.stdout.write(`\r${frames[i]} ${text}`);
  }, 80);

  return (success = true) => {
    clearInterval(timer);
    const mark = success ? "✔" : "✖";
    process.stdout.write(`\r${mark} ${text}\n`);
  };
};

const withSpinner = async (text, fn) => {
  const stop = startSpinner(text);
  try {
    const result = await fn();
    stop(true);
    return result;
  } catch (err) {
    stop(false);
    throw err;
  }
};

const printBanner = () => {
  console.log("");
  console.log(" _  ___ _      _    ____ _____  _    ____ _  __");
  console.log("| |/ (_) | ___| | _/ ___|_   _|/ \\  / ___| |/ /");
  console.log("| ' /| | |/ __| |/ \\___ \\ | | / _ \\| |   | ' / ");
  console.log("| . \\| | | (__|   < ___) || |/ ___ \\ |___| . \\ ");
  console.log("|_|\\_\\_|_|\\___|_|\\_\\____/ |_/_/   \\_\\____|_|\\_\\");
  console.log("");
  console.log("kickstack");
  console.log("Clean React + Vite starter — no demo clutter.");
  console.log("By Shoaib Taimur");
  console.log("");
};

const overwriteIfExists = async (filePath, contents, projectDir) => {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    const rel = path.relative(projectDir, filePath);
    console.warn(`⚠️  Skipping missing file: ${rel}`);
    return;
  }
  await fs.writeFile(filePath, contents);
};

const updateIndexTitle = async (filePath, title, projectDir) => {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    const rel = path.relative(projectDir, filePath);
    console.warn(`⚠️  Skipping missing file: ${rel}`);
    return;
  }

  const html = await fs.readFile(filePath, "utf8");
  const updated = html.replace(/<title>.*<\/title>/, `<title>${title}</title>`);
  await fs.writeFile(filePath, updated);
};

const addTailwindToViteConfig = async (filePath, projectDir) => {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    const rel = path.relative(projectDir, filePath);
    console.warn(`⚠️  Skipping missing file: ${rel}`);
    return;
  }

  let contents = await fs.readFile(filePath, "utf8");
  if (contents.includes("@tailwindcss/vite")) {
    return;
  }

  const hasReactImport = contents.match(
    /import\s+react\s+from\s+['"]@vitejs\/plugin-react['"]/
  );
  if (hasReactImport) {
    contents = contents.replace(
      /import\s+react\s+from\s+['"]@vitejs\/plugin-react['"]\s*\n/,
      (match) => `${match}import tailwindcss from '@tailwindcss/vite'\n`
    );
  } else {
    console.warn("⚠️  Could not find react plugin import to attach Tailwind.");
    return;
  }

  const withPlugin = contents.replace(
    /plugins:\s*\[\s*react\(\)\s*\]/,
    "plugins: [react(), tailwindcss()]"
  );

  if (withPlugin === contents) {
    console.warn("⚠️  Could not find plugins array to attach Tailwind.");
    return;
  }

  await fs.writeFile(filePath, withPlugin);
};

/* ---------- project name ---------- */
const rawName = process.argv[2];

if (!rawName) {
  console.error("❌ Please provide a project name");
  process.exit(1);
}

printBanner();

const projectName = rawName;
const projectDir = path.resolve(process.cwd(), projectName);

if (await fs.pathExists(projectDir)) {
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

const { useRouter } = await inquirer.prompt([
  {
    type: "list",
    name: "useRouter",
    message: "Include React Router (data router)?",
    choices: [
      { name: "Yes — add React Router (data router)", value: true },
      { name: "No", value: false },
    ],
    default: false,
  },
]);

const isTS = variant.includes("TypeScript");
const isTW = variant.includes("Tailwind");
const isRR = useRouter === true;
const ext = isTS ? "tsx" : "jsx";
const template = isTS ? "react-ts" : "react";

/* ---------- scaffold via Vite ---------- */
log(`📍 Using local create-kickstack from ${path.resolve(process.cwd())}`);
log(`🧩 Variant: ${variant}`);
log("🚀 Scaffolding with Vite...");
await run(
  "npm",
  [
    "create",
    "vite@latest",
    projectName,
    "--",
    "--template",
    template,
    "--no-interactive",
    "--no-rolldown",
  ],
  {
    env: { ...process.env, CI: "1" },
  }
);

/* ---------- clean up demo content ---------- */
await withSpinner("Cleaning Vite demo files", async () => {
  await updateIndexTitle(
    path.join(projectDir, "index.html"),
    projectName,
    projectDir
  );

  await fs.remove(path.join(projectDir, "src/assets"));
  await fs.remove(path.join(projectDir, "public/vite.svg"));

  await overwriteIfExists(
    path.join(projectDir, `src/main.${ext}`),
    isRR
      ? `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import App from './App'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
])

createRoot(document.getElementById('root')${isTS ? "!" : ""}).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
`
      : `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')${isTS ? "!" : ""}).render(
  <StrictMode>
    <App />
  </StrictMode>
)
`,
    projectDir
  );

  await overwriteIfExists(
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
`,
    projectDir
  );

  await overwriteIfExists(path.join(projectDir, "src/App.css"), "", projectDir);
  await overwriteIfExists(
    path.join(projectDir, "src/index.css"),
    isTW ? `@import "tailwindcss";` : "",
    projectDir
  );

  const appPath = path.join(projectDir, `src/App.${ext}`);
  const cssPath = path.join(projectDir, "src/index.css");
  const appContents = await fs.readFile(appPath, "utf8");
  const cssContents = await fs.readFile(cssPath, "utf8");

  if (appContents.includes("Vite + React") || appContents.includes("logo")) {
    throw new Error(
      "Demo cleanup failed: App still contains Vite demo content."
    );
  }

  if (isTW && !cssContents.includes("@import \"tailwindcss\"")) {
    throw new Error("Tailwind setup failed: index.css was not updated.");
  }
});

/* ---------- Vite config ---------- */
const viteConfigPath = path.join(
  projectDir,
  `vite.config.${isTS ? "ts" : "js"}`
);

if (isTW) {
  await addTailwindToViteConfig(viteConfigPath, projectDir);
}

/* ---------- install dependencies ---------- */
console.log("📦 Installing dependencies...");
await run("npm", ["install"], { cwd: projectDir });

if (isRR) {
  await run("npm", ["install", "react-router"], { cwd: projectDir });
}

await run(
  "npm",
  [
    "install",
    "-D",
    ...(isTW ? ["tailwindcss", "@tailwindcss/vite"] : []),
  ],
  { cwd: projectDir }
);

/* ---------- optional dev server ---------- */
const { runDevChoice } = await inquirer.prompt([
  {
    type: "list",
    name: "runDevChoice",
    message: "Start the dev server now?",
    choices: ["Yes", "No"],
    default: "No",
  },
]);

if (runDevChoice === "Yes") {
  await run("npm", ["run", "dev"], { cwd: projectDir });
}

/* ---------- finalize ---------- */
console.log("✅ Project ready!");
console.log(`👉 cd ${projectName}`);
console.log("👉 npm run dev");
