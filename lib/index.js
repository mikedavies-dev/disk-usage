const fsp = require('fs-promise')
const moment = require('moment')
const Path = require('path')
const R = require('ramda')
const series = require('promise-series2')

const sortFields = [
  'files',
  'size',
  'directories'
]

const groupFields = [
  'tld',
  'extension',
  'path',
  'modified',
  'created'
]

const folderGroups = [
  'tld',
  'path'
]

const error = (args, err) => {
  if (args.onError) {
    args.onError(err)
  }
}

const getGroup = (group, path, fileInfo, paths) => {
  switch (group) {

    case 'extension':
      return Path.extname(path) || '<none>'

    case 'modified':
      return moment(fileInfo.mtime).format('YYYY-MM-DD')

    case 'created':
      return moment(fileInfo.birthtime).format('YYYY-MM-DD')

    case 'path':
      if (paths.length === 1) {
        return paths[0]
      }
      return Path.join.apply(null, R.dropLast(1, paths))

    case 'tld':
    default:
      return paths[0]
  }
}

const scanDirectory = (path, args, accumulator, paths) => {
  if (args.onProgress) {
    args.onProgress(Path.relative(process.cwd(), path), accumulator)
  }
  return fsp.readdir(path).then((contents) => {
    return series((file) => {
      return scanEntry(
        Path.join(path, file),
        args,
        accumulator,
        paths.concat(file))
    }, contents)
  })
  .catch((err) => {
    error(args, err.message)
  })
}

const scanEntry = (path, args, accumulator, paths) => {
  return fsp.lstat(path).then((fileInfo) => {
    // don't process symbolic links
    if (fileInfo.isSymbolicLink()) {
      return
    }

    // don't log the top level dir
    if (paths.length) {
      const group = getGroup(args.group, path, fileInfo, paths)

      if (!accumulator.hasOwnProperty(group)) {
        accumulator[group] = {
          group: group,
          size: 0,
          files: 0,
          directories: 0,
          isDirectory: folderGroups.find((grp) => grp === args.group) && fileInfo.isDirectory()
        }
      }

      const stats = accumulator[group]

      if (fileInfo.isDirectory()) {
        stats.directories++
      } else {
        stats.files++
        stats.size += fileInfo.size
      }
    }

    if (fileInfo.isDirectory()) {
      return scanDirectory(path, args, accumulator, paths)
    }
  })
  .catch((err) => {
    error(args, err.message)
  })
}

const validateArgs = (args) => {
  if (!sortFields.find((f) => args.sort === f)) {
    throw new Error(`Invalid sort field '${args.sort}', possible values are '${sortFields.join(', ')}'`)
  }

  if (!groupFields.find((f) => args.group === f)) {
    throw new Error(`Invalid group field '${args.group}', possible values are '${groupFields.join(', ')}'`)
  }
}

const scan = (args) => {
  validateArgs(args)
  const accumulator = {}

  return scanEntry(
    args.path,
    args,
    accumulator,
    [])
  .then(() => {
    return accumulator
  })
}

module.exports = {
  scan,
  validateArgs
}
