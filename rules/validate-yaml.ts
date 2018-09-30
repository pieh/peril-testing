import { danger, message, fail } from 'danger';
import { load as yamlLoad } from 'js-yaml'
import * as Joi from 'joi'
import * as path from 'path'

const supportedExts = ['.txt']

const getSitesSchema = () => {
  return Joi.array().items(
    Joi.object().keys({

    })
  )
}

const getTestSchema = async () => {
  const [owner, repo] = danger.github.pr.head.repo.full_name.split('/')
  const imagesDirReponse = await danger.github.api.repos.getContent({repo, owner, path: 'data/images/'})
  const images = imagesDirReponse.data.map(({ name }) => `images/${name}`)

  interface SuppertedExtensionArgs {
    q: string[]
  }

  const customJoi = Joi.extend((joi: any) => ({
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
        validate(params: SuppertedExtensionArgs, value, state, options): any {
          if (!params.q.includes(path.extname(value))) {
            return this.createError('string.supportedExtension', { v: value, q: params.q }, state, options)
          }
          
          return value
        }
      },
    ]
  }))

  return customJoi.array().items(
    Joi.object().keys({
      name: Joi.string().required(),
      description: Joi.string(),
      image: customJoi.string().valid(images).supportedExtension(supportedExts),
    })
  )
}

const fileSchemas = {
  "data/test.yaml": getTestSchema,
  // "docs/sites.yml": getSitesSchema,
}

export const validateYaml = async () => {
  return Promise.all(
    Object.entries(fileSchemas).map(async ([filePath, schemaFn]) => {
      if (!(danger.git.modified_files.includes(filePath))) {
        return
      }
      const textContent = await danger.github.utils.fileContents(filePath)
      try {
        const content = yamlLoad(textContent)
        const result = Joi.validate(content, await schemaFn(), { abortEarly: false})
        if (result.error) {
          fail(`${filePath} didn't pass validation:\n${result.error}`)
        }
      } catch (e) {
        fail(`${filePath} is not valid:\n${e.message}`)
      }
    })
  )
};

export default async () => {
  return validateYaml()
};