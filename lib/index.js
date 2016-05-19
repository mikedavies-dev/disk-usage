const fsp = require('fs-promise')
const moment = require('moment')
const Path = require('path')
const series = require('promise-series2')

const getTLD = (path) => {
  const parts = Path.parse(path)
  return parts.dir.split(Path.sep)[1]
}

const relativePath = (path) => {
  return Path.relative(process.cwd(), path)
}

const getGroup = (group, path, fileInfo, state) => {
  switch (group) {

    case 'extension':
      return Path.extname(path) || '<none>'

    case 'modified':
      return moment(fileInfo.mtime).format('YYYY-MM-DD')

    case 'created':
      return moment(fileInfo.birthtime).format('YYYY-MM-DD')

    case 'tld':
    default:
      console.log(relativePath(path))
      return getTLD(path)
  }
}

const scanDirectory = (path, args, accumulator, state) => {
  if (args.onProgress) {
    args.onProgress(relativePath(path), accumulator)
  }
  return fsp.readdir(path).then((contents) => {
    return series((file) => {
      return scanEntry(Path.join(path, file), args, accumulator, state)
    }, contents)
  })
}

const scanFile = (path, fileInfo, args, accumulator, state) => {
  const group = getGroup(args.group, path, fileInfo, state)

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

const scanEntry = (path, args, accumulator, state) => {
  return fsp.stat(path).then((fileInfo) => {
    if (fileInfo.isDirectory()) {
      return scanDirectory(path, args, accumulator, state)
    } else {
      return scanFile(path, fileInfo, args, accumulator, state)
    }
  })
}

const scan = (args) => {
  const accumulator = {}
  const state = {
    path: []
  }
  return scanEntry(
    args.path,
    args,
    accumulator,
    state)
  .then(() => {
    return accumulator
  })
}

exports.scan = scan
