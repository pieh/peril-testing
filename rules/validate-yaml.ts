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

    if (!Array.isArray(content)) {
      fail(`${filePath}: content need to be array`)
      return
    }

    content.forEach((item, index) => {
      // assume item is object (for now)
      const { name, description } = item

      if (!name) {
        fail(`${filePath}: item #${index+1} is missing required 'name' property`)
      } else if (typeof name !== 'string') {
        fail(`${filePath}: item #${index+1} 'name' property need to be string`)
      }

      if (description && typeof description !== 'string') {
        fail(`${filePath}: item #${index+1} optional 'description' property need to be string`)
      }
    })

    message(`${filePath} content:\n${content}`)
  } catch (e) {
    fail(`${filePath} is not valid:\n${e.message}`)
  }
};

export default async () => {
  return validateYaml()
};