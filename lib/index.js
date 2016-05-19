const fsp = require('fs-promise')
const moment = require('moment')
const Path = require('path')
const series = require('promise-series2')

const relativePath = (path) => {
  return Path.relative(process.cwd(), path)
}

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

    case 'directory':
      if (paths.length === 1) {
        return paths[0]
      }
      return Path.join.apply(null, paths.splice(0, paths.length - 2))

    case 'tld':
    default:
      return paths[0]
  }
}

const scanDirectory = (path, args, accumulator, paths) => {
  if (args.onProgress) {
    args.onProgress(relativePath(path), accumulator)
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

const scanFile = (path, fileInfo, args, accumulator, paths) => {
  const group = getGroup(args.group, path, fileInfo, paths)

  if (!accumulator.hasOwnProperty(group)) {
    accumulator[group] = {
      group: group,
      size: 0,
      files: 0
    }
  }

  const stats = accumulator[group]
  stats.size += fileInfo.size
  stats.files++
}

const scanEntry = (path, args, accumulator, paths) => {
  return fsp.lstat(path).then((fileInfo) => {
    // don't process symbolic links
    if (fileInfo.isSymbolicLink()) {
      return
    }
    if (fileInfo.isDirectory()) {
      return scanDirectory(path, args, accumulator, paths)
    } else {
      return scanFile(path, fileInfo, args, accumulator, paths)
    }
  })
  .catch((err) => {
    error(args, err.message)
  })
}

const scan = (args) => {
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

exports.scan = scan
