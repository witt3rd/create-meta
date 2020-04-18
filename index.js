import fs from "fs";
const fsPromises = fs.promises;
import process from "process";
import path from "path";
import gitconfig from "gitconfig";

const BlackList = ["_archive", "node_modules"];
const meta = {
  ignore: [".git", ".vscode", "node_modules"],
  projects: {},
};

(async () => {
  // recursive function to traverse directory hierarchy looking for git repos
  const visitDir = async (root) => {
    // console.log("dir", root);
    try {
      const entries = (await fsPromises.readdir(root)).filter(
        (e) => !BlackList.includes(e)
      );
      const dirs = [];
      for (let entry of entries) {
        if (entry === ".git") {
          await visitRepo(root);
          continue;
        }
        const fullPath = path.join(root, entry);
        const stat = await fsPromises.lstat(fullPath);
        if (stat.isDirectory()) {
          dirs.push(fullPath);
        }
      }
      for (let dir of dirs) await visitDir(dir);
    } catch (err) {
      console.error(`Error occured while reading directory ${root}:`, err);
    }
  };

  const visitRepo = async (dir) => {
    process.chdir(dir);
    const config = await gitconfig.get({
      location: "local",
    });
    const repo = config?.remote?.origin?.url;
    if (repo) {
      meta.projects[dir] = repo;
      console.log(`${dir}: ${repo}`);
    }
  };

  // preserve current dir
  const startDir = process.cwd();

  // recurse
  await visitDir(path.resolve("/Users/donald/src/witt3rd"));

  // restore current dir
  process.chdir(startDir);

  console.log(meta);
})();
