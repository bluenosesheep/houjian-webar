import { readFile } from "node:fs/promises";
import { solarTerms, jingzhe } from "../data/solar-terms.js";

const html = await readFile("index.html", "utf8");
const app = await readFile("app.js", "utf8");
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const referencedIds = new Set([...app.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g)].map((match) => match[1]));
const missing = [...referencedIds].filter((id) => !htmlIds.has(id));

if (missing.length) throw new Error(`HTML 缺少被脚本引用的元素：${missing.join(", ")}`);
if (solarTerms.length !== 24) throw new Error(`节气数据应为24项，当前为${solarTerms.length}项`);
if (!jingzhe || jingzhe.phenology.length !== 3) throw new Error("惊蛰三候数据不完整");

console.log(`Verified ${htmlIds.size} UI elements, ${solarTerms.length} solar terms and ${jingzhe.phenology.length} phenology states.`);
