#!/usr/bin/env node
import { main } from '../src/main.mjs'

main(process.argv.slice(2)).then(
  (code) => process.exit(typeof code === 'number' ? code : 0),
  (err) => {
    console.error(`owlpane: ${err.message}`)
    process.exit(2)
  },
)
