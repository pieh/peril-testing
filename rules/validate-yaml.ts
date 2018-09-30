import { danger, message, fail } from 'danger';
import { load as yamlLoad } from 'js-yaml'
import * as Joi from 'joi'
import * as path from 'path'

const supportedExts = ['.txt']

const getSitesSchema = () => {
  return Joi.array().items(
    Joi.object().keys({
      title: Joi.string().required(),
      url: Joi.string().required(),
      main_url: Joi.string().required(),
      source_url: Joi.string(),
      description: Joi.string(),
      categories: Joi.array().items(Joi.string()),
      built_by: Joi.string(),
      built_by_url: Joi.string(),
      featured: Joi.boolean(),
      date_added: Joi.string(),
      gatsby_version: Joi.string(),
      plugins: Joi.array().items(Joi.string()),
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
  "docs/sites.yml": getSitesSchema,
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
          const customErrors = {}
          result.error.details.forEach(detail => {
            if (detail.path.length > 0) {
              const index = detail.path[0]
              if (!customErrors[index]) {
                customErrors[index] = []
              }
              customErrors[index].push(detail.message)
            } else {
              customErrors['root'] = [
                detail.message
              ]
            }
            console.log(detail)
          })

          const errors = Object.entries(customErrors).map(([index, errors]: [string, string[]])=> {
            if (index === 'root') {
              return errors.join('\n')
            } else {
              return `Entry:\n${JSON.stringify(content[index], null, 2)}\nfailed validation:\n${errors.join('\n')}`
            }
          })

          fail(`${filePath} didn't pass validation:\n${errors.join('\n\n')}`)
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