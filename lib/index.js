const fsp = require('fs-promise')
const moment = require('moment')
const Path = require('path')
const series = require('promise-series2')

const relativePath = (path) => {
  return Path.relative(process.cwd(), path)
}

const getTLD = (path) => {
  const relative = relativePath(path)
  const parts = Path.parse(relative)
  const paths = parts.dir.split(Path.sep)

  for (var i = 0; i < paths.length; i++) {
    switch (paths[i]) {
      case '.':
      case '..':
        continue

      default:
        return paths[i]
    }
  }
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
