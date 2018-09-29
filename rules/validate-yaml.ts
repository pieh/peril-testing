import { danger, message } from 'danger';

export const validateYaml = async () => {
  console.log('validating')
  if (!(danger.git.modified_files.includes("test.yaml"))) {
    console.log('no test.yaml in changed files')
    return
  }

  console.log(`getting fileContent`)

  const test = await danger.github.utils.fileContents("test.yaml")

  console.log(`test ${JSON.stringify(test)}`)
};

export default async () => {
  return validateYaml()
};