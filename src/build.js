const fs = require('fs').promises
const camelcase = require('camelcase')
const { promisify } = require('util')
const rimraf = promisify(require('rimraf'))
const svgr = require('@svgr/core').default
const babel = require('@babel/core')
const { compile: compileVue } = require('@vue/compiler-dom')
const path = require('path')

const transformVue = (svg) => {
  let { code } = compileVue(svg, {
    mode: 'module',
  })

  return code.replace('export function', 'export default function')
}

async function getIcons(style) {
  let files = await fs.readdir(`./dist/icons/${style}`)
  return Promise.all(
    files.map(async (file) => ({
      svg: await fs.readFile(`./dist/icons/${style}/${file}`, 'utf8'),
      componentName: `${camelcase(file.replace(/\.svg$/, ''), {
        pascalCase: true,
      })}Icon`,
    }))
  )
}

function exportAll(icons, includeExtension = true) {
  return icons.map(({ componentName }) => {
    let extension = includeExtension ? '.js' : ''
    return `export { default as ${componentName} } from './${componentName}${extension}'`
  }).join('\n')
}

async function ensureWrite(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, text, 'utf8')
}

async function ensureWriteJson(file, json) {
  await ensureWrite(file, JSON.stringify(json, null, 2))
}

async function buildIcons(style) {
  let outDir = `./dist/${style}`
  let icons = await getIcons(style)

  await Promise.all(
    icons.flatMap(async ({ componentName, svg }) => {
      let content = await transformVue(svg)
      let types = `import type { FunctionalComponent, HTMLAttributes, VNodeProps } from 'vue';\ndeclare const ${componentName}: FunctionalComponent<HTMLAttributes & VNodeProps>;\nexport default ${componentName};\n`

      return [
        ensureWrite(`${outDir}/${componentName}.js`, content),
        ...(types ? [ensureWrite(`${outDir}/${componentName}.d.ts`, types)] : []),
      ]
    })
  )

  await ensureWrite(`${outDir}/index.js`, exportAll(icons))
  await ensureWrite(`${outDir}/index.d.ts`, exportAll(icons, false))
}

async function main() {
  const esmPackageJson = { type: 'module', sideEffects: false }

  console.log(`Building package...`)

  await Promise.all([
    rimraf(`./dist/outline/*`),
    rimraf(`./dist/roles/*`),
    rimraf(`./dist/socials/*`),
    rimraf(`./dist/solid/*`)
  ])

  await Promise.all([
    buildIcons('outline'),
    buildIcons('roles'),
    buildIcons('socials'),
    buildIcons('solid'),

    ensureWriteJson(`./dist/outline/package.json`, esmPackageJson),
    ensureWriteJson(`./dist/roles/package.json`, esmPackageJson),
    ensureWriteJson(`./dist/socials/package.json`, esmPackageJson),
    ensureWriteJson(`./dist/solid/package.json`, esmPackageJson),
  ])

  return console.log(`Finished building package.`)
}

main()
