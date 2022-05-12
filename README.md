# actions-riff-raff

A language-agnostic Github Action to create and upload Riffraff artifacts. It will:

- create your `riff-raff.yaml` and `build.json` files
- package files into deployment directories
- upload the above to Riffraff's S3 buckets ready to deploy

It is loosely modelled on, and is a logical extension of,
https://github.com/guardian/node-riffraff-artifact.

To use, add (something like) the following to your workflow file:

```
- uses: guardian/actions-riff-raff@v1.0.0
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

Note, inputs can only be strings in Github Actions so `|` is used to provide the
config as a multiline string.

By default, `stack::app` will be the Riffraff project name. Use the (optional)
`projectName` setting to override this. When multiple stacks are specified in
the config, `projectName` becomes required and must be specified.

The `config` section is equivalent to the contents of a `riff-raff.yaml` file
with an additional (optional) field per deployment called `sources` that can
point to a list of files and directories, all of which will be included in the
package for the deployment.

`configPath` can be used instead of `config` to point directly to a
`riff-raff.yaml` file if you'd prefer that over storing the config directly in
your workflow file.

Note, you will need to provide credentials to upload to S3. Typically, this
involves adding the following in your workflow file:

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

### Example

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
