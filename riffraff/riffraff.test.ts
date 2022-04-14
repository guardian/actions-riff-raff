import { riffraffPrefix, riffraffYaml } from "./riffraff";
import type { Manifest } from "./riffraff";

describe("riffraff", () => {
  it("should output riffraff.yaml in the correct format", () => {
    const want = `stacks:
  - deploy
regions:
  - eu-west-1
deployments:
  amiable:
    type: autoscaling
    parameters:
      bucket: deploy-tools-dist
    dependencies:
      - cloudformation
  cloudformation:
    type: cloud-formation
    app: amiable
    parameters:
      templatePath: Amiable.template.json
`;

    const got = riffraffYaml("deploy", [
      {
        name: "amiable",
        sources: [],
        data: {
          type: "autoscaling",
          parameters: { bucket: "deploy-tools-dist" },
          dependencies: ["cloudformation"],
        },
      },
      {
        name: "cloudformation",
        sources: [],
        data: {
          type: "cloud-formation",
          app: "amiable",
          parameters: { templatePath: "Amiable.template.json" },
        },
      },
    ]);

    expect(got).toBe(want);
  });

  it("should return the correct S3 prefix", () => {
    const m: Manifest = {
      branch: "main",
      vcsURL: "https://github.com/guardian/example",
      revision: "dev",
      buildNumber: "10",
      projectName: "example",
      startTime: new Date(),
    };

    const got = riffraffPrefix(m);
    const want = "example/10";

    expect(got).toBe(want);
  });
});
