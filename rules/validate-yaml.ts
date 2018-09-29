import { danger, message } from 'danger';

export const validateYaml = async () => {
  message(`files ${danger.git.modified_files.join(', ')}`)
  if (!(danger.git.modified_files.includes("test.yaml"))) {
    return
  }

  const test = await danger.git.diffForFile("test.yaml")

  message(`test ${JSON.stringify(test)}`)

  const test2 = await danger.git.structuredDiffForFile("test.yaml")

  message(`test2 ${JSON.stringify(test2)}`)
};

export default async () => {
  validateYaml()
};