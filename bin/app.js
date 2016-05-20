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

  const bold = (input) => {
    return String(input).bold
  }

  try {
    var table = new Table2({
      head: [
        'Group'.bold.cyan,
        'Size'.bold.cyan,
        '% Size'.bold.cyan,
        'Files'.bold.cyan
      ],
      colWidths: [60, 10, 10, 10],
      colAligns: ['left', 'right', 'right', 'right'],
      style: {
        compact: true,
        'padding-left': 1
      }
    })

    const process = processResults(args)

    const totalFiles = total('files')(stats)
    const totalSize = total('size')(stats)

    process(stats).forEach((stat) => {
      table.push([
        stat.group,
        bytes(stat.size, { fixedDecimals: true }),
        ((stat.size / totalSize) * 100).toFixed(2) + '%',
        stat.files
      ])
    })

    table.push([])
    table.push([
      '',
      bold(bytes(totalSize, { fixedDecimals: true })),
      bold('100%'),
      bold(totalFiles)
    ])

    console.log()
    console.log(table.toString())
    console.log()
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

    const spinner = new Spinner('%s Starting..')
    spinner.setSpinnerString(19)
    spinner.start()
    args.onProgress = (path, accumulator) => {
      spinner.setSpinnerTitle(`%s Scanning: ${truncateString(path, 60)}..`)
    }
    args.onError = (err) => {
      spinner.stop(true)
      console.log(err)
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
        console.log(ex.stack)
      })
  } catch (ex) {
    console.log(ex.stack)
    printUsage()
  }
}

main()
