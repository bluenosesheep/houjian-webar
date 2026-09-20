import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const entry of ["index.html", "styles.css", "app.js", "assets", "data"]) {
  await cp(entry, `dist/${entry}`, { recursive: true });
}
console.log("Built static site in dist/");
