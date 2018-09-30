import { danger, message, fail } from 'danger';
import { load as yamlLoad } from 'js-yaml'
import * as path from 'path'

const filePath = "data/test.yaml"
const supportedExts = ['.txt']

export const validateYaml = async () => {
  console.log('validating2', danger)

   if (!(danger.git.modified_files.includes(filePath))) {
    console.log(`no ${filePath} in changed files`)
    return
  }
  // console.log('a')
  const textContent = await danger.github.utils.fileContents(filePath)
  try {
    // console.log('b')
    const content = yamlLoad(textContent)
    // console.log('c')
    if (!Array.isArray(content)) {
      fail(`${filePath}: content need to be array`)
      return
    }
    // console.log('d')

    const [owner, repo] = danger.github.pr.head.repo.full_name.split('/')
    const imagesDirReponse = await danger.github.api.repos.getContent({repo, owner, path: 'data/images/'})
    const images = imagesDirReponse.data.map(({name}) => `images/${name}`)

    console.log(images)

    content.forEach((item, index) => {
      // assume item is object (for now)
      const { name, description, image } = item

      if (!name) {
        fail(`${filePath}: item #${index+1} is missing required 'name' property`)
      } else if (typeof name !== 'string') {
        fail(`${filePath}: item #${index+1} 'name' property need to be string`)
      }

      if (description && typeof description !== 'string') {
        fail(`${filePath}: item #${index+1} optional 'description' property need to be string`)
      }

      if (!image) {
        fail(`${filePath}: item #${index+1} is missing required 'image' property`)
      } else if (typeof image !== 'string') {
        fail(`${filePath}: item #${index+1} 'image' property need to be string`)
      } else if (!images.includes(image)) {
        fail(`${filePath}: item #${index+1} 'image' ${image} doesn't point to existing file`)
      } else if (!supportedExts.includes(path.extname(image))) {
        fail(`${filePath}: item #${index+1} 'image' ${image} use unsporrted file format - use one of following: ${supportedExts.join(', ')}`)
      }

    })
  } catch (e) {
    fail(`${filePath} is not valid:\n${e.message}`)
  }

  
};

export default async () => {
  return validateYaml()
};