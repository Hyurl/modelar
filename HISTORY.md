**This update log starts from the version 1.0.2 of Modelar.**

## 3.1.5

1. Support ES6 `tagged template` string, add tags `i` and `s` to produce 
    Identifier and Statement objects.

## 3.1.0

1. Add `model.throwNotFoundError` to control whether the model should throw 
    error when fetching data failed.
2. When define a model class, now you can define model configs via setting 
    properties to `this` (e.g. `this.table = 'users'`), instead of putting 
    them in the `super()` constructor.

## 3.0.4

1. Fix bug in `db.transation()`, now it can automatically open the connection.
2. Fix bug in `query.union()`, it now concatenates the binding parameters when
    passing a Query instance.
3. Fix a bug in `query.getSelectSQL()` with having clause.
4. `new Query()` and `query.from()` now can bind several tables.
5. `query.join()`, `query.leftJoin()` etc. now support additional styles when
    calling.
6. Add `query.field()` to keep a value as a field used in where and join 
    contexts.
7. Fix bug in inheritance hierarchy.
8. Add `model.wherePivot()` to more friendly fetching associative models.
9. Support NodeJS versions lower than 6.0.
10. More friendly docs for JavaScript users.
11. `postgres` adapter no longer included by default.
12. No longer support old iterator style.
13. Fix a bug in creating table with foreign keys.
14. `export default Model` for TypeScript.

## 3.0.2

(2018-3-30 14:14 UTC+0800)

1. `DBConfig` now allows extra properties for adapters.
2. `DBConfig.connectionString` is supported now, when set, `db.dsn` will 
    return it instead.

## 3.0.0 (**Important**)

1. Rewrite using TypeScript.
2. Events, DB Configurations and adapters will be inherited through the 
    hierarchical tree.
3. Add methods: `db.set()` and `db.prop()`, remove method `query.table()`.
4. Change some properties:

    1. `db._dsn` to `db.dsn`;
    2. `db._command` to `db.command`;
    3. `db._config` to `db.comfig`;
    4. `db._data` to `db.data`;
    5. `model._extra` to `model.extra`;
    6. `user._loginable` tp `User.loginable`.
    
    Old instance properties still can be used, but it's highly deprecated.

## 2.0.1

(2018-01-9 22:03 UTC+0800)

1. Fix a bug.
2. Add TypeScript declarations.

## 2.0.0 (**Important**)

(2017-11-30 12:00 UTC+0800)

1. All classes extends from EventEmitter.
2. Properties like `__data`, `__events` are all changed to the style of 
    `_data`, `_events`.
3. Uses adapters to support more databases, currently supports `MySQL/MariaDB`,
    `Postgres`, `MSSQL`, `OracleDB`, `DB2`, `SQLite`.
4. More features added and efficiency improved.

## 1.1.0

(2017-11-30 12:40 UTC+0800)

1. Fix some bugs.

## 1.0.9

(2017-10-18 23:44 UTC+0800)

1. Update query.increase() and query.decrease(), set default to 1.

## 1.0.8

(2017-10-8 23:32 UTC+0800)

1. Fix some bugs.

## 1.0.7

(2017-10-8 16:12 UTC+0800)

1. Change the property `db.__spec` to `db.__dsn`, method `db.__getSpec()` to 
    `db.__getDSN()`.
2. New configuration option `max` for setting maximum count of connections in 
    the database pool.
3. More efficient when retrieving connections from the pool.
4. More efficient when updating a model.

## 1.0.6

(2017-9-27 13:24 UTC+0800)

1. Fix a BUG in class User.

## 1.0.5

(2017-9-24 1:00 UTC+0800)

1. Add two methods to the class Query/Model to increase and decrease data:
    - `query.increase()`
    - `query.decrease()`

## 1.0.4

(2017-9-24 10:27 UTC+0800)

1. Fix the structure of the database specification and pool.

## 1.0.2 

(2017-9-20 20:10 UTC+0800)

1. Add a new method `model.whereState()` to set an extra where... clause for 
    the SQL statement when updating or deleting the model.
2. More readable type hints of methods.