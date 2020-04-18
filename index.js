#!/bin/sh
":"; //# comment; exec /usr/bin/env node --harmony "$0" "$@"

import fs from "fs";
const fsPromises = fs.promises;
import process from "process";
import path from "path";
import gitconfig from "gitconfig";
import commandLineArgs from "command-line-args";

const optionDefinitions = [
  { name: "root", type: String, defaultOption: true, defaultValue: "." },
  { name: "verbose", alias: "v", type: Boolean },
  { name: "force", alias: "f", type: Boolean },
];
// parse command line
const options = commandLineArgs(optionDefinitions);
options.root = path.resolve(options.root) + "/";
if (options.verbose) console.log(options);

const Blacklist = ["_archive", "node_modules"];

// Global mutable result (yes, I know)
const result = {
  meta: {
    ignore: [".git", ".vscode", "node_modules"],
    projects: {},
  },
  gitignore: new Set(),
};

// recursive function to traverse directory hierarchy looking for git repos
const visitDir = async (root) => {
  options.verbose ? console.log("visitDir", root) : process.stdout.write(".");
  try {
    const entries = await fsPromises.readdir(root);

    const dirs = [];
    for (let entry of entries) {
      if (Blacklist.includes(entry)) {
        result.gitignore.add(`${entry}/`);
        continue;
      }

      // ignore root dir
      if (entry === ".git" && root !== options.root) {
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

// called for every .git directory found
const visitRepo = async (dir) => {
  options.verbose ? console.log("visitRepo", dir) : process.stdout.write("*");
  // change to the directory, since the git-config module works relative to the .git repo
  process.chdir(dir);

  // get all the values
  const config = await gitconfig.get({
    location: "local",
  });

  // extract just what we need and emit if it exists
  const repo = config?.remote?.origin?.url;
  if (repo) {
    const relDir = dir.replace(options.root, "");
    result.meta.projects[relDir] = repo;
    result.gitignore.add(relDir);
    if (options.verbose) console.log(`  \"${relDir}\": \"${repo}\"`);
  }
};

//
// Main
//
(async () => {
  // output files
  const metaFile = path.join(options.root, ".meta");
  const gitignoreFile = path.join(options.root, ".gitignore");

  // don't overwrite existing result files, unless --force
  if (!options.force) {
    if (fs.existsSync(metaFile) || fs.existsSync(gitignoreFile)) {
      console.log(
        "To overwite existing .meta and .gitgnore files, use -f or --force option"
      );
      return;
    }
  }
  // recurse
  await visitDir(options.root);

  const numProjects = Object.keys(result.meta.projects).length;
  if (numProjects) {
    // write files
    if (options.verbose) console.log("Writing", metaFile);
    await fsPromises.writeFile(metaFile, JSON.stringify(result.meta, null, 2));
    if (options.verbose) console.log("Writing", gitignoreFile);
    await fsPromises.writeFile(gitignoreFile, [...result.gitignore].join("\n"));
  }

  console.log(`\nDone (${numProjects} projects)`);
})();
