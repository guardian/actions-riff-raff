# actions-riff-raff

A language-agnostic Github Action to create and upload Riffraff artifacts. It will:

- create your `riff-raff.yaml` and `build.json` files
- package files into deployment directories
- upload the above to Riffraff's S3 bucket ready to deploy

It is loosely modelled on, and is a logical extension of,
https://github.com/guardian/node-riffraff-artifact.

To use, add (something like) the following to your workflow file:

```
- uses: @guardian/actions-riff-raff
  with:
    app: foo
    stack: deploy
    deployments: |
      upload:
        type: aws-s3
        sources: test-data
        parameters:
          bucket: aws-some-bucket
          cacheControl: private
          publicReadAcl: false
```

By default, `stack::app` will be the Riffraff project name. Use the (optional)
`projectName` setting to override this.

The `deployments` section structure is equivalent to the same section of a
`riff-raff.yaml` file with an addition field per deployment called `source` that
can point to files and directories, all of which will be included in the package
for the deployment.

To illustrate, with the following file structure:

```
cfn/cloudformation-PROD.yaml
cfn/cloudformation-CODE.yaml
some-config.yaml
```

The following deployment:

```
my-deployment:
  type: aws-s3
  sources: cfn,some-config.yaml
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
