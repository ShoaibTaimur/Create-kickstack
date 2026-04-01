#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import inquirer from "inquirer";
import semver from "semver";

/* ---------- helpers ---------- */
const run = (command, args, options = {}) =>
  execa(command, args, { stdio: "inherit", ...options });

const runQuiet = async (command, args, options = {}) => {
  try {
    return await execa(command, args, { stdio: "pipe", ...options });
  } catch (err) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    throw err;
  }
};

const getNpmViewJson = async (packageSpec, field) => {
  const { stdout } = await runQuiet("npm", [
    "view",
    packageSpec,
    field,
    "--json",
  ]);

  if (!stdout || stdout.trim() === "" || stdout.trim() === "undefined") {
    return null;
  }

  return JSON.parse(stdout);
};

const getNpmViewString = async (packageSpec, field) => {
  const { stdout } = await runQuiet("npm", [ "view", packageSpec, field ]);
  return stdout.trim();
};

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

  const reactPluginImport = contents.match(
    /import\s+react\s+from\s+['"]@vitejs\/plugin-react(?:-swc)?['"]/
  );
  if (reactPluginImport) {
    contents = contents.replace(
      /import\s+react\s+from\s+['"]@vitejs\/plugin-react(?:-swc)?['"]\s*\n/,
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

const ensureTsconfigAlias = async (projectDir) => {
  const targets = ["tsconfig.json", "tsconfig.app.json"];

  for (const filename of targets) {
    const tsconfigPath = path.join(projectDir, filename);
    const exists = await fs.pathExists(tsconfigPath);

    if (!exists) {
      continue;
    }

    const rawTsconfig = await fs.readFile(tsconfigPath, "utf8");
    const tsconfig = JSON.parse(
      rawTsconfig
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
    );
    tsconfig.compilerOptions = tsconfig.compilerOptions ?? {};
    tsconfig.compilerOptions.baseUrl = tsconfig.compilerOptions.baseUrl ?? ".";
    tsconfig.compilerOptions.paths = {
      ...(tsconfig.compilerOptions.paths ?? {}),
      "@/*": ["./src/*"],
    };
    await fs.writeJson(tsconfigPath, tsconfig, { spaces: 2 });
  }
};

const ensureViteAlias = async (filePath, projectDir) => {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    const rel = path.relative(projectDir, filePath);
    console.warn(`⚠️  Skipping missing file: ${rel}`);
    return;
  }

  let contents = await fs.readFile(filePath, "utf8");
  if (contents.includes('"@": path.resolve(__dirname, "./src")')) {
    return;
  }

  if (!contents.includes('import path from "path"') && !contents.includes("import path from 'path'")) {
    contents = `import path from "path"\n${contents}`;
  }

  if (contents.includes("resolve:")) {
    if (contents.includes("alias:")) {
      contents = contents.replace(
        /alias:\s*\{/,
        `alias: {\n      "@": path.resolve(__dirname, "./src"),`
      );
    } else {
      contents = contents.replace(
        /resolve:\s*\{/,
        `resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },`
      );
    }
  } else {
    contents = contents.replace(
      /export\s+default\s+defineConfig\(\{/,
      `export default defineConfig({\n  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },`
    );
  }

  await fs.writeFile(filePath, contents);
};

const writeDaisyConfig = async (projectDir) => {
  const configPath = path.join(projectDir, "tailwind.config.cjs");
  const contents = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  plugins: [require("daisyui")],
}
`;
  await fs.writeFile(configPath, contents);
};

const getServerIndexContents = () => `const express = require("express")
const cors = require("cors")
const dotenv = require("dotenv")
const { MongoClient, ServerApiVersion } = require("mongodb")

dotenv.config()

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const uri = process.env.MONGODB_URI

let client = null

if (uri) {
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  })
}

app.get("/", (_req, res) => {
  res.send("Server is running")
})

app.listen(port, () => {
  console.log(\`Server is running on port \${port}\`)
})
`;

const setupServerProject = async (projectDir) => {
  await fs.ensureDir(projectDir);

  await runQuiet("npm", ["init", "-y"], { cwd: projectDir });

  const packageJsonPath = path.join(projectDir, "package.json");
  const packageJson = await fs.readJson(packageJsonPath);
  packageJson.scripts = {
    start: "node index.js",
    test: 'echo "Error: no test specified" && exit 1',
  };
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

  await fs.writeFile(path.join(projectDir, "index.js"), getServerIndexContents());

  await installPackagesWithCompatibilityRetry(
    projectDir,
    ["express", "cors", "mongodb", "dotenv"],
    { label: "Server dependency setup" }
  );
};

const getCleanAppContents = ({ useAppCss }) =>
  useAppCss
    ? `import './App.css'

function App() {
  return (
    <div>
      <p>Welcome to the project</p>
    </div>
  )
}

export default App
`
    : `function App() {
  return (
    <div>
      <p>Welcome to the project</p>
    </div>
  )
}

export default App
`;

const getWrapperDefinitions = ({ hasTanstackQuery, useShadcn, hasFirebase }) => {
  const wrappers = [];

  if (hasTanstackQuery) {
    wrappers.push({
      importLines: [
        "import {",
        "  QueryClient,",
        "  QueryClientProvider,",
        "} from '@tanstack/react-query'",
      ],
      setupLines: [
        "",
        "const queryClient = new QueryClient()",
      ],
      openTag: "<QueryClientProvider client={queryClient}>",
      closeTag: "</QueryClientProvider>",
    });
  }

  if (useShadcn) {
    wrappers.push({
      importLines: ["import { ThemeProvider } from './components/theme-provider'"],
      setupLines: [],
      openTag: "<ThemeProvider>",
      closeTag: "</ThemeProvider>",
    });
  }

  if (hasFirebase) {
    wrappers.push({
      importLines: ["import AuthProvider from './Context/AuthProvider'"],
      setupLines: [],
      openTag: "<AuthProvider>",
      closeTag: "</AuthProvider>",
    });
  }

  return wrappers;
};

const getCleanMainContents = ({
  isTS,
  isRR,
  hasFirebase,
  useShadcn,
  hasTanstackQuery,
}) => {
  const lines = [
    "import { StrictMode } from 'react'",
    "import { createRoot } from 'react-dom/client'",
  ];

  if (isRR) {
    lines.push("import { createBrowserRouter, RouterProvider } from 'react-router'");
  }

  lines.push("import './index.css'");
  lines.push("import App from './App'");

  const wrappers = getWrapperDefinitions({
    hasTanstackQuery,
    useShadcn,
    hasFirebase,
  });

  wrappers.forEach(({ importLines }) => {
    lines.push(...importLines);
  });

  const body = [];

  if (isRR) {
    body.push("");
    body.push("const router = createBrowserRouter([");
    body.push("  { path: '/', element: <App /> },");
    body.push("])");
  }

  wrappers.forEach(({ setupLines }) => {
    body.push(...setupLines);
  });

  body.push("");
  body.push(`createRoot(document.getElementById('root')${isTS ? "!" : ""}).render(`);
  body.push("  <StrictMode>");

  wrappers.forEach(({ openTag }, index) => {
    body.push(`${"  ".repeat(index + 2)}${openTag}`);
  });

  const renderLine = isRR ? "<RouterProvider router={router} />" : "<App />";
  body.push(`${"  ".repeat(wrappers.length + 2)}${renderLine}`);

  [...wrappers].reverse().forEach(({ closeTag }, index) => {
    body.push(`${"  ".repeat(wrappers.length - index + 1)}${closeTag}`);
  });

  body.push("  </StrictMode>");
  body.push(")");

  return [...lines, ...body, ""].join("\n");
};

const getShadcnThemeProviderContents = () => `/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type Theme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const THEME_VALUES: Theme[] = ["dark", "light"]

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isTheme(value: string | null): value is Theme {
  if (value === null) {
    return false
  }

  return THEME_VALUES.includes(value as Theme)
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "theme",
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey)
    if (isTheme(storedTheme)) {
      return storedTheme
    }

    return defaultTheme
  })

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme)
      setThemeState(nextTheme)
    },
    [storageKey]
  )

  const applyTheme = React.useCallback(
    (nextTheme: Theme) => {
      const root = document.documentElement
      const restoreTransitions = disableTransitionOnChange
        ? disableTransitionsTemporarily()
        : null

      root.classList.remove("light", "dark")
      root.classList.add(nextTheme)

      if (restoreTransitions) {
        restoreTransitions()
      }
    },
    [disableTransitionOnChange]
  )

  React.useEffect(() => {
    applyTheme(theme)
  }, [theme, applyTheme])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return
      }

      if (event.key !== storageKey) {
        return
      }

      if (isTheme(event.newValue)) {
        setThemeState(event.newValue)
        return
      }

      setThemeState(defaultTheme)
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultTheme, storageKey])

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
`;

const writeShadcnThemeProvider = async (projectDir) => {
  const componentDir = path.join(projectDir, "src/components");
  await fs.ensureDir(componentDir);
  await fs.writeFile(
    path.join(componentDir, "theme-provider.tsx"),
    getShadcnThemeProviderContents()
  );
};

const removeShadcnDemoArtifacts = async (projectDir) => {
  await fs.remove(path.join(projectDir, "src/components/ui"));
  await fs.remove(path.join(projectDir, "public/favicon.svg"));
  await fs.remove(path.join(projectDir, "public/icons.svg"));
};

const applyCleanCanvasFiles = async (
  projectDir,
  { isTS, isRR, hasFirebase, useShadcn, useAppCss, hasTanstackQuery }
) => {
  const ext = isTS ? "tsx" : "jsx";

  await overwriteIfExists(
    path.join(projectDir, `src/main.${ext}`),
    getCleanMainContents({
      isTS,
      isRR,
      hasFirebase,
      useShadcn,
      hasTanstackQuery,
    }),
    projectDir
  );

  await overwriteIfExists(
    path.join(projectDir, `src/App.${ext}`),
    getCleanAppContents({ useAppCss }),
    projectDir
  );

  if (useShadcn) {
    await removeShadcnDemoArtifacts(projectDir);
  }

  if (useAppCss) {
    await overwriteIfExists(path.join(projectDir, "src/App.css"), "", projectDir);
  } else {
    await fs.remove(path.join(projectDir, "src/App.css"));
  }
};

const initializeShadcnWithRetry = async (projectDir) => {
  const args = [
    "shadcn@latest",
    "init",
    "-t",
    "vite",
    "-d",
    "--cwd",
    projectDir,
  ];

  try {
    await runQuiet("npx", args);
    return;
  } catch (err) {
    if (!isResolveError(err)) {
      throw err;
    }
  }

  console.log(
    "⚠️  shadcn/ui hit an npm dependency conflict while applying its official Vite setup."
  );
  console.log(
    "🧹 kickstack is repairing the generated project dependencies and retrying shadcn/ui initialization."
  );

  await cleanupInstallArtifacts(projectDir);
  const resolutionLogs = await resolveManifestPackageVersions(projectDir);
  resolutionLogs.forEach((line) => console.log(line));
  await runQuiet("npm", ["install"], { cwd: projectDir });
  await runQuiet("npx", args);
};

const writeFirebaseAuthScaffold = async (projectDir, { isTS }) => {
  const ext = isTS ? "tsx" : "jsx";
  const contextDir = path.join(projectDir, "src/Context");

  await fs.ensureDir(contextDir);

  await fs.writeFile(
    path.join(contextDir, `AuthContext.${ext}`),
    isTS
      ? `import { createContext } from 'react'

export const AuthContext = createContext<Record<string, never> | null>(null)
`
      : `import { createContext } from 'react'

export const AuthContext = createContext(null)
`
  );

  await fs.writeFile(
    path.join(contextDir, `AuthProvider.${ext}`),
    isTS
      ? `import type { ReactNode } from 'react'
import { AuthContext } from './AuthContext'

type AuthProviderProps = {
  children: ReactNode
}

function AuthProvider({ children }: AuthProviderProps) {
  const userInfo = {}

  return (
    <AuthContext value={userInfo}>
      {children}
    </AuthContext>
  )
}

export default AuthProvider
`
      : `import { AuthContext } from './AuthContext'

function AuthProvider({ children }) {
  const userInfo = {}

  return (
    <AuthContext value={userInfo}>
      {children}
    </AuthContext>
  )
}

export default AuthProvider
`
  );
};

const getVersionMajor = (value) => {
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

const toSavedRange = (version) => `^${version}`;

const getSupportedMajorsFromRange = (range) => {
  if (!range) return [];

  return [...new Set(
    [...String(range).matchAll(/(?:\^|~|>=|>|<=|<)?\s*(\d+)/g)]
      .map((match) => Number(match[1]))
      .filter((major) => Number.isInteger(major))
  )].sort((a, b) => b - a);
};

const rangeSupportsMajor = (range, major) =>
  getSupportedMajorsFromRange(range).includes(major);

const getLatestCompatiblePackageMajor = async (
  packageName,
  peerName,
  targetMajor
) => {
  const versions = await getNpmViewJson(packageName, "versions");
  const majors = [...new Set(
    versions
      .map((version) => getVersionMajor(version))
      .filter((major) => Number.isInteger(major))
  )].sort((a, b) => b - a);

  for (const major of majors) {
    try {
      const peerDependencies = await getNpmViewJson(
        `${packageName}@${major}`,
        "peerDependencies"
      );

      if (rangeSupportsMajor(peerDependencies?.[peerName], targetMajor)) {
        return major;
      }
    } catch {
      continue;
    }
  }

  return null;
};

const isOptionalPeer = (peerDependenciesMeta, peerName) =>
  peerDependenciesMeta?.[peerName]?.optional === true;

const hasCompatiblePeerSet = (
  peerDependencies = {},
  peerDependenciesMeta = {},
  availablePackages = {}
) =>
  Object.entries(peerDependencies).every(([peerName, peerRange]) => {
    const availableRange = availablePackages[peerName];

    if (!availableRange) {
      return isOptionalPeer(peerDependenciesMeta, peerName);
    }

    return semver.intersects(availableRange, peerRange, {
      includePrerelease: true,
    });
  });

const getLatestCompatiblePackageVersion = async (
  packageName,
  availablePackages
) => {
  const versions = await getNpmViewJson(packageName, "versions");
  const stableVersions = versions.filter((version) => semver.valid(version));

  for (const version of stableVersions.sort(semver.rcompare)) {
    try {
      const peerDependencies = await getNpmViewJson(
        `${packageName}@${version}`,
        "peerDependencies"
      );
      const peerDependenciesMeta = await getNpmViewJson(
        `${packageName}@${version}`,
        "peerDependenciesMeta"
      ).catch(() => ({}));

      if (
        hasCompatiblePeerSet(
          peerDependencies,
          peerDependenciesMeta,
          availablePackages
        )
      ) {
        return version;
      }
    } catch {
      continue;
    }
  }

  return null;
};

const cleanupInstallArtifacts = async (projectDir) => {
  await fs.remove(path.join(projectDir, "node_modules"));
  await fs.remove(path.join(projectDir, "package-lock.json"));
};

const isResolveError = (err) =>
  err?.stderr?.includes("ERESOLVE") || err?.stdout?.includes("ERESOLVE");

const getProjectPackageMap = (packageJson) => ({
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
});

const installPackageSpecs = async (projectDir, packageSpecs, { dev = false } = {}) => {
  const args = ["install"];

  if (dev) {
    args.push("-D");
  }

  args.push(...packageSpecs);

  await runQuiet("npm", args, { cwd: projectDir });
};

const resolveRequestedPackageSpecs = async (
  projectDir,
  packageNames,
  { dev = false } = {}
) => {
  const packageJsonPath = path.join(projectDir, "package.json");
  const packageJson = await fs.readJson(packageJsonPath);
  const availablePackages = getProjectPackageMap(packageJson);
  const resolvedSpecs = [];
  const resolutionLogs = [];

  for (const packageName of packageNames) {
    const latestVersion = await getNpmViewString(`${packageName}@latest`, "version");
    const compatibleVersion = await getLatestCompatiblePackageVersion(
      packageName,
      availablePackages
    );

    if (!compatibleVersion) {
      throw new Error(
        `Could not find a compatible version for ${packageName} with the current project dependencies.`
      );
    }

    availablePackages[packageName] = toSavedRange(compatibleVersion);
    resolvedSpecs.push(`${packageName}@${compatibleVersion}`);

    if (compatibleVersion !== latestVersion) {
      resolutionLogs.push(
        `- ${packageName}: latest is ${latestVersion}, using ${compatibleVersion} because of peer dependency compatibility.`
      );
    }
  }

  const targetKey = dev ? "devDependencies" : "dependencies";
  packageJson[targetKey] = packageJson[targetKey] ?? {};

  resolvedSpecs.forEach((spec) => {
    const atIndex = spec.lastIndexOf("@");
    const packageName = spec.slice(0, atIndex);
    const version = spec.slice(atIndex + 1);
    packageJson[targetKey][packageName] = toSavedRange(version);
  });

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

  return { resolvedSpecs, resolutionLogs };
};

const resolveManifestPackageVersions = async (projectDir) => {
  const packageJsonPath = path.join(projectDir, "package.json");
  const packageJson = await fs.readJson(packageJsonPath);
  const availablePackages = getProjectPackageMap(packageJson);
  const resolutionLogs = [];

  for (const sectionName of ["dependencies", "devDependencies"]) {
    const section = packageJson[sectionName];

    if (!section) {
      continue;
    }

    for (const [packageName, currentRange] of Object.entries(section)) {
      const compatibleVersion = await getLatestCompatiblePackageVersion(
        packageName,
        availablePackages
      );

      if (!compatibleVersion) {
        throw new Error(
          `Could not find a compatible version for ${packageName} while repairing the generated project dependencies.`
        );
      }

      const compatibleRange = toSavedRange(compatibleVersion);
      availablePackages[packageName] = compatibleRange;
      section[packageName] = compatibleRange;

      if (currentRange !== compatibleRange) {
        resolutionLogs.push(
          `- ${packageName}: changed ${currentRange} -> ${compatibleRange} to satisfy peer dependencies.`
        );
      }
    }
  }

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

  return resolutionLogs;
};

const installProjectDependenciesWithCompatibilityRetry = async (projectDir) => {
  try {
    await runQuiet("npm", ["install"], { cwd: projectDir });
    return;
  } catch (err) {
    if (!isResolveError(err)) {
      throw err;
    }
  }

  console.log(
    "⚠️  The generated project hit an npm dependency conflict during the initial install."
  );
  console.log(
    "🧹 kickstack removed the partial install and is resolving the latest compatible versions from the generated manifest."
  );

  await cleanupInstallArtifacts(projectDir);

  const resolutionLogs = await resolveManifestPackageVersions(projectDir);

  if (resolutionLogs.length) {
    resolutionLogs.forEach((line) => console.log(line));
  } else {
    console.log(
      "ℹ️  No manifest version changes were needed. Retrying the install after cleanup."
    );
  }

  await runQuiet("npm", ["install"], { cwd: projectDir });
};

const installPackagesWithCompatibilityRetry = async (
  projectDir,
  packageNames,
  { dev = false, label } = {}
) => {
  try {
    await installPackageSpecs(projectDir, packageNames, { dev });
    return;
  } catch (err) {
    if (!isResolveError(err)) {
      throw err;
    }
  }

  console.log(
    `⚠️  ${label} hit an npm dependency conflict while installing the latest package versions.`
  );
  console.log(
    "🧹 kickstack removed the partial install and is resolving the latest compatible versions for your current project."
  );

  await cleanupInstallArtifacts(projectDir);

  const { resolvedSpecs, resolutionLogs } = await resolveRequestedPackageSpecs(
    projectDir,
    packageNames,
    { dev }
  );

  if (resolutionLogs.length) {
    resolutionLogs.forEach((line) => console.log(line));
  } else {
    console.log(
      "ℹ️  The conflict was caused by peer resolution timing. Retrying with explicit compatible package specs."
    );
  }

  await installPackageSpecs(projectDir, resolvedSpecs, { dev });
};

const alignTailwindViteCompatibility = async (projectDir) => {
  const packageJsonPath = path.join(projectDir, "package.json");
  const packageJson = await fs.readJson(packageJsonPath);
  const viteRange = packageJson.devDependencies?.vite;
  const currentViteMajor = getVersionMajor(viteRange);

  if (!currentViteMajor) {
    return;
  }

  const tailwindPeerDependencies = await getNpmViewJson(
    "@tailwindcss/vite@latest",
    "peerDependencies"
  );
  const supportedViteMajors = getSupportedMajorsFromRange(
    tailwindPeerDependencies?.vite
  );

  if (!supportedViteMajors.length || supportedViteMajors.includes(currentViteMajor)) {
    return;
  }

  const targetViteMajor = supportedViteMajors[0];
  const reactPluginPackage = packageJson.devDependencies?.["@vitejs/plugin-react-swc"]
    ? "@vitejs/plugin-react-swc"
    : "@vitejs/plugin-react";
  const resolvedPluginVersion = await getLatestCompatiblePackageVersion(
    reactPluginPackage,
    {
      ...getProjectPackageMap(packageJson),
      vite: `^${targetViteMajor}.0.0`,
    }
  );

  if (!resolvedPluginVersion) {
    throw new Error(
      `Could not find a ${reactPluginPackage} release compatible with Vite ${targetViteMajor}.`
    );
  }

  packageJson.devDependencies.vite = `^${targetViteMajor}.0.0`;
  packageJson.devDependencies[reactPluginPackage] =
    toSavedRange(resolvedPluginVersion);

  console.log(
    `⚠️  Tailwind compatibility issue detected: the latest Vite template uses vite@${currentViteMajor}, but @tailwindcss/vite currently supports Vite ${supportedViteMajors.map((major) => `${major}`).join(", ")}.`
  );
  console.log(
    `🔧 kickstack fixed this automatically by switching the generated project to vite@^${targetViteMajor}.0.0 and ${reactPluginPackage}@${toSavedRange(resolvedPluginVersion)} before installing dependencies.`
  );

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  await fs.remove(path.join(projectDir, "package-lock.json"));
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

const { projectType } = await inquirer.prompt([
  {
    type: "list",
    name: "projectType",
    message: "Choose a project type:",
    choices: [
      { name: "Client-side", value: "client" },
      { name: "Server-side", value: "server" },
    ],
    default: "client",
  },
]);

if (projectType === "server") {
  log(`📍 Using local kickstack from ${path.resolve(process.cwd())}`);
  log("🧩 Template: Server-side");

  await withSpinner("Scaffolding Node server project", async () => {
    await setupServerProject(projectDir);
  });

  const { runServerChoice } = await inquirer.prompt([
    {
      type: "list",
      name: "runServerChoice",
      message: "Start the server now?",
      choices: ["Yes", "No"],
      default: "No",
    },
  ]);

  if (runServerChoice === "Yes") {
    await run("npm", ["start"], { cwd: projectDir });
  }

  console.log("✅ Project ready!");
  console.log(`👉 cd ${projectName}`);
  console.log("👉 npm start");
} else {
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

const { uiLibrary } = await inquirer.prompt([
  {
    type: "list",
    name: "uiLibrary",
    message: "Include a UI library?",
    choices: [
      { name: "None", value: "none" },
      { name: "DaisyUI", value: "daisyui" },
      {
        name: "shadcn/ui (TypeScript only)",
        value: "shadcn",
        disabled: !variant.includes("TypeScript") && "Requires a TypeScript project",
      },
    ],
    default: "none",
  },
]);

const { useFirebase } = await inquirer.prompt([
  {
    type: "list",
    name: "useFirebase",
    message: "Include Firebase auth scaffolding?",
    choices: [
      { name: "Yes — install firebase and scaffold auth context/provider", value: true },
      { name: "No", value: false },
    ],
    default: false,
  },
]);

const { useTanstackQuery } = await inquirer.prompt([
  {
    type: "list",
    name: "useTanstackQuery",
    message: "Include TanStack Query?",
    choices: [
      {
        name: "Yes — install @tanstack/react-query and scaffold QueryClientProvider",
        value: true,
      },
      { name: "No", value: false },
    ],
    default: false,
  },
]);

const isTS = variant.includes("TypeScript");
const isTW = variant.includes("Tailwind");
const isRR = useRouter === true;
const isDaisy = uiLibrary === "daisyui";
const isShadcn = uiLibrary === "shadcn";
const hasFirebase = useFirebase === true;
const hasTanstackQuery = useTanstackQuery === true;
const ext = isTS ? "tsx" : "jsx";
const template = isTS ? "react-ts" : "react";

if (isShadcn && !isTS) {
  console.error("❌ shadcn/ui setup is only available for TypeScript projects");
  process.exit(1);
}

if (isShadcn && isTW) {
  console.log(
    "ℹ️  TypeScript + Tailwind was selected with shadcn/ui. kickstack will treat the Tailwind variant as a compatibility no-op because shadcn/ui applies its own Tailwind setup."
  );
}

/* ---------- scaffold via Vite ---------- */
log(`📍 Using local kickstack from ${path.resolve(process.cwd())}`);
log(`🧩 Variant: ${variant}`);
await withSpinner("Scaffolding with Vite", async () => {
  await runQuiet(
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
});

/* ---------- clean up demo content ---------- */
await withSpinner("Cleaning Vite demo files", async () => {
  await updateIndexTitle(
    path.join(projectDir, "index.html"),
    projectName,
    projectDir
  );

  await fs.remove(path.join(projectDir, "src/assets"));
  await fs.remove(path.join(projectDir, "public/vite.svg"));

  await applyCleanCanvasFiles(projectDir, {
    isTS,
    isRR,
    hasFirebase: false,
    useShadcn: false,
    useAppCss: true,
    hasTanstackQuery: false,
  });

  await overwriteIfExists(
    path.join(projectDir, "src/index.css"),
    isShadcn
      ? `@import "tailwindcss";`
      : isDaisy
      ? `@import "tailwindcss";
@plugin "daisyui";
`
      : isTW
        ? `@import "tailwindcss";`
        : "",
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

  if ((isTW || isDaisy || isShadcn) && !cssContents.includes("@import \"tailwindcss\"")) {
    throw new Error("Tailwind setup failed: index.css was not updated.");
  }

  if (isDaisy && !cssContents.includes("@plugin \"daisyui\"")) {
    throw new Error("DaisyUI setup failed: index.css was not updated.");
  }
});

/* ---------- Vite config ---------- */
const viteConfigPath = path.join(
  projectDir,
  `vite.config.${isTS ? "ts" : "js"}`
);

if ((isTW || isDaisy) && !isShadcn) {
  await addTailwindToViteConfig(viteConfigPath, projectDir);

  await withSpinner("Resolving Tailwind-compatible Vite versions", async () => {
    await alignTailwindViteCompatibility(projectDir);
  });
}

if (isShadcn) {
  await addTailwindToViteConfig(viteConfigPath, projectDir);
  await ensureViteAlias(viteConfigPath, projectDir);
  await ensureTsconfigAlias(projectDir);
}

/* ---------- install dependencies ---------- */
await withSpinner("Installing dependencies", async () => {
  await installProjectDependenciesWithCompatibilityRetry(projectDir);
});

if (isRR) {
  await withSpinner("Setting up React Router", async () => {
    await installPackagesWithCompatibilityRetry(
      projectDir,
      ["react-router"],
      { label: "React Router setup" }
    );
  });
}

if (hasTanstackQuery) {
  await withSpinner("Setting up TanStack Query", async () => {
    await installPackagesWithCompatibilityRetry(
      projectDir,
      ["@tanstack/react-query"],
      { label: "TanStack Query setup" }
    );
  });
}

if ((isTW || isDaisy) && !isShadcn) {
  await withSpinner("Setting up Tailwind CSS", async () => {
    await installPackagesWithCompatibilityRetry(
      projectDir,
      ["tailwindcss", "@tailwindcss/vite"],
      { dev: true, label: "Tailwind CSS setup" }
    );
  });
}

if (isDaisy) {
  await withSpinner("Setting up DaisyUI", async () => {
    await installPackagesWithCompatibilityRetry(
      projectDir,
      ["daisyui"],
      { dev: true, label: "DaisyUI setup" }
    );
    await writeDaisyConfig(projectDir);
  });
}

if (isShadcn) {
  await withSpinner("Preparing Tailwind for shadcn/ui", async () => {
    await installPackagesWithCompatibilityRetry(
      projectDir,
      ["tailwindcss", "@tailwindcss/vite"],
      { dev: true, label: "shadcn/ui Tailwind setup" }
    );
  });

  await withSpinner("Setting up shadcn/ui", async () => {
    await initializeShadcnWithRetry(projectDir);
  });

  await withSpinner("Applying kickstack shadcn clean canvas", async () => {
    await writeShadcnThemeProvider(projectDir);
    await applyCleanCanvasFiles(projectDir, {
      isTS,
      isRR,
      hasFirebase: false,
      useShadcn: true,
      useAppCss: false,
    });
  });
}

if (hasFirebase) {
  await withSpinner("Setting up Firebase", async () => {
    await installPackagesWithCompatibilityRetry(
      projectDir,
      ["firebase"],
      { label: "Firebase setup" }
    );
  });

  await withSpinner("Scaffolding Firebase auth context", async () => {
    await writeFirebaseAuthScaffold(projectDir, { isTS });
  });
}

await withSpinner("Finalizing starter files", async () => {
  await applyCleanCanvasFiles(projectDir, {
    isTS,
    isRR,
    hasFirebase,
    useShadcn: isShadcn,
    useAppCss: !isShadcn,
    hasTanstackQuery,
  });
});

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
}
