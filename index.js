#!/usr/bin/env node
const glob = require('glob')
const { planaria } = require("neonplanaria")
const fs = require('fs');
const path = require('path');
const sqliteBridge = require('./sqlite-bridge')
const chaindir = process.cwd() + "/eventchain"
const log = function(msg) {
  return new Promise(function(resolve, reject) {
    fs.appendFile(chaindir + "/chain.txt", msg, function(err) {
      resolve();
    })
  })
}
const validate = function(config, vmode) {
  let errors = [];
  if (!config.eventchain && vmode !== "build") {
    errors.push("requires an \"eventchain\": 1 key pair")
  }
  if (!config.name && vmode !== "build") {
    errors.push("requires a \"name\" attribute")
  }
  if (config.q) {
    let keys = Object.keys(config.q)
    if (keys.length > 0) {
      // keys must be either 'find' or 'project'
      keys.forEach(function(key) {
        if (!["find", "project"].includes(key)) {
          errors.push("\"q\" currently supports only \"find\" and \"project\"")
        }
      })
    } else {
      errors.push("\"q\" should have \"find\" attribute");
    }
  } else {
    errors.push("requires a 'q' attribute")
  }
  return errors;
}
const start = function() {
  glob(process.cwd() + "/*.json", async function(er, files) {
    let configs = files.map(function(f) {
      return require(f)
    }).filter(function(f) {
      return f.eventchain
    })
    if (configs.length === 0) {
      console.log("EVENTCHAIN", "Couldn't find a JSON file with an 'eventchain' attribute")
      process.exit();
      return;
    }
    if (configs.length > 1) {
      console.log("EVENTCHAIN", "Only one config JSON supported per Eventchain.")
      process.exit();
      return;
    }
    let config = configs[0];
    let v = validate(config)
    if (v.length > 0) {
      console.log(v.join("\n"))
      process.exit();
    }
    planaria.start({
      filter: config,
      onmempool: async function(e) {
        await log("ONMEMPOOL " + Date.now() + " " + e.tx.tx.h + " " + JSON.stringify(e.tx) + "\n")
        await sqliteBridge.store('ONMEMPOOL', [e.tx])
      },
      onblock: async function(e) {
        if (e.tx.length > 0) {
          await log("ONBLOCK " + Date.now() + " " + e.tx[0].blk.h + " " + JSON.stringify(e.tx) + "\n")
          await sqliteBridge.store('ONBLOCK', e.tx)
        }
      },
      onstart: async function(e) {
        if (!fs.existsSync(chaindir)) {
          fs.mkdirSync(chaindir)
        }
        return await sqliteBridge.open(path.join(chaindir, 'chain.sqlite'), config.q)
      },
    })
  })
}
if (process.argv.length > 2) {
  let cmd = process.argv[2].toLowerCase();
  if (cmd === 'rewind') {
  } else if (cmd === 'start') {
    start();
  } else if (cmd === 'serve') {
  } else if (cmd === 'whoami') {
  } else if (cmd === 'ls') {
  }
}

module.exports = start