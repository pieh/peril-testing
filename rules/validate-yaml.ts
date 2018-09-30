import { danger, message, fail } from 'danger';
import { load as yamlLoad } from 'js-yaml'
import * as Joi from 'joi'
import * as path from 'path'

const supportedImageExts = ['.jpg', '.jpeg']
const uriOptions = { scheme: [`https`, `http`] }

interface SuppertedExtensionArgs {
  q: string[]
}

interface FileExistsArgs {
  q: string[]
}

const getExistingFiles = async (path: string, base: string) => {
  const [owner, repo] = danger.github.pr.head.repo.full_name.split('/')
  const imagesDirReponse: { data: {name: string}[] } = await danger.github.api.repos.getContent({ repo, owner, path, ref: danger.github.pr.head.ref })
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
      validate(this: Joi.ExtensionBoundSchema, params: SuppertedExtensionArgs, value: string, state: any, options: any): any {
        // const that : Joi.ExtensionBoundSchema = this
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
      validate(this: Joi.ExtensionBoundSchema, params: FileExistsArgs, value: string, state: any, options: any): any {
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
      url: Joi.string().uri(uriOptions).required(),
      main_url: Joi.string().uri(uriOptions).required(),
      source_url: Joi.string().uri(uriOptions),
      description: Joi.string(),
      categories: Joi.array().items(Joi.string()),
      built_by: Joi.string(),
      built_by_url: Joi.string().uri(uriOptions),
      featured: Joi.boolean(),
      date_added: Joi.date(),
      gatsby_version: Joi.string(),
      plugins: Joi.string()
    })
  ).unique('title').unique('url')
}

const getCreatorsSchema = async () => {
  return Joi.array().items(
    Joi.object().keys({
      name: Joi.string().required(),
      type: Joi.string().valid(['individual', 'agency', 'company']).required(),
      description: Joi.string(),
      location: Joi.string(),
      // need to explicitely allow `null` to not fail on github: null fields
      github: Joi.string().uri(uriOptions).allow(null),
      website: Joi.string().uri(uriOptions),
      for_hire: Joi.boolean(),
      portfolio: Joi.boolean(),
      hiring: Joi.boolean(),
      image: customJoi.string().supportedExtension(supportedImageExts).fileExists(await getExistingFiles('docs/community/images', 'images')).required()
    })
  ).unique('name')
}

const getAuthorsSchema = async () => {
  return Joi.array().items(
    Joi.object().keys({
      id: Joi.string().required(),
      bio: Joi.string().required(),
      avatar: customJoi.string().supportedExtension(supportedImageExts).fileExists(await getExistingFiles('docs/blog/avatars', 'avatars')).required(),
      twitter: Joi.string().regex(/^@/),
    })
  ).unique('id')
}

const getStartersSchema = () => {
  return Joi.array().items(
    Joi.object().keys({
      url: Joi.string().uri(uriOptions).required(),
      repo: Joi.string().uri(uriOptions).required(),
      description: Joi.string(),
      tags: Joi.array().items(Joi.string()),
      features: Joi.array().items(Joi.string()),
      date: Joi.date()
    })
  )
}

const fileSchemas = {
  "docs/sites.yml": getSitesSchema,
  "docs/community/creators.yml": getCreatorsSchema,
  "docs/blog/author.yaml": getAuthorsSchema,
  "docs/starters.yml": getStartersSchema,
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
          const customErrors : { [id: string]: string[] } = {} 
          result.error.details.forEach(detail => {
            if (detail.path.length > 0) {
              const index = detail.path[0]
              if (!customErrors[index]) {
                customErrors[index] = []
              }

              let message = detail.message
              if (detail.type === 'array.unique' && detail.context) {
                // by default it doesn't say what field is not unique
                message = `"${detail.context.path}" is not unique`
              }

              customErrors[index].push(message)
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