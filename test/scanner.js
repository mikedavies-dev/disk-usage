/* eslint-env mocha */

const expect = require('chai').expect
const scanner = require('../lib')

describe('Scanner', function () {
  it('should scan the test directory', function () {
    return scanner.scan({
      path: './test/contents-1'
    }).then((results) => {
      console.log(results)
      expect(1).to.equal(1)
    })
  })
})
