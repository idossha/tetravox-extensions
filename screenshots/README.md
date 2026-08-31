# screenshots/

The images `index.json` entries name in their `screenshots` array, and the ones the website's
Extensions page is built from.

* One path segment per name — `seeg-panel.png`, not `seeg/panel.png`.
* `.png`, `.jpg`, `.jpeg` or `.webp`.
* Named `<vendor>-<what>.png`, so two modules cannot collide.
* The module actually doing its job: its panel open, on real data, in the app.
* No identifiable patient data. A public index is a public image.

Add the file in the same pull request that names it — `node scripts/validate-index.mjs` fails on a
`screenshots` entry with no file behind it.
