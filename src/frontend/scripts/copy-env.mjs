import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve("env.json");
const target = resolve("dist", "env.json");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
