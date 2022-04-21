import * as yaml from "js-yaml";

export type Manifest = {
  branch: string;
  vcsURL: string;
  revision: string;
  buildNumber: string;
  projectName: string;
  startTime: Date;
};

const branchName = (): string | undefined => {
  // `GITHUB_HEAD_REF` is only set for pull request events and represents the branch name (e.g. `feature-branch-1`).
  // `GITHUB_REF` is the branch or tag ref that triggered the workflow (e.g. `refs/heads/feature-branch-1` or `refs/pull/259/merge`).
  // Either can be the empty string ¯\_(ツ)_/¯
  // See https://docs.github.com/en/actions/learn-github-actions/environment-variables
  const branchName = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF;
  return branchName ? branchName.replace("refs/heads/", "") : undefined;
};

const vcsURL = (): string | undefined => {
  return process.env.GITHUB_REPOSITORY
    ? "https://github.com/" + process.env.GITHUB_REPOSITORY
    : undefined;
};

export const manifest = (
  app: string,
  stack: string,
  projectName?: string
): Manifest => {
  const name = projectName ? projectName : `${stack}::${app}`;

  return {
    branch: branchName() ?? "dev",
    vcsURL: vcsURL() ?? "dev",
    revision: process.env.GITHUB_SHA || "dev",
    buildNumber: process.env.GITHUB_RUN_NUMBER || "dev",
    projectName: name,
    startTime: new Date(),
  };
};

export type Deployment = {
  name: string;
  sources: string[];
  data: object;
};

export type RiffraffYaml = {
  stacks: string[];
  regions: string[];
  deployments: { [name: string]: any };
};

export const riffraffYaml = (
  stack: string,
  deployments: Deployment[]
): string => {
  const rrYaml: RiffraffYaml = {
    stacks: [stack],
    regions: ["eu-west-1"],
    deployments: deployments.reduce(
      (acc, deployment) => ({ ...acc, [deployment.name]: deployment.data }),
      {}
    ),
  };

  return yaml.dump(rrYaml);
};

export const riffraffPrefix = (m: Manifest): string => {
  return [m.projectName, m.buildNumber].join("/");
};
