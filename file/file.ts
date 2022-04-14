import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";

// Walk a directory and children and apply fn to any contained file paths.
export const walk = <A>(path: string, fn: (path: string) => A): A[] => {
  const info = fs.lstatSync(path);

  if (info.isFile()) {
    return [fn(path)];
  }

  if (info.isDirectory()) {
    const children = fs
      .readdirSync(path)
      .flatMap((p) => walk(`${path}/${p}`, fn));
    return new Array<A>().concat(children);
  }

  return []; // Ignore block devices, symlinks, etc.
};

// Write to file, creating any directories as required
export const write = (filePath: string, data: string): void => {
  const dir = path.dirname(filePath);
  child_process.execSync(`mkdir -p ${dir}`); // ensure destDir exists
  fs.writeFileSync(filePath, data, { encoding: "utf-8" });
};

// Copy file or (recursive copy of) directory.
export const cp = (sources: string[], destDir: string): void => {
  child_process.execSync(`mkdir -p ${destDir}`); // ensure destDir exists

  sources.forEach((src) => {
    const info = fs.lstatSync(src);
    if (info.isDirectory()) {
      child_process.execSync(`cp -r ${src}/* ${destDir}`);
    } else if (info.isFile()) {
      child_process.execSync(`cp ${src} ${destDir}`);
    } else {
      throw new Error(`source is neither file not directory: '${src}'`);
    }
  });
};

export const printDir = (dir: string): string => {
  return walk(dir, (path) => path).join("\n");
};
