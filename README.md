# guardian/actions-riff-raff

A language-agnostic GitHub Action to create and upload Riff-Raff artifacts.

It will:
- Create the `build.json` file
- Package files into deployment directories, and upload them to Riff-Raff's S3 buckets

It is loosely modelled on, and is a logical extension of,
https://github.com/guardian/node-riffraff-artifact.

> [!IMPORTANT]
> Ensure your project has been added to https://github.com/guardian/riffraff-platform too.

## Example usage

To use, add (something like) the following to your workflow file.

```yaml
jobs:
  CI:
    runs-on: ubuntu-latest

    permissions:
      # Allow GitHub to request an OIDC JWT ID token, for exchange with AWS Security Token Service (STS)
      # See https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services#updating-your-github-actions-workflow
      id-token: write

      # Required for `actions/checkout`
      contents: read

      # Required to comment on a pull request
      pull-requests: write

    steps:
      - uses: actions/checkout@v3

      # Your usual build steps here...

      - uses: guardian/actions-riff-raff@v4
        with:
          app: foo
          roleArn: ${{ secrets.GU_RIFF_RAFF_ROLE_ARN }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          config: |
            stacks:
              - deploy
            regions:
              - eu-west-1
            allowedStages:
              - CODE
              - PROD
            deployments:
              static-site-assets:
                type: aws-s3
                parameters:
                  bucket: aws-some-bucket
                  cacheControl: private
                  publicReadAcl: false
          contentDirectories: |
            static-site-assets:
              - test-data
```

## Available inputs

### `app`
*Required* (unless setting `projectName`)

The app name, used for the creating Riff-Raff project name with the format `stack::app`.
Where `stack` is read from the provided `riff-raff.yaml` config.

Note: If you have multiple stacks specified, use `projectName` instead.

### `roleArn`

_Required_

The ARN for a role that the action assumes using AssumeRoleWithWebIdentity. This is required to upload artifacts to the Riff-Raff bucket.

### `projectName`
Used instead of `app` to override the default Riff-Raff project naming strategy.

### `config`
*Required* (unless setting `configPath`)

The actual Riff-Raff configuration.

Note: Inputs can only be strings in GitHub Actions so `|` is used to provide the
config as a multiline string.

```yaml
- uses: guardian/actions-riff-raff@v2
  with:
    app: foo
    config: | # <-- the pipe is important!
      stacks:
        - deploy
      regions:
        - eu-west-1
```

### `configPath`
*Required* (unless setting `config`)

A path to a `riff-raff.yaml` file.

### `buildNumber`
Used to override the default build number, for example, if you want to offset it.

### `buildNumberOffset`
If provided, this should be a number which will be added to the
`buildNumber`. This can be used, for example, when migrating from another build
system, to force the build numbers produced by this action to continue after the
last build from the previous build system. For example, if the last build from
the previous system was build 45, setting this offset to 45 will mean that the
first build produced by this action will be 46.

### `contentDirectories`
*Required*

A mapping to describe which files should be uploaded for which package.

### `githubToken`
*Required*

A GitHub token scoped to allow pull request commenting.

### `commentingStage`
_Default: CODE_

When commenting on a pull request, which stage should be used. Typically a pre-production stage.

## Detailed example
To illustrate, given the following file structure:

```console
.
├── cdk
│   └── cdk.out
│       ├── Prism-CODE.template.json
│       └── Prism-PROD.template.json
├── static-site
│   └── dist
│       ├── app.js
│       └── index.html
└── target
│   └── prism.deb
└── riff-raff.yaml
```

And the following `riff-raff.yaml`:

```yaml
regions: [ eu-west-1 ]
stacks: [ deploy ]
deployments:
  cloudformation: # <-- this is a package name
    type: cloud-formation
    app: prism
    parameters:
      templateStagePaths:
        CODE: Prism-CODE.template.json
        PROD: Prism-PROD.template.json
      amiParameter: AMIPrism
      amiEncrypted: true
      amiTags:
        Recipe: arm64-bionic-java11-deploy-infrastructure
        AmigoStage: PROD
        BuiltBy: amigo
  prism: # <-- this is another package name
    type: autoscaling
    parameters:
      bucketSsmLookup: true
    dependencies:
      - cloudformation
  static-site-assets: # <-- this is a third package name
    type: aws-s3
    parameters:
      bucket: aws-some-bucket
      cacheControl: private
      publicReadAcl: false
```

And the following GitHub workflow:

```yaml
configPath: riff-raff.yaml
contentDirectories: |
  cloudformation: # <-- this package name needs to match the one found in riff-raff.yaml
    - cdk/cdk.out/Prism-CODE.template.json
    - cdk/cdk.out/Prism-PROD.template.json
  prism: # <-- this package name needs to match the one found in riff-raff.yaml
    - target/prism.deb
  static-site-assets: # <-- this package name needs to match the one found in riff-raff.yaml
    - static-site/dist
```

Riff-Raff will receive a package like:

```console
.
├── cloudformation
│   ├── Prism-CODE.template.json
│   └── Prism-PROD.template.json
├── prism
│   └── prism.deb
├── static-site-assets
│   ├── app.js
│   └── index.html
├── build.json # <-- generated by this action
└── riff-raff.yaml
```

This can also be seen with the `dryRun` flag.
When set, the package is not uploaded, instead, it is printed to stdout.

### How Riff-Raff defines package names
Riff-Raff doesn't always use the key as the package name. If you set `contentDirectory` on a deployment, that will win.

For example in this `riff-raff.yaml`:

```yaml
regions: [ eu-west-1 ]
stacks: [ deploy ]
deployments:
  my-cloudformation-deployment:
    type: cloud-formation
    app: prism
    contentDirectory: cfn-templates
    parameters:
      templateStagePaths:
        CODE: Prism-CODE.template.json
        PROD: Prism-PROD.template.json
      amiParameter: AMIPrism
      amiEncrypted: true
      amiTags:
        Recipe: arm64-bionic-java11-deploy-infrastructure
        AmigoStage: PROD
        BuiltBy: amigo
```

The package name is "cfn-templates" rather than "my-cloudformation-deployment".

## Local development

Edit the Typescript as usual and **remember to build** (`npm run build`) before
committing to ensure `index.js` is updated.

After merging into `main`, create a [new version](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md).

> **Note**
> Try to avoid creating new major versions for as long as possible as it requires explicit upgrades in consuming repositories.

## Migrating from v3 to v4

Prior to v4, workflows that used this action were required to assume the role necessary to upload artifacts to Riff-Raff, via `configure-aws-credentials`. This is no longer required, as this action does it for you. This has the benefit of hardening your workflows, as intermediate steps no longer have access to AWS credentials.

To migrate:

1. Bump `guardian/actions-riff-raff@v3` to `guardian/actions-riff-raff@v4` in your workflow file.

2. Add the required `roleArn` property under the `with` section of the `guardian/actions-riff-raff@v4` action. This is typically stored as a secret that can be accessed via `${{ secrets.GU_RIFF_RAFF_ROLE_ARN }}`.

3. Remove the `configure-aws-credentials` step from your workflow, as it's no longer required.

> [!NOTE]
> For the action to successfully assume the Riff-Raff role, you still need to include the following permission:
>
> ```yaml
> permissions:
>   id-token: write
>   # ...
> ```
