"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  main: () => main
});
module.exports = __toCommonJS(src_exports);
var fs3 = __toESM(require("fs"));
var core3 = __toESM(require("@actions/core"));
var import_github2 = require("@actions/github");
var import_client_s32 = require("@aws-sdk/client-s3");
var import_credential_providers = require("@aws-sdk/credential-providers");
var yaml2 = __toESM(require("js-yaml"));

// src/config.ts
var core = __toESM(require("@actions/core"));
var yaml = __toESM(require("js-yaml"));

// src/file.ts
var child_process = __toESM(require("child_process"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var walk = (path2, fn) => {
  const info3 = fs.lstatSync(path2);
  if (info3.isFile()) {
    return [fn(path2)];
  }
  if (info3.isDirectory()) {
    const children = fs.readdirSync(path2).flatMap((p) => walk(`${path2}/${p}`, fn));
    return new Array().concat(children);
  }
  return [];
};
var read = (filePath) => {
  return fs.readFileSync(filePath, "utf-8");
};
var write = (filePath, data) => {
  const dir = path.dirname(filePath);
  child_process.execSync(`mkdir -p ${dir}`);
  fs.writeFileSync(filePath, data, { encoding: "utf-8" });
};
var cp = (sources, destDir) => {
  child_process.execSync(`mkdir -p ${destDir}`);
  sources.forEach((src) => {
    const info3 = fs.lstatSync(src);
    if (info3.isDirectory()) {
      child_process.execSync(`cp -r ${src}/* ${destDir}`);
    } else if (info3.isFile()) {
      child_process.execSync(`cp ${src} ${destDir}`);
    } else {
      throw new Error(`source is neither file not directory: '${src}'`);
    }
  });
};
var printDir = (dir) => {
  return walk(dir, (path2) => path2).join("\n");
};

// src/config.ts
var getInput2 = (name, options) => {
  const got = core.getInput(name, options);
  return got === "" ? void 0 : got;
};
var readConfigFile = (path2) => {
  const data = read(path2);
  return yaml.load(data);
};
var getProjectName = ({ stacks }) => {
  const appInput = getInput2("app");
  const projectNameInput = getInput2("projectName");
  if (!appInput && !projectNameInput) {
    throw new Error("Must specify either app or projectName.");
  }
  if (projectNameInput) {
    return projectNameInput;
  }
  const numberOfStacks = stacks.length;
  if (numberOfStacks === 1 && appInput) {
    const stack = stacks[0];
    return `${stack}::${appInput}`;
  } else {
    throw new Error(
      `Unable to generate a project name as multiple stacks detected (${stacks.join(
        ","
      )}).`
    );
  }
};
var isSources = (obj) => {
  if (typeof obj === "object") {
    return Object.values(obj).every(
      (source) => Array.isArray(source)
    );
  }
  return false;
};
var getDeployments = () => {
  const input = getInput2("contentDirectories", { required: true });
  const contentDirectoriesInput = input ? yaml.load(input) : {};
  if (!isSources(contentDirectoriesInput)) {
    throw new Error(
      `Invalid contentDirectories. Each value must be a list of sources, but got: ${input ?? ""}`
    );
  }
  if (isSources(contentDirectoriesInput)) {
    const deployments = Object.entries(
      contentDirectoriesInput
    ).map(([name, sources]) => ({ name, sources }));
    const totalDeployments = deployments.reduce(
      (acc, { sources }) => acc + sources.length,
      0
    );
    if (totalDeployments === 0) {
      throw new Error(
        "Not configured with any deployment sources, no files will be uploaded to Riff-Raff."
      );
    }
    return deployments;
  }
  throw new Error(
    `Invalid contentDirectories. Each value must be a list of sources, but got: ${input ?? ""}`
  );
};
var getRiffRaffYaml = () => {
  const configInput = getInput2("config");
  const configPathInput = getInput2("configPath");
  if (!configInput && !configPathInput) {
    throw new Error("Must specify either config or configPath.");
  }
  const configObjFromInput = configInput ? yaml.load(configInput) : readConfigFile(configPathInput);
  return {
    /*
      A valid `riff-raff.yaml` does not need to have `stacks` at the root level, it can be defined within each individual deployment.
      This action uses the top level `stacks` to create a default project name.
      This is a little hack to enable this behaviour, else we'd have to start validating `stacks` within each deployment.
      We create a default project name if and only if `stacks` has a single value.
       */
    ...{ stacks: [] },
    ...configObjFromInput
  };
};
var envOrUndefined = (variableName) => {
  const maybeEnvVar = process.env[variableName];
  return maybeEnvVar && maybeEnvVar.trim() !== "" ? maybeEnvVar.trim() : void 0;
};
var branchName = () => {
  const branchName2 = envOrUndefined("GITHUB_HEAD_REF") ?? envOrUndefined("GITHUB_REF");
  return branchName2 ? branchName2.replace("refs/heads/", "") : void 0;
};
var vcsURL = () => {
  const repoFromEnv = envOrUndefined("GITHUB_REPOSITORY");
  return repoFromEnv ? `https://github.com/${repoFromEnv}` : void 0;
};
var offsetBuildNumber = (buildNumber, offset) => {
  const intOffset = parseInt(offset);
  const intBuildNumber = parseInt(buildNumber);
  if (isNaN(intOffset) || isNaN(intBuildNumber)) {
    return buildNumber;
  } else {
    return (intBuildNumber + intOffset).toString();
  }
};
var githubToken = () => {
  const token = getInput2("githubToken", { required: true });
  if (!token) {
    throw new Error("githubToken not supplied");
  }
  return token;
};
var getRoleArn = () => {
  const roleArn = getInput2("roleArn", { required: true });
  if (!roleArn) {
    throw new Error("roleArn not supplied");
  }
  return roleArn;
};
function getConfiguration() {
  const riffRaffYaml = getRiffRaffYaml();
  const projectName = getProjectName(riffRaffYaml);
  const roleArn = getRoleArn();
  const dryRunInput = getInput2("dryRun");
  const buildNumberInput = getInput2("buildNumber");
  const buildNumberOffset = getInput2("buildNumberOffset") ?? "0";
  const stagingDirInput = getInput2("stagingDir");
  const baseBuildNumber = buildNumberInput ?? envOrUndefined("GITHUB_RUN_NUMBER") ?? "dev";
  const buildNumber = offsetBuildNumber(baseBuildNumber, buildNumberOffset);
  const commentingStage = getInput2("commentingStage") ?? "CODE";
  return {
    projectName,
    roleArn,
    riffRaffYaml,
    dryRun: dryRunInput === "true",
    buildNumber,
    branchName: branchName() ?? "dev",
    vcsURL: vcsURL() ?? "dev",
    revision: envOrUndefined("GITHUB_SHA") ?? "dev",
    deployments: getDeployments(),
    stagingDirInput,
    pullRequestComment: {
      projectName,
      buildNumber,
      commentingStage,
      githubToken: githubToken()
    }
  };
}

// src/pr-comment.ts
var import_core = require("@actions/core");
var import_github = require("@actions/github");
function getDeployUrl(config) {
  const url = new URL("https://riffraff.gutools.co.uk/deployment/deployAgain");
  url.searchParams.set("project", config.projectName);
  url.searchParams.set("build", config.buildNumber);
  url.searchParams.set("stage", config.commentingStage);
  url.searchParams.set("updateStrategy", "MostlyHarmless");
  url.searchParams.set("action", "deploy");
  return url;
}
function getPreviewUrl(config) {
  const url = new URL("https://riffraff.gutools.co.uk/preview/yaml");
  url.searchParams.set("project", config.projectName);
  url.searchParams.set("build", config.buildNumber);
  url.searchParams.set("stage", config.commentingStage);
  url.searchParams.set("updateStrategy", "MostlyHarmless");
  return url;
}
function getWhatsOnUrl(config) {
  const url = new URL("https://riffraff.gutools.co.uk/deployment/history");
  url.searchParams.set("projectName", config.projectName);
  url.searchParams.set("stage", config.commentingStage);
  return url;
}
var marker = (projectName) => {
  return `<!-- guardian/actions-riff-raff for ${projectName} -->`;
};
function getCommentMessage(config) {
  const { buildNumber, commentingStage, projectName } = config;
  const deployUrl = getDeployUrl(config).toString();
  const previewUrl = getPreviewUrl(config).toString();
  const whatsOnUrl = getWhatsOnUrl(config).toString();
  const mainMessage = `[Deploy build ${buildNumber} of \`${projectName}\` to ${commentingStage}](${deployUrl})`;
  return [
    `### ${mainMessage}`,
    "<details>",
    "<summary>All deployment options</summary>",
    "",
    `- ${mainMessage}`,
    `- [Deploy parts of build ${buildNumber} to ${commentingStage} by previewing it first](${previewUrl})`,
    `- [What's on ${commentingStage} right now?](${whatsOnUrl})`,
    "</details>",
    "",
    "---",
    "_From [guardian/actions-riff-raff](https://github.com/guardian/actions-riff-raff)._",
    marker(projectName)
  ].join("\n");
}
async function commentOnPullRequest(pullRequestNumber, config) {
  const comment = getCommentMessage(config);
  const octokit = (0, import_github.getOctokit)(config.githubToken);
  const comments = await octokit.rest.issues.listComments({
    ...import_github.context.repo,
    issue_number: pullRequestNumber
  });
  (0, import_core.debug)(`Total comments: ${comments.data.length}`);
  const previousComments = comments.data.filter((comment2) => {
    const fromBot = comment2.user?.login === "github-actions[bot]";
    const fromMe = comment2.body?.includes(marker(config.projectName)) ?? false;
    return fromBot && fromMe;
  });
  if (previousComments.length > 0) {
    (0, import_core.debug)(`Found ${previousComments.length} comments by github-actions[bot]`);
    await Promise.all(
      previousComments.map(async (previousComment) => {
        (0, import_core.debug)(`Updating comment with id: ${previousComment.id}.`);
        await octokit.rest.issues.updateComment({
          ...import_github.context.repo,
          comment_id: previousComment.id,
          body: comment
        });
      })
    );
  } else {
    (0, import_core.debug)(`No previous comment found. Creating one.`);
    await octokit.rest.issues.createComment({
      ...import_github.context.repo,
      issue_number: pullRequestNumber,
      body: comment
    });
  }
}
async function getPullRequestNumber(config) {
  const { eventName } = import_github.context;
  const { pull_request } = import_github.context.payload;
  if (pull_request) {
    (0, import_core.debug)(
      `Identified PR number as ${pull_request.number} from payload. Trigger was ${eventName}.`
    );
    return Promise.resolve(pull_request.number);
  }
  (0, import_core.debug)(`Attempting to get PR number from commit ${import_github.context.sha}`);
  const octokit = (0, import_github.getOctokit)(config.githubToken);
  const result = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    ...import_github.context.repo,
    commit_sha: import_github.context.sha
  });
  const openPrs = result.data.filter(({ state }) => state === "open");
  const pr = openPrs.find((_) => import_github.context.ref === `refs/heads/${_.head.ref}`) ?? openPrs.at(0);
  if (!pr) {
    (0, import_core.debug)(
      `Failed to identify PR number from commit. Trigger was ${eventName}.`
    );
    return void 0;
  }
  (0, import_core.debug)(
    `Identified PR number as ${pr.number} from commit. Trigger was ${eventName}.`
  );
  (0, import_core.debug)(JSON.stringify(pr, null, 2));
  return pr.number;
}

// src/riffraff.ts
var manifest = (projectName, buildNumber, branch, vcsURL2, revision, buildTool) => {
  return {
    branch,
    vcsURL: vcsURL2,
    revision,
    buildNumber,
    projectName,
    startTime: /* @__PURE__ */ new Date(),
    buildTool
  };
};
var riffraffPrefix = (m) => {
  return [m.projectName, m.buildNumber].join("/");
};

// src/s3.ts
var fs2 = __toESM(require("fs"));
var core2 = __toESM(require("@actions/core"));
var import_client_s3 = require("@aws-sdk/client-s3");
var S3Store = class {
  client;
  constructor(client) {
    this.client = client;
  }
  async put(data, bucket, key) {
    const cmd = new import_client_s3.PutObjectCommand({
      Body: data,
      Key: key,
      Bucket: bucket
    });
    await this.client.send(cmd);
  }
};
var sync = async (store, dir, bucket, keyPrefix) => {
  const responses = walk(dir, (filePath) => {
    const data = fs2.readFileSync(filePath);
    const key = keyPrefix + filePath.substring(dir.length);
    core2.info(`s3 sync: ${filePath} -> ${key}`);
    return store.put(data, bucket, key);
  });
  await Promise.all(responses);
};

// src/index.ts
var GITHUB_OIDC_AUDIENCE = "sts.amazonaws.com";
var RiffRaffUploadError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RiffRaffUploadError";
  }
};
function validateTopics(topics) {
  const deployableTopics = ["production", "hackday", "prototype", "learning"];
  const hasValidTopic = topics.some(
    (topic) => deployableTopics.includes(topic)
  );
  if (!hasValidTopic) {
    const topicList = deployableTopics.join(", ");
    throw new RiffRaffUploadError(
      `No valid repository topic found. Add one of ${topicList}. See https://github.com/guardian/recommendations/blob/main/github.md#topics`
    );
  } else {
    core3.info("Valid topic found");
  }
}
var main = async (options) => {
  core3.debug(JSON.stringify(import_github2.context, null, 2));
  const config = getConfiguration();
  validateTopics(import_github2.context.payload.repository?.topics);
  core3.debug(JSON.stringify(config, null, 2));
  const {
    riffRaffYaml,
    roleArn,
    projectName,
    dryRun,
    buildNumber,
    branchName: branchName2,
    vcsURL: vcsURL2,
    revision,
    deployments,
    stagingDirInput,
    pullRequestComment
  } = config;
  const mfest = manifest(
    projectName,
    buildNumber,
    branchName2,
    vcsURL2,
    revision,
    "guardian/actions-riff-raff"
  );
  const manifestJSON = JSON.stringify(mfest);
  const stagingDir = stagingDirInput ?? fs3.mkdtempSync("staging-");
  if (options.WithSummary) {
    await core3.summary.addHeading("Riff-Raff").addTable([
      ["Project name", projectName],
      ["Build number", buildNumber]
    ]).write();
  }
  core3.info("writing rr yaml...");
  write(`${stagingDir}/riff-raff.yaml`, yaml2.dump(riffRaffYaml));
  deployments.forEach((deployment) => {
    cp(deployment.sources, `${stagingDir}/${deployment.name}`);
  });
  if (dryRun) {
    core3.info("Output (dryRun=true):");
    core3.info(printDir(stagingDir));
    return;
  }
  const idToken = await core3.getIDToken(GITHUB_OIDC_AUDIENCE);
  const store = new S3Store(
    new import_client_s32.S3Client({
      region: "eu-west-1",
      credentials: (0, import_credential_providers.fromWebToken)({
        roleArn,
        webIdentityToken: idToken
      })
    })
  );
  const keyPrefix = riffraffPrefix(mfest);
  core3.info(`S3 prefix: ${keyPrefix}`);
  try {
    await sync(store, stagingDir, "riffraff-artifact", keyPrefix);
    await store.put(
      Buffer.from(manifestJSON, "utf8"),
      "riffraff-builds",
      keyPrefix + "/build.json"
    );
    core3.info("Upload complete.");
  } catch (err) {
    core3.error(
      "Error uploading to Riff-Raff. Does the repository have an IAM Role? See https://github.com/guardian/riffraff-platform"
    );
    throw err;
  }
  try {
    const pullRequestNumber = await getPullRequestNumber(pullRequestComment);
    if (pullRequestNumber) {
      core3.info(`Commenting on PR ${pullRequestNumber}`);
      await commentOnPullRequest(pullRequestNumber, pullRequestComment);
    } else {
      core3.info(
        `Unable to calculate Pull Request number, so cannot add a comment. Event is ${import_github2.context.eventName}`
      );
    }
  } catch (err) {
    core3.error("Error commenting on PR. Do you have the correct permissions?");
    throw err;
  }
};
if (require.main === module) {
  main({ WithSummary: true }).catch((err) => {
    if (err instanceof Error) {
      core3.error(err);
      core3.setFailed(err.message);
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
