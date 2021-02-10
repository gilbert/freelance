import path from 'path'
import cloneDeep from 'lodash/cloneDeep'
import set from 'lodash/set'
import { existsSync, promises as fs, statSync } from 'fs'

import { sourceDir } from './config'
import { requireLatest } from './lib/fs'

var isProd = process.env.NODE_ENV === 'production'
var matchHelper = require('posthtml-match-helper')

//
// <script> and <link> tag rewriting
//
type PostHtmlOptions = {
  resolveScript: (bundlePath: string) => string
  resolveStyle: (bundlePath: string) => string
}
export function posthtmlPlugin(options: PostHtmlOptions) {
  return function extendAttrs(tree: any) {
    tree.match(matchHelper('script[bundle]'), function(node: any) {
      node.attrs.src = options.resolveScript(node.attrs.bundle)
      delete node.attrs.bundle
      return node
    })

    tree.match(matchHelper('link[bundle]'), function(node: any) {
      node.attrs.href = options.resolveStyle(node.attrs.bundle)
      delete node.attrs.bundle
      return node
    })
  }
}

//
// Script bundling
//
var browserify = require('browserify')

export function bundleScript(file: string) {
  return new Promise(function (resolve, reject) {
    browserify(file).bundle(function (err: any, src: any) {
      if (err) return reject(err)
      resolve(src)
    })
  })
}


//
// Style bundling
//
const styleCache: Record<string, { mtimeMs: number, css: string }> = {}
const styleDepRecord: Record<string, { file: string, mtimeMs: number }[]> = {}

var postcss = (rootFile: string, twConfig: any) => require('postcss')([
  require("postcss-import")({
    path: [
      // Add this lib's node_modules so it can find tailwind
      path.join(__dirname, '../../node_modules')
    ],
    load(filename: string) {
      if (filename.startsWith(sourceDir) && existsSync(filename)) {
        styleDepRecord[rootFile]!.push({
          file: filename,
          mtimeMs: statSync(filename).mtimeMs,
        })
      }
      return require('postcss-import/lib/load-content')(filename)
    }
  }),
  require('tailwindcss')(
    // Build in some plugins
    set(cloneDeep(twConfig), 'plugins', (twConfig.plugins || []).concat([
      require('@tailwindcss/typography')
    ]))
  ),
  require('autoprefixer'),
])

export async function bundleStyle(file: string): Promise<string | null> {
  const twConfig = requireLatest(path.join(sourceDir, 'tailwind.config.js'))
  const styleStat = await fs.stat(file)
  const prev = styleCache[file]
  const deps = styleDepRecord[file]

  if (
    prev &&
    styleStat.mtimeMs - prev.mtimeMs === 0 &&
    !twConfig.fresh &&
    (
      !deps ||
      deps.every(dep => existsSync(dep.file) && statSync(dep.file).mtimeMs === dep.mtimeMs)
    )
  ) {
    return prev.css
  }
  const css = await fs.readFile(file, 'utf8')
  try {
    styleDepRecord[file] = []
    const result = await postcss(file, twConfig.module).process(css, {
      from: file,
      to: file,
      map: { inline: ! isProd },
    })
    styleCache[file] = {
      mtimeMs: styleStat.mtimeMs,
      css: result.css,
    }
    return result.css
  }
  catch(error) {
    if ( error.name === 'CssSyntaxError' ) {
      process.stderr.write(error.message + error.showSourceCode())
      return null
    } else {
      throw error
    }
  }
}
