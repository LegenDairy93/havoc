import { cp, mkdir, rm, writeFile } from "node:fs/promises";
const output=new URL("../pages-dist/",import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL("../apps/replay/",import.meta.url),new URL("./apps/replay/",output),{recursive:true});
await cp(new URL("../packages/",import.meta.url),new URL("./packages/",output),{recursive:true});
await writeFile(new URL("./index.html",output),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./apps/replay/"><title>HAVOC</title><a href="./apps/replay/">Open HAVOC replay lab</a>');
console.log("Built GitHub Pages artifact with replay UI and engine modules.");