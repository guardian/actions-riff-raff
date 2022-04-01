import core from "@actions/core";

const main = () => {
    const app = core.getInput("app");
    const stack = core.getInput("app");
    const deployments = core.getInput("deployments");
    
    core.info(`app: ${app}; stack: ${stack}; deployments: ${deployments}`)
  };
  
  try {
    main();
  } catch (e) {
    const error = e as Error;
    core.error(error);
    core.setFailed(error.message);
  }