#!/usr/bin/env node

require('colors')

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

const processResults = (args) => {
  const process = R.compose(
    R.take(args.count),
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
    const getResults = processResults(args)
    const totalFiles = total('files')(stats)
    const totalSize = total('size')(stats)
    const totalDirs = total('directories')(stats)
    const toDisplay = getResults(stats)

    const formatLargeNumber = (num) => num < 9999 ? num : numeral(num).format('0.00a')
    const colLen = process.stdout.columns - (50)

    const table = new Table2({
      head: [
        args.group.bold.cyan,
        'size'.bold.cyan,
        '% size'.bold.cyan,
        'files'.bold.cyan,
        'dirs'.bold.cyan
      ],
      colWidths: [colLen, 11, 9, 10, 10],
      colAligns: ['left', 'right', 'right', 'right', 'right'],
      style: {
        compact: true,
        'padding-left': 1
      }
    })

    toDisplay.forEach((stat) => {
      table.push([
        stat.group,
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

    log()
    log(table.toString())
    log()
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
