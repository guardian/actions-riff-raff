# guardian/actions-riff-raff

A language-agnostic GitHub Action to create and upload Riff-Raff artifacts.

It will:
- Create the `build.json` file
- Package files into deployment directories, and upload them to Riff-Raff's S3 buckets

It is loosely modelled on, and is a logical extension of,
https://github.com/guardian/node-riffraff-artifact.

## Example usage

To use, add (something like) the following to your workflow file:

```yaml
- uses: guardian/actions-riff-raff@v1
  with:
    app: foo
    config: |
      stacks:
        - deploy
      regions:
        - eu-west-1
      allowedStages:
        - CODE
        - PROD
      deployments:
        upload:
          type: aws-s3
          sources:
            - test-data
          parameters:
            bucket: aws-some-bucket
            cacheControl: private
            publicReadAcl: false
```

Or, to use with an existing `riff-raff.yaml`:

```yaml
- uses: guardian/actions-riff-raff@v1
  with:
    app: foo
    configPath: /path/to/riff-raff.yaml
    contentDirectories: |
      - my-cloudformation:
        - cfn/template.yaml
      - my-lambda-app:
        - lambda.zip
      - my-static-site:
        - static-site/dist
```

## Credentials

You will need to provide credentials to upload to S3. Typically, this involves
adding the following in your workflow file:

(to your job)

```
permissions:
  id-token: write
  contents: read
```

(to your steps)

```
uses: aws-actions/configure-aws-credentials@v1
with:
  aws-region: eu-west-1
  role-to-assume: ${{ secrets.GU_RIFF_RAFF_ROLE_ARN }}
```

For more info, see: https://github.com/aws-actions/configure-aws-credentials.

## Available inputs

### app (required, unless setting `projectName`)

The app name. By default, `stack::app` will be used for the Riffraff project
name. But note, if you have multiple stacks specified, use `projectName`
instead.

### projectName (alternative to `app`)

Used instead of `app` to override the default Riffraff project naming strategy.
Useful when your Riffraff configuration contains multiple stacks.

### config (required, unless setting `configPath`)

The actual Riffraff configuration. This section is equivalent to the contents of
a `riff-raff.yaml` file with an additional (optional) field per deployment
called `sources` that can point to a list of files and directories, all of which
will be included in the package for the deployment.

Note, inputs can only be strings in Github Actions so `|` is used to provide the
config as a multiline string.

### configPath (alternative to `config`)

Can be used instead of `config` to point to a riff-raff.yaml file instead of
storing the config directly in your workflow file.

### buildNumber (optional)

Used to override the default build number, for example, if you want to offset
it.

### contentDirectories (optional, alternative to `sources`)

A list of content to upload, with the structure:

```yaml
contentDirectories: |
  - directoryName
    - file
```

For example:

```yaml
config: |
  regions: [ eu-west-1 ]
  stacks: [ deploy ]
  deployments:
    cloudformation:
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
    prism:
      type: autoscaling
      parameters:
        bucketSsmLookup: true
      dependencies:
        - cloudformation
contentDirectories: |
  - cloudformation:
    - /path/to/Prism-CODE.template.json
    - /path/to/Prism-CODE.template.json
  - prism:
    - target/prism.deb
```

## Example - sources

To illustrate, with the following file structure:

```
cfn/cloudformation-PROD.yaml
cfn/cloudformation-CODE.yaml
some-config.yaml
```

The following deployment:

```
...
my-deployment:
  type: aws-s3
  sources:
    - cfn
    - some-config.yaml
  parameters: ...
```

will result in a Riffraff package like:

```
riff-raff.yaml
build.json
my-deployment/
  cloudformation-CODE.yaml
  cloudformation-PROD.yaml
  some-config.yaml
```

Use the `dryRun` flag to print outputs rather than upload.

## Local development

Edit the Typescript as usual and **remember to build** (`npm run build`) before
committing to ensure `index.js` is updated.

After merging into `main`, assuming it is not a breaking change (please avoid
these for as long as possible!), write to the `v1` tag and also add a new
`v1.x.x` tag as appropriate and create a release for that too.
