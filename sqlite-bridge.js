const sqlite = require('sqlite')

class SqliteBridge {

  /**
   * Opens the database and creates any tables and columns required by the query.
   * @param {string} path Path to database file e.g. 'eventchain/chain.sqlite'
   * @param {object} query Query from the config file (e.g. config.q)
   */
  async open(path, query) {
    this.db = await sqlite.open(path)
    await this.syncColumns(query)
  }

  /**
   * Ensures that the table has the 'project' columns of the query.
   * Old columns are not deleted. Creates the table if it doesn't exist yet.
   * @param {string} query 
   */
  async syncColumns(query) {
    if (!query.project) {
      throw 'Query must have a "project" property to add columns to the table.'
    }

    const keys = Object.keys(query.project)
    this.hasInputs = !!keys.find(k => k.startsWith('in.'))
    this.hasOutputs = !!keys.find(k => k.startsWith('out.'))

    await this.createTable('in', query)
    await this.createTable('out', query)
  }

  /**
   * Used to create the input and output tables which have the same schema.
   * @param {string} name 'in' or 'out'.
   */
  async createTable(name, query) {
    // Check if table exists
    const result = await this.db.all(`PRAGMA table_info('${name}')`)
    const existingColumns = result.map(c => c.name)
    if (existingColumns.length == 0) {
      // Create table
      const columns = ['type', 'timestamp', 'blockindex', 'txid']
      await this.db.run(`CREATE TABLE '${name}' (${columns.map(c => `${c} VARCHAR`)})`)
      for (const column of columns) {
        await this.db.run(`CREATE INDEX 'idx_${column}' ON '${name}'('${column}')`)
      }
    }

    // Only process keys that start with the name of the table, e.g. "in.", "out."
    const keys = Object.keys(query.project).filter(key => key.startsWith(name + '.'))

    // Only add columns that don't exist yet
    const newColumns = keys.filter(c => !existingColumns.includes(c))

    // Add the columns and create indexes for every column
    for (const column of newColumns) {
      //console.log(`Adding column: ${column}`)
      await this.db.run(`ALTER TABLE '${name}' ADD COLUMN '${column}' VARCHAR`)
      //console.log(`Creating index for column: ${column}`)
      //await this.db.run(`CREATE INDEX 'idx_${column}' ON '${name}'('${column}')`)
    }
  }

  /**
   * Stores the transaction properties in the corresponding table columns.
   * @param {string} type either 'ONMEMPOOL' or 'ONBLOCK' (actually can be any string)
   * @param {array} txs array of TXO format objects https://github.com/interplanaria/txo
   */
  async store(type, txs) {
    for (const tx of txs) {
      if (this.hasInputs && tx.in) {
        await this.storeRecords(type, tx, 'in')
      }
      if (this.hasOutputs && tx.out) {
        await this.storeRecords(type, tx, 'out')
      }
    }
  }

  /**
   * Stores an input or output to the corresponding table.
   * @param {string} type either 'ONMEMPOOL' or 'ONBLOCK' (actually can be any string)
   * @param {TXO} tx https://github.com/interplanaria/txo
   * @param {string} table table name 'in' or 'out'
   */
  async storeRecords(type, tx, table) {
    let tableColumns = await this.db.all(`PRAGMA table_info('${table}')`)
    tableColumns = tableColumns.map(c => c.name)

    for (const input of tx[table]) {
      // Convert the children properties of input to a single property, e.g. "e" => "e.a"
      let columns = this.flatten(input)
      // Prepend with "in." or "out."
      columns.forEach(c => c.name = `${table}.${c.name}`)

      // Filter only columns that exist in the table
      columns = columns.filter(c => tableColumns.includes(c.name))

      // Add our own columns
      columns.push({name: 'type', value: type})
      columns.push({name: 'timestamp', value: Date.now().toString()})
      columns.push({name: 'txid', value: tx.tx.h})
      columns.push({name: 'blockindex', value: tx.blk.i})

      // Escape names (single quotes)
      const names = columns.map(c => `'${c.name}'`)
      const values = columns.map(c => c.value)
      const placeholders = columns.map(c => '?')
      let query = `INSERT INTO '${table}' (${names.join(',')}) VALUES (${placeholders.join(',')})`
      //console.log(`Running query: ${query}`)
      await this.db.run(query, values)
    }
  }

  /**
   * Convert the children properties of tx to a single property, e.g. "tx"."out"."s1" => "out.s1"
   * @param {object} obj object to flatten
   * @param {string} path will be the flatten property, leave empty 
   * @param {array} flat the flattened array, leave empty
   */
  flatten(obj, path = '', flat = []) {
    const keys = Object.keys(obj)
    for (const key of keys) {
      const value = obj[key]
      // If the value is an object then process the children
      if (typeof value === 'object') {
        this.flatten(value, path + key + '.', flat)
      } else {
        // Add child
        flat.push({name: path + key, value: value})
      }
    }
    return flat
  }
}

module.exports = new SqliteBridge()