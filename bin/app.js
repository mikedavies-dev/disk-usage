#!/usr/bin/env node

const bytes = require('bytes')
const commandLineArgs = require('command-line-args')
const getUsage = require('command-line-usage')
const R = require('ramda')
const scanner = require('../lib/index.js')
const Spinner = require('cli-spinner').Spinner
const Table = require('easy-table')

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

const padRight = (val, l, c) => {
  return val + Array(l - val.length + 1).join(c || ' ')
}

const cli = commandLineArgs(programArgs)

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
  try {
    const table = new Table()

    const process = processResults(args)

    process(stats).forEach((stat) => {
      table.cell('Group', stat.group, (val) => padRight(val, 60))
      table.cell('Files', stat.files, (val) => Table.padLeft(val, 10))
      table.cell('Size', stat.size, (val) => Table.padLeft(bytes(val, { fixedDecimals: true }), 10))
      table.newRow()
    })

    table.total('Size', {
      printer: (val) => Table.padLeft(bytes(val, { fixedDecimals: true }), 10)
    })
    table.total('Files')

    console.log(table.toString())
  } catch (ex) {
    console.log(ex.stack)
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
  console.log(getUsage(programArgs, options))
}

const main = () => {
  try {
    const args = cli.parse()
    if (args.help || !args.path) {
      return printUsage()
    }
    const spinner = new Spinner('starting..  %s')
    spinner.setSpinnerString('|/-\\')
    spinner.start()
    args.onProgress = (path, accumulator) => {
      spinner.setSpinnerTitle(`scanning: ${truncateString(path, 60)}.. %s`)
    }

    scanner
      .scan(args)
      .then((stats) => {
        spinner.stop(true)
        printStats(args, stats)
      })
      .catch((ex) => {
        spinner.stop(true)
        console.log(ex.stack)
      })
  } catch (ex) {
    console.log(ex.message)
    printUsage()
  }
}

main()
