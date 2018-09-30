import { danger, message, fail } from 'danger';
import { load as yamlLoad } from 'js-yaml'
import * as Joi from 'joi'
// import YamlTestSchema from './file-schemas/yaml-test'
import * as path from 'path'

const filePath = "data/test.yaml"
const supportedExts = ['.txt']



const getTestSchema = () => {
  const customJoi = Joi.extend(joi => ({
    base: joi.string(),
    name: 'string',
    language: {
      supportedExtension: 'need to use supported extension {{q}}'
    },
    rules: [
      {
        name: 'supportedExtension',
        params: {
          q: joi.array().items(joi.string())
        },
        validate(params, value, state, options) {
          if (!params.q.includes(path.extname(value))) {
            return this.createError('string.supportedExtension', { v: value, q: params.q }, state, options)
          }
          
          return value
        }
      }
    ]
  }))

  return customJoi.array().items(
    Joi.object().keys({
      name: Joi.string().required(),
      description: Joi.string(),
      image: customJoi.string().supportedExtension(['.txt']),
    })
  )
}

export const validateYaml = async () => {
  console.log('validating2')

   if (!(danger.git.modified_files.includes(filePath))) {
    console.log(`no ${filePath} in changed files`)
    return
  }
  // console.log('a')
  const textContent = await danger.github.utils.fileContents(filePath)
  try {
    // console.log('b')
    const content = yamlLoad(textContent)

    const result = Joi.validate(content, getTestSchema())
    if (result.error) {
      fail(`${filePath} didn't pass validation:\n${result.error}`)
    }
    // console.log('c')
    // if (!Array.isArray(content)) {
    //   fail(`${filePath}: content need to be array`)
    //   return
    // }
    // // console.log('d')

    // const [owner, repo] = danger.github.pr.head.repo.full_name.split('/')
    // const imagesDirReponse = await danger.github.api.repos.getContent({repo, owner, path: 'data/images/'})
    // const images = imagesDirReponse.data.map(({name}) => `images/${name}`)

    // console.log(images)

    // content.forEach((item, index) => {
    //   // assume item is object (for now)
    //   const { name, description, image } = item

    //   if (!name) {
    //     fail(`${filePath}: item ${index+1} is missing required 'name' property`)
    //   } else if (typeof name !== 'string') {
    //     fail(`${filePath}: item ${index+1} 'name' property need to be string`)
    //   }

    //   if (description && typeof description !== 'string') {
    //     fail(`${filePath}: item ${index+1} optional 'description' property need to be string`)
    //   }

    //   if (!image) {
    //     fail(`${filePath}: item ${index+1} is missing required 'image' property`)
    //   } else if (typeof image !== 'string') {
    //     fail(`${filePath}: item ${index+1} 'image' property need to be string`)
    //   } else if (!images.includes(image)) {
    //     fail(`${filePath}: item ${index+1} 'image' ${image} doesn't point to existing file`)
    //   } else if (!supportedExts.includes(path.extname(image))) {
    //     fail(`${filePath}: item ${index+1} 'image' ${image} unsporrted file format - use one of following: ${supportedExts.join(', ')}`)
    //   }

    })
  } catch (e) {
    fail(`${filePath} is not valid:\n${e.message}`)
  }

  
};

export default async () => {
  return validateYaml()
};