# Studio3D

A free, browser-based 3D massing and visualization sketchpad for architecture and CAD students.

**Live demo:** https://ssvan40uwz0mi3o0bvmdzg1n.macaly.app

## What it does

- Drop in 3D primitives (box, cylinder, cone, sphere) or ready-made objects: trees, cars, people, windows, doors, staircases, light fixtures, and interior furniture (sofa, bed, kitchen appliances, bathroom fixtures, etc.)
- Sketch a 2D footprint or circle on the ground and extrude it into a 3D volume
- Draw walls between any two points, in any direction
- Select, drag, nudge (arrow keys), scale, rotate, and recolor any object
- Apply material presets (concrete, glass, brick, wood, steel, grass)
- Measure distances between two points with a full X / Y / Z breakdown
- Full undo/redo history
- Export a PNG render or a real OBJ 3D model file (opens in Blender, SketchUp, Fusion 360, etc.)
- Save/load your scene locally in the browser

## Honest scope

This is a **massing and visualization sketchpad**, not a parametric CAD replacement. It doesn't do exact drafting tolerances, 2D construction documents, or AutoCAD-level precision — think of it as a free, quick tool for early-stage concept sketching and site/room layout studies, similar in spirit to SketchUp's original niche.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React framework, SSR)
- [Three.js](https://threejs.org/) for the 3D scene and rendering
- Tailwind CSS + shadcn/ui components
- TypeScript

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build    # production build
npm run preview  # preview the production build
```

## Notes for anyone forking this

- The `src/routes/__root.tsx` file includes a Google Analytics tag pointed at the original author's property. Remove or replace the `GA_MEASUREMENT_ID` if you fork this.
- The feedback link in `src/routes/index.tsx` (`FEEDBACK_EMAIL`) points to the original author's email. Update it if you fork this.
- Scene save/load uses `localStorage`, so saved scenes are per-browser, not synced anywhere.
- This repository is a clean, standalone mirror of the app's source — it was originally built and is hosted via [Macaly Cloud](https://www.macaly.com); some Macaly-specific platform tooling (visual editor tagging, dev-preview plugins) has been removed here since it isn't relevant outside that platform.

## License

Licensed under the [Apache License 2.0](LICENSE). Copyright 2026 Khan Gulrez Shagufa Fazal Ahmed. Free to use, modify, and build on.

If you reuse or adapt this project, please credit the original author and link back to https://github.com/randomthingsonlineatsk-cloud/studio3D. The Apache License 2.0 requires you to keep the `LICENSE` and `NOTICE` files with any copy you distribute.

_Versions published before October 2026 were released under an MIT-based license._

## Built by

Khan Gulrez Shagufa Fazal Ahmed
