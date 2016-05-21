#!/usr/bin/env node

const colors = require('colors')
const commandLineArgs = require('command-line-args')
const getUsage = require('command-line-usage')
const numeral = require('numeral')
const R = require('ramda')
const scanner = require('../lib/index.js')
const Spinner = require('cli-spinner').Spinner
const Table2 = require('cli-table')

const programArgs = [
  {
    name: 'group',
    alias: 'g',
    type: String,
    defaultValue: 'tld',
    description: 'Which field the results grouped by'
  },
  {
    name: 'sort',
    alias: 's',
    type: String,
    defaultValue: 'size',
    description: 'Which field the results should be sorted by'
  },
  {
    name: 'count',
    alias: 'c',
    type: Number,
    defaultValue: 15,
    description: 'Number of results to display'
  },
  {
    name: 'path',
    alias: 'p',
    type: String,
    defaultOption: true,
    description: 'System path to start scanning'
  },
  {
    name: 'reverse',
    alias: 'r',
    type: Boolean,
    description: 'Reverse the results'
  },
  {
    name: 'show-files',
    alias: 'f',
    type: Boolean,
    description: 'Only show files (hide directories)'
  },
  {
    name: 'show-directories',
    alias: 'd',
    type: Boolean,
    description: 'Only show directories (hide files)'
  },
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Display this help page'
  }
]

const cli = commandLineArgs(programArgs)
const log = console.log

const abort = (msg) => {
  log(msg)
  log()
  process.exit(-1)
}

const filterDirectoriesOrFiles = (args) => {
  return (stat) => {
    if (args['show-files']) {
      return !stat.isDirectory
    }
    if (args['show-directories']) {
      return stat.isDirectory
    }
    return true
  }
}

const processResults = (args) => {
  const process = R.compose(
    R.take(args.count),
    R.filter(filterDirectoriesOrFiles(args)),
    R.reverse,
    R.sortBy(R.prop(args.sort)),
    R.values
  )

  if (args.reverse) {
    return R.compose(R.reverse, process)
  } else {
    return process
  }
}

const printStats = (args, stats) => {
  const total = (field) => {
    return R.compose(
      R.sum,
      R.map(R.prop(field)),
      R.values
    )
  }

  try {
    const formatLargeNumber = (num) => num < 9999 ? num : numeral(num).format('0.00a')

    const getResults = processResults(args)
    const totalFiles = total('files')(stats)
    const totalSize = total('size')(stats)
    const totalDirs = total('directories')(stats)
    const toDisplay = getResults(stats)

    const colWidths = [11, 9, 10, 10]
    const colLen = (process.stdout.columns -
      R.compose(
        R.add(3),
        R.add(colWidths.length),
        R.sum
      )(colWidths)
    )

    const table = new Table2({
      head: [
        args.group.bold.cyan,
        'size'.bold.cyan,
        '% size'.bold.cyan,
        'files'.bold.cyan,
        'dirs'.bold.cyan
      ],
      colWidths: [colLen].concat(colWidths),
      colAligns: ['left', 'right', 'right', 'right', 'right'],
      style: {
        compact: true,
        'padding-left': 0
      }
    })

    const toRowText = (stat, text) => {
      if (stat.isDirectory) {
        return colors.blue.bold(text)
      }
      return text
    }

    toDisplay.forEach((stat) => {
      table.push([
        toRowText(stat, stat.group),
        numeral(stat.size).format('0.00b'),
        numeral(stat.size / totalSize).format('0.00%'),
        formatLargeNumber(stat.files),
        formatLargeNumber(stat.directories)
      ])
    })

    const toBold = (input) => String(input).bold
    table.push([])
    table.push([
      '',
      toBold(numeral(totalSize).format('0.00b')),
      toBold('100%'),
      toBold(formatLargeNumber(totalFiles)),
      toBold(formatLargeNumber(totalDirs))
    ])

    if (toDisplay.length) {
      log()
      log(table.toString())
      log()
    }
  } catch (ex) {
    abort(ex.stack)
  }
}

const truncateString = (str, len) => {
  if (str.length <= len) {
    return str
  }
  return '...' + str.substr(str.length - len, str.length)
}

const printUsage = () => {
  const options = {
    header: 'Disk usage utility',
    synopsis: [
      '$ disk-usage [[bold]{--sort} [underline]{size}] [[bold]{--group} [underline]{group}] [underline]{path}',
      '$ dusk-usage [bold]{--help}'
    ]
  }
  log(getUsage(programArgs, options))
}

const parseArgs = () => {
  try {
    const args = cli.parse()
    if (args.help || !args.path) {
      printUsage()
      return null
    }
    scanner.validateArgs(args)
    return args
  } catch (ex) {
    abort(ex.message)
  }
  return null
}

const main = () => {
  try {
    const args = parseArgs()
    if (!args) {
      return
    }

    const spinner = new Spinner('%s Starting..')
    spinner.setSpinnerString(19)
    spinner.start()
    args.onProgress = (path, accumulator) => {
      const cols = process.stdout.columns
      spinner.setSpinnerTitle(`%s Scanning: ${truncateString(path, cols - 15)}`)
    }
    args.onError = (err) => {
      spinner.stop(true)
      log(err)
      spinner.start()
    }

    process.stdout.on('resize', () => {
      spinner.stop(true)
      spinner.start()
    })

    scanner
      .scan(args)
      .then((stats) => {
        spinner.stop(true)
        printStats(args, stats)
      })
      .catch((ex) => {
        spinner.stop(true)
        abort(ex.stack)
      })
  } catch (ex) {
    abort(ex.stack)
  }
}

main()
