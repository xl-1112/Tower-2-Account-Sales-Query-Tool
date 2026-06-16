import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const errors = []
const notes = []

function fail(message) {
  errors.push(message)
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath)
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
  } catch (error) {
    fail(`${relativePath}: invalid or unreadable JSON (${error.message})`)
    return null
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function unique(values) {
  return new Set(values).size === values.length
}

function validateJavaScript(directory) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) validateJavaScript(fullPath)
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue
    const result = spawnSync(process.execPath, ['--check', fullPath], { encoding: 'utf8' })
    if (result.status !== 0) {
      fail(`${path.relative(root, fullPath)}: JavaScript syntax check failed\n${result.stderr.trim()}`)
    }
  }
}

const app = readJson('app.json')
readJson('page-meta.json')
readJson('project.config.json')

const skills = app?.agent?.skills
if (!Array.isArray(skills) || skills.length === 0) {
  fail('app.json: agent.skills must contain at least one skill')
}

for (const declaration of skills || []) {
  const skillPath = declaration.path
  if (!skillPath || typeof skillPath !== 'string') {
    fail('app.json: every agent skill requires a string path')
    continue
  }

  const requiredFiles = ['SKILL.md', 'mcp.json', 'index.js']
  for (const file of requiredFiles) {
    if (!exists(path.join(skillPath, file))) fail(`${skillPath}: missing ${file}`)
  }
  if (!exists(path.join(skillPath, 'apis'))) fail(`${skillPath}: missing apis directory`)

  const mcp = readJson(path.join(skillPath, 'mcp.json'))
  const indexPath = path.join(root, skillPath, 'index.js')
  if (!mcp || !fs.existsSync(indexPath)) continue

  const source = fs.readFileSync(indexPath, 'utf8')
  const createSkillMatch = source.match(/createSkill\(['"]([^'"]+)['"]\)/)
  if (!createSkillMatch) {
    fail(`${skillPath}/index.js: createSkill(path) was not found`)
  } else if (createSkillMatch[1].replace(/^\//, '') !== skillPath.replace(/^\//, '')) {
    fail(`${skillPath}/index.js: createSkill path does not match app.json (${createSkillMatch[1]})`)
  }

  const registeredNames = [...source.matchAll(/registerAPI\(['"]([^'"]+)['"]/g)].map(match => match[1])
  const declaredApis = Array.isArray(mcp.apis) ? mcp.apis : []
  const declaredNames = declaredApis.map(api => api.name)

  if (!unique(registeredNames)) fail(`${skillPath}/index.js: duplicate registerAPI names`)
  if (!unique(declaredNames)) fail(`${skillPath}/mcp.json: duplicate API names`)

  for (const name of registeredNames.filter(name => !declaredNames.includes(name))) {
    fail(`${skillPath}: registered API is missing from mcp.json: ${name}`)
  }
  for (const name of declaredNames.filter(name => !registeredNames.includes(name))) {
    fail(`${skillPath}: declared API is not registered: ${name}`)
  }

  const components = Array.isArray(mcp.components) ? mcp.components : []
  const componentPaths = components.map(component => component.path)
  if (!unique(componentPaths)) fail(`${skillPath}/mcp.json: duplicate component paths`)

  for (const api of declaredApis) {
    if (!api.name || typeof api.description !== 'string') {
      fail(`${skillPath}/mcp.json: every API needs name and description`)
    }
    if (!api.inputSchema || api.inputSchema.type !== 'object') {
      fail(`${skillPath}/mcp.json: ${api.name} inputSchema must be an object schema`)
    }
    const componentPath = api?._meta?.ui?.componentPath
    if (componentPath && !componentPaths.includes(componentPath)) {
      fail(`${skillPath}/mcp.json: ${api.name} references undeclared component ${componentPath}`)
    }
  }

  for (const component of components) {
    if (!component.path) {
      fail(`${skillPath}/mcp.json: component path is required`)
      continue
    }
    const base = path.join(skillPath, component.path)
    for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
      if (!exists(base + extension)) fail(`${base}${extension}: missing component file`)
    }
    if (!component.relatedPage || !component.relatedPage.startsWith('/')) {
      fail(`${skillPath}/mcp.json: ${component.path} requires an absolute relatedPage`)
    } else {
      const pageBase = component.relatedPage.slice(1)
      if (!exists(pageBase + '.js')) fail(`${component.relatedPage}: related page JavaScript file is missing`)
    }
  }

  notes.push(`${skillPath}: ${declaredNames.length} APIs, ${components.length} components`)
}

validateJavaScript(path.join(root, 'skills'))
validateJavaScript(path.join(root, 'pages'))
validateJavaScript(path.join(root, 'packageDetail'))

for (const note of notes) console.log(`OK ${note}`)

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Validation passed')
