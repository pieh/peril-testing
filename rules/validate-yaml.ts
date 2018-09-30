import { danger, message, fail } from 'danger';
import { load as yamlLoad } from 'js-yaml'
import * as Joi from 'joi'
import * as path from 'path'

const supportedImageExts = ['.jpg', '.jpeg']

interface SuppertedExtensionArgs {
  q: string[]
}

interface FileExistsArgs {
  q: string[]
}

const getExistingFiles = async (path, base) => {
  const [owner, repo] = danger.github.pr.head.repo.full_name.split('/')
  const imagesDirReponse = await danger.github.api.repos.getContent({repo, owner, path})
  const files = imagesDirReponse.data.map(({ name }) => `${base}/${name}`)
  return files
}

const customJoi = Joi.extend((joi: any) => ({
  base: joi.string(),
  name: 'string',
  language: {
    supportedExtension: 'need to use supported extension {{q}}',
    fileExists: 'need to point to existing file'
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
    {
      name: 'fileExists',
      params: {
        q: joi.array().items(joi.string())
      },
      validate(params: FileExistsArgs, value, state, options): Promise<any> {
        if (!params.q.includes(value)) {
          return this.createError('string.fileExists', { v: value, q: params.q }, state, options)
        }

        return value
      }
    }
  ]
}))

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
      plugins: Joi.string()
    })
  )
}

const getCreatorsSchema = async () => {
  return Joi.array().items(
    Joi.object().keys({
      name: Joi.string().required(),
      type: Joi.string().valid(['individual', 'agency', 'company']).required(),
      description: Joi.string(),
      location: Joi.string(),
      // need to explicitely allow `null` to not fail on github: null fields
      github: Joi.string().allow(null),
      website: Joi.string(),
      for_hire: Joi.boolean(),
      portfolio: Joi.boolean(),
      hiring: Joi.boolean(),
      image: customJoi.string().supportedExtension(supportedImageExts).fileExists(await getExistingFiles('docs/community/images', 'images')).required()
    })
  )
}

const getAuthorsSchema = async () => {
  return Joi.array().items(
    Joi.object().keys({
      id: Joi.string().required(),
      bio: Joi.string().required(),
      avatar: customJoi.string().supportedExtension(supportedImageExts).fileExists(await getExistingFiles('docs/blog/avatars', 'avatars')).required(),
      twitter: Joi.string(),
    })
  )
}

const fileSchemas = {
  "docs/sites.yml": getSitesSchema,
  "docs/community/creators.yml": getCreatorsSchema,
  "docs/blog/author.yaml": getAuthorsSchema,
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
          })

          const errors = Object.entries(customErrors).map(([index, errors]: [string, string[]])=> {
            
            if (index === 'root') {
              return errors.map(msg => ` - ${msg}`).join('\n')
            } else {
              const errorsString = errors.map(msg => `  - ${msg}`).join('\n')
              return `- \`\`\`json\n${JSON.stringify(content[index], null, 2).split('\n').map(line => `  ${line}`).join('\n')}\n  \`\`\`\n  **Errors**:\n${errorsString}`
            }
          })

          fail(`## ${filePath} didn't pass validation:\n\n${errors.join('\n---\n')}`)
        }
      } catch (e) {
        fail(`## ${filePath} is not valid YAML file:\n\n\`\`\`${e.message}\n\`\`\``)
      }
    })
  )
};

export default async () => {
  return validateYaml()
};