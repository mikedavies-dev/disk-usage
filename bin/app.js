#!/usr/bin/env node

require('colors')

const bytes = require('bytes')
const commandLineArgs = require('command-line-args')
const getUsage = require('command-line-usage')
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
    const process = processResults(args)
    const totalFiles = total('files')(stats)
    const totalSize = total('size')(stats)
    const toDisplay = process(stats)

    const maxGroupLen = R.compose(
      R.min(80),
      R.add(3),
      R.reduce(R.max, 0),
      R.map((l) => l.length),
      R.map(R.prop('group'))
    )

    const colLen = maxGroupLen(toDisplay)

    const table = new Table2({
      head: [
        'Group'.bold.cyan,
        'Size'.bold.cyan,
        '% Size'.bold.cyan,
        'Files'.bold.cyan
      ],
      colWidths: [colLen, 10, 10, 10],
      colAligns: ['left', 'right', 'right', 'right'],
      style: {
        compact: true,
        'padding-left': 1
      }
    })

    process(stats).forEach((stat) => {
      table.push([
        stat.group,
        bytes(stat.size, { fixedDecimals: false }),
        ((stat.size / totalSize) * 100).toFixed(2) + '%',
        stat.files
      ])
    })

    const toBold = (input) => String(input).bold
    table.push([])
    table.push([
      '',
      toBold(bytes(totalSize, { fixedDecimals: false })),
      toBold('100%'),
      toBold(totalFiles)
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
      spinner.setSpinnerTitle(`%s Scanning: ${truncateString(path, 60)}..`)
    }
    args.onError = (err) => {
      spinner.stop(true)
      log(err)
      spinner.start()
    }

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
