import { danger, message, fail } from 'danger';
import { load as yamlLoad } from 'js-yaml'

export const validateYaml = async () => {
  console.log('validating')
  const filePath = "test.yaml"
  if (!(danger.git.modified_files.includes(filePath))) {
    console.log(`no ${filePath} in changed files`)
    return
  }

  const textContent = await danger.github.utils.fileContents(filePath)
  try {
    const content = yamlLoad(textContent)
    message(`${filePath} content:\n${content}`)
  } catch (e) {
    fail(`${filePath} is not valid:\n${e.message}`)
  }
};

export default async () => {
  return validateYaml()
};