# Eventchain-sqlite

> An eventchain to sqlite bridge.

Eventchain-sqlite extends [Eventchain](https://github.com/interplanaria/eventchain) by storing query results in
an sqlite database.

# Install

> npm install -g eventchain-sqlite

# Usage

See [Eventchain](https://github.com/interplanaria/eventchain) for details on how to configure and run eventchain. 

Run eventchain-sqlite:

> echain-sqlite start

Eventchain-sqlite will create an `eventchain/chain.sqlite` file containing the sqlite database.

# Schema

Eventchain receives [TXO](https://github.com/interplanaria/txo) transaction objects from Planaria. A TXO object contains information about the transaction, the block, the inputs and outputs.

Eventchain-sqlite creates the database `eventchain/chain.sqlite` with the following tables:

```
in
out
```

The `in` and `out` tables represent the inputs and outputs from a transaction. Each table has the same base schema:

```sql
type VARCHAR ('ONMEMPOOL' or 'ONBLOCK')
timestamp VARCHAR
txid VARCHAR
blockindex VARCHAR
```

In addition to the base columns, eventchain-sqlite will create columns for each of the project properties in the query.

The following `event.json` config file will generate the columns below:

```javascript
{
  "eventchain": 1,
  "name": "metanet",
  "from": 587000,
  "q": {
    "find": { "out.h1": "6d657461" },
    "project": { "in.e.a": 1, "out.s2": 1, "out.s3": 1, "out.s4": 1, "out.s8": 1 }
  }
}
```

Columns created:

```sql
in.e.a VARCHAR
out.s2 VARCHAR
out.s3 VARCHAR
out.s4 VARCHAR
out.s8 VARCHAR
```

You can then create queries such as: 

```sql
SELECT * from [out] WHERE [out.s4] = 'My metanet node';
```

The square brackets help with the unconventional column and table naming.

If the `chain.sqlite` file is deleted it will be recreated. However, it will only receive new transactions, if you want all of the previous transactions you will also need to delete the `chain.txt` and `tape.txt` files.

