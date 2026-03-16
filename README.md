# 🚀 kickstack

**kickstack** is a lightweight CLI tool that scaffolds a **clean, minimal React + Vite project** — without demo clutter, boilerplate noise, or unnecessary setup.

It helps you start coding **immediately**, instead of deleting files first.

## 🌐 Live Website
👉 [kickstack.shoaaib.site](https://kickstack.shoaaib.site/)


---

## ✨ What is kickstack?

kickstack is an npm-based command-line tool that creates a fresh React project using a compatible **React + Vite template**, while removing all default demo code and test styles.

Instead of logos, counters, and animations, you get a **blank, ready-to-build foundation**.

> Think of it as a clean canvas instead of a demo showroom.

---

## 🧠 What does it do?

When you run kickstack, it automatically:

* Creates a React project powered by Vite
* Removes all demo and testing content
* Gives you a clean `App` component
* Optionally configures Tailwind CSS
* Optionally configures DaisyUI (UI library)
* Optionally adds React Router (data router)
* Optionally installs Firebase and scaffolds auth context/provider files
* Prompts to start the dev server after setup
* Produces a project that runs instantly

---

## 📦 What you get by default

Every project created with kickstack includes:

* React + Vite
* Clean `index.html`
* Minimal `main.jsx` / `main.tsx`
* Minimal `App.jsx` / `App.tsx`
* Empty `App.css`
* Optional Tailwind CSS (v4)
* Optional DaisyUI (Tailwind UI plugin)
* Optional Firebase auth scaffold
* `.gitignore` and `README.md`
* Ready-to-run development server

The default UI is intentionally simple:

```jsx
<h1>Welcome to my project</h1>
```

Nothing extra. No clutter.

---

## 🎯 Project variants you can choose

When running the CLI, you’ll be prompted to select one of the following:

1. **React (JavaScript)**
2. **React + Tailwind (JavaScript)**
3. **React + TypeScript**
4. **React + TypeScript + Tailwind**

Each option generates the correct files, dependencies, and configuration automatically.

You can also choose to include **React Router (data router)**, an optional **UI library (DaisyUI)**, and optional **Firebase auth scaffolding** during setup.

---

## 🔥 Why kickstack instead of default Vite?

Vite’s default React template is designed to **demonstrate features**, not to start real projects.

kickstack is designed for **actual development**.

### 🧹 No demo clutter

Vite includes:

* logos
* counters
* demo components
* animations
* sample styles

kickstack removes all of that.

You don’t delete code — you start writing code.

---

### ⚡ Start coding immediately

With default Vite:

1. Delete demo JSX
2. Remove unused imports
3. Clean CSS
4. Fix ESLint warnings

With kickstack:

* Your first line of code is already yours.

---

### 🎯 Beginner-friendly

No confusion about:

* what to delete
* what is demo code
* what is important

Perfect for:

* beginners
* students
* learning projects
* teaching React

---

### 🎨 Tailwind ready (optional)

Tailwind CSS is:

* installed
* configured
* imported

No manual setup required.

---

### 🌼 DaisyUI ready (optional)

DaisyUI is:

* installed
* configured in Tailwind
* enabled in `index.css`

No manual setup required.

---

### 🧭 React Router ready (optional)

Choose to include React Router (data router) and start with a clean router setup out of the box.

---

### 🔐 Firebase auth scaffold (optional)

Choose Firebase during setup and kickstack will:

* install `firebase`
* create `src/Context/AuthContext.jsx` / `AuthContext.tsx`
* create `src/Context/AuthProvider.jsx` / `AuthProvider.tsx`
* wrap your app with `AuthProvider` in `main.jsx` / `main.tsx`
* include a starter `userInfo` object in the provider

This keeps the setup minimal while giving you the auth structure up front.

---

### 🪶 Lightweight and focused

kickstack does **one thing well**:

> Create a clean React starting point.

No heavy frameworks.
No opinions forced on you.
Uses a compatible Vite template instead of hard-coding files.

---

## 📊 Comparison

| Default Vite          | kickstack              |
| --------------------- | ---------------------- |
| Demo-focused          | Project-focused        |
| Requires cleanup      | Ready immediately      |
| Extra styles          | Clean styles           |
| Manual Tailwind setup | Tailwind preconfigured |
| Manual UI setup       | DaisyUI optional       |
| Manual Router setup   | Router optional        |
| Manual auth scaffold  | Firebase scaffold optional |

---

## 📝 Version Notes

### v1.1.6

* Added an optional Firebase setup prompt during project creation
* Installed `firebase` automatically when that option is selected
* Scaffolded `AuthContext` and `AuthProvider` files for both JavaScript and TypeScript projects
* Wrapped the generated app with `AuthProvider` in `main.jsx` / `main.tsx`
* Added a starter `userInfo` object inside the generated auth provider

### v1.1.5

* Added automatic npm conflict recovery for the generated project and optional package installs
* Added compatibility-aware fallback for React Router, Tailwind CSS, and DaisyUI installs
* Added clearer logs when kickstack detects a dependency conflict and retries with compatible versions
* Added semver-based peer dependency matching instead of simple major-version guessing
* Verified the JavaScript and TypeScript Tailwind flows locally end to end

### v1.1.4

* Fixed Tailwind CSS setup breaking when the latest Vite template moved ahead of `@tailwindcss/vite` peer support
* Kept scaffolding on the latest Vite template while rewriting the generated project to a compatible Vite/plugin-react pair when needed
* Added user-facing logs explaining why the compatibility fallback happened and what versions were selected

---

## 🛠 Requirements

You only need **Node.js**.

* Node.js **18+ recommended**
* npm comes bundled with Node.js

Check installation:

```bash
node -v
npm -v
```

---

## ▶️ How to use kickstack

### Create a new project

```bash
npm kickstack my-app
```

or

```bash
npx kickstack@latest my-app
```

Follow the prompts to choose your preferred setup.

---

### Start the development server

```bash
cd my-app
npm run dev
```

Your app will be available at:

```
http://localhost:5173
```

---

## 📁 Example project structure

```text
my-app/
├─ src/
│  ├─ App.jsx
│  ├─ App.css
│  ├─ Context/
│  │  ├─ AuthContext.jsx
│  │  └─ AuthProvider.jsx
│  ├─ main.jsx
│  └─ index.css
├─ public/
├─ index.html
├─ vite.config.js
├─ .gitignore
└─ package.json
```

---

## 👤 Author

Created and maintained by **Shoaib Taimur**.

---

## 🏁 Final note

If Vite gives you a **demo app**,
**kickstack gives you a starting point.**

No cleanup.
No confusion.
Just build.

---
