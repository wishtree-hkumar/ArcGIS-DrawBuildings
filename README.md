# DrawBuildings

A React + TypeScript + Vite application using ArcGIS Core for drawing buildings on a map.

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- npm (comes bundled with Node.js)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/wishtree-hkumar/ArcGIS-DrawBuildings.git
cd ArcGIS-DrawBuildings
npm install
```

## Available Scripts

### Run in development mode

Starts the Vite dev server with hot module replacement:

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

### Build for production

Type-checks the project and creates an optimized production build in the `dist/` folder:

```bash
npm run build
```

### Preview the production build

Serves the contents of `dist/` locally to preview the production build:

```bash
npm run preview
```

### Lint the codebase

```bash
npm run lint
```

## Tech Stack

- **React 19** — UI library
- **TypeScript** — type-safe JavaScript
- **Vite 6** — build tool and dev server
- **@arcgis/core** — ArcGIS Maps SDK for JavaScript

## Project Structure

```
DrawBuildings/
├── public/             # Static assets
├── src/                # Application source code
├── index.html          # Entry HTML file
├── package.json        # Project manifest & scripts
├── tsconfig*.json      # TypeScript configuration
└── vite.config.ts      # Vite configuration
```
