import { danger, message } from 'danger';

export const validateYaml = async () => {
  message(`files ${danger.git.modified_files.join(', ')}`)
  if (!(danger.git.modified_files.includes("test.yaml"))) {
    return
  }

  const test = await danger.github.utils.fileContents("test.yaml")

  message(`test ${JSON.stringify(test)}`)
};

export default async () => {
  validateYaml()
};