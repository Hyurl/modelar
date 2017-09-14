"use strict";

const Query = require('./supports/Query');

/**
 * *Model Wrapper.*
 * 
 * This class extends from Query class, there for has all the features that 
 * Query has, and features that Query doesn't have, which makes data operation
 * more easier and efficient.
 * 
 * Also, this class implements some useful API of ES2015, like `toString()`, 
 * `valueOf()`, `toJSON()`, and `Symbol.iterator`. You can call 
 * `model.toString()` or `JSON.stringify(model)` to generate a JSON string of 
 * the model, and call `model.valueOf()` to get the data of the model. If you
 * want to list out all properties of the model data, put the model in a 
 * for...of... loop, like `for(let [field, value] of model)`.
 */
class Model extends Query {
    /**
     *  Creates a new instance.
     * 
     * @param  {Object} data   [optional] Initial data of the model.
     * @param  {Object} config [optional] Initial configuration of the model,
     *                         they could be:
     *                         * `table` The table name that the instance 
     *                         	 binds to.
     *                         * `fields` Fields of the table in an array.
     *                         * `primary` The primary key of the table.
     *                         * `searchable` An array that carries all 
     *                            searchable fields, they could be used when 
     *                            calling `model.getMany()`.
     * @return {Model}
     */
    constructor(data = {}, config = {}) {
        super(config.table); //Bind the table name.
        this.__fields = config.fields || []; //Fields of the table.
        this.__primary = config.primary || ''; //The primary key.
        this.__searchable = config.searchable || []; //Searchable fields.

        //This property carries the data of the model.
        this.__data = {};

        //Event handlers.
        this.__events = Object.assign({
            //This event will be fired when the SQL statement has been 
            //successfully executed.
            query: [],
            //This event will be fired when a new model is about to be 
            //inserted into the database.
            insert: [],
            //This event will be fired when a new model is successfully 
            //inserted into the database.
            inserted: [],
            //This event will be fired when a model is about to be updated.
            update: [],
            //This event will be fired when a model is successfully updated.
            updated: [],
            //This event will be fired when a model is about to be saved.
            save: [],
            //This event will be fired when a model is successfully saved.
            saved: [],
            //This event will be fired when a model is about to be deleted.
            delete: [],
            //This event will be fired when a model is successfully deleted.
            deleted: [],
            //This event will be fired when a model is successfully fetched 
            //from the database.
            get: [],
        }, this.constructor.__events);

        //This property stores pivot-tables' relationships.
        //Format:
        // {
        //     pivot_table: ["foreignKey1", "foreignKey2"]
        // }
        //`pivot_table` is the name of the pivot table.
        //`foreignKey1` is a foreign key that points to the current model's 
        //primary key.
        //`foreignKey2` is a foreign key points to the associated model's 
        //primary key.
        this.__pivots = {};

        //Define setters and getters of pseudo-properties for the model, only 
        //if they are not defined.
        for (let field of this.__fields) {
            let hasGetter = this.__lookupGetter__(field) instanceof Function,
                hasSetter = this.__lookupSetter__(field) instanceof Function,
                isProp = this.hasOwnProperty(field);
            if (!hasGetter && !hasSetter && !isProp) {
                Object.defineProperty(this, field, {
                    //Getter
                    get: () => this.__data[field] || null,
                    //Setter
                    set: (v) => {
                        //Primary key cannot be set through pseudo-property.
                        if (field != this.__primary)
                            this.__data[field] = v;
                    },
                });
            }
        }

        //Assign data to the instance.
        delete data[this.__primary]; //Filter primary key.
        this.assign(data, true);
    }

    /**
     * Assigns data to the model instance.
     * 
     * @param  {Object}  data      The data in a object needs to be assigned.
     * @param  {Boolean} useSetter [optional] Use setters (if any) to process 
     *                             the data, default is `false`.
     * 
     * @return {Model} Returns the current instance for function chaining.
     */
    assign(data, useSetter = false) {
        if (this.__data instanceof Array) {
            //__data extends from DB class, so it could be an array.
            this.__data = {};
        }
        for (let key in data) {
            if (this.__fields.includes(key)) {
                //Only accept those fields that `__fields` sets.
                if (useSetter) {
                    let set = this.__lookupSetter__(key);
                    if (set instanceof Function && set.name.includes(' ')) {
                        set.call(this, data[key]); //Calling setter
                        continue;
                    }
                }
                this.__data[key] = data[key];
            }
        }
        return this;
    }

    /**
     * Saves the current model, if there is not record in the database, it 
     * will be automatically inserted.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    save() {
        this.trigger('save', this); //Trigger the save event.
        var exists = this.__data[this.__primary],
            promise = exists ? this.update() : this.insert();
        return promise.then(model => {
            return this.trigger('saved', model);
        });
    }

    /*************** Rewritten methods from Query ********************/

    /**
     * Inserts the current model as a new record into the database.
     * 
     * @param  {Any} data An object that carries fields and their values.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    insert(data = {}) {
        this.assign(data, true);
        return super.insert(this.__data).then(model => {
            model.where(model.__primary, model.insertId);
            return model.get(); //Get real data from database.
        });
    }

    /**
     * Updates the current model.
     * 
     * @param  {Object}  data An object that carries fields and their values.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    update(data = {}) {
        this.__where = "";
        this.__limit = "";
        this.__bindings = [];
        this.bindings = [];
        this.where(this.__primary, this.__data[this.__primary]);
        this.assign(data, true);
        return super.update(this.__data).then(model => {
            return model.get(); //Get real data from database.
        });
    }

    /**
     * Deletes the current model.
     * 
     * @param {Number} id [optional] The value of the model's primary key.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    delete(id = 0) {
        if (id == 0) {
            this.__where = "";
            this.__bindings = [];
            this.bindings = [];
            this.where(this.__primary, this.__data[this.__primary]);
            return super.delete();
        } else {
            return this.get(id).then(model => {
                return model.delete();
            });
        }
    }

    /**
     * Gets a model from the database.
     * 
     *  @param {Number} id [optional] The value of the model's primary key.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the fetched model.
     */
    get(id = 0) {
        if (id == 0) {
            return super.get().then(data => {
                if (!data || Object.keys(data).length === 0) {
                    //If no model is retrieved, throw an error.
                    throw new Error("No " + this.constructor.name +
                        " was found by searching the given data.");
                } else {
                    return this.assign(data).trigger('get', this);
                }
            });
        } else {
            return this.where(this.__primary, id).get();
        }
    }

    /**
     * Gets all models from the database.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is all fetched models 
     *                   carried in an array.
     */
    all() {
        return super.all().then(data => {
            if (data.length === 0) {
                //If no models are retrieved, throw an error.
                throw new Error("No " + this.constructor.name +
                    " was found by searching the given data.");
            } else {
                var models = [];
                for (let i in data) {
                    let model = new this.constructor();
                    //Assign data and trigger event handlers for every model.
                    model.use(this).assign(data[i]).trigger('get', model);
                    models.push(model);
                }
                return models;
            }
        });
    }

    /**
     * Gets multiple models that suit the given condition. Unlike 
     * `model.all()`, this method accepts other arguments in a simpler way to 
     * generate sophisticated SQL statement and fetch models with paginated 
     * information.
     * 
     * @param  {Object}  args [optional] An object carries key-value pairs 
     *                        information for fields, and it also accepts 
     *                        these properties:
     *                        * `page` The current page, default is `1`.
     *                        * `limit` The top limit of per page, default is 
     *                           `10`.
     *                        * `orderBy` Ordered by a particular field, 
     *                          default is the primary key.
     *                        * `sequence` The sequence of how the data are 
     *                          ordered, it could be `asc`, `desc` or `rand`, 
     *                          default is `asc`.
     *                        * `keywords` Keywords for vague searching, it 
     *                          could be a string or an array.
     * 
     * @return {Promise} Returns a Promise, and the only argument passes to 
     *                   the callback of `then()` is an object that carries 
     *                   some information of these:
     *                   * `page` The current page.
     *                   * `limit` The top limit of per page.
     *                   * `orderBy` Ordered by a particular field.
     *                   * `sequence` Sequence of how the data are ordered.
     *                   * `keywords` Keywords for vague searching.
     *                   * `pages` A number of all model pages.
     *                   * `total` A number of all model counts.
     *                   * `data` An array that carries all fetched models.
     */
    getMany(args = {}) {
        var defaults = {
            page: 1,
            limit: 10,
            orderBy: this.__primary,
            sequence: 'asc',
            keywords: '',
        };
        args = Object.assign(defaults, args);

        //Set basic query conditions.
        var offset = (args.page - 1) * args.limit;
        this.limit(offset, args.limit);
        if (args.sequence !== 'asc' && args.sequence != 'desc')
            this.random(); //随机排序
        else
            this.orderBy(args.orderBy, args.sequence);

        //Set where clause for fields.
        for (let field of this.__fields) {
            if (args[field] && defaults[field] === undefined) {
                let operator = "=",
                    value = args[field],
                    match = value.match(/^(<>|!=|<=|>=|<|>|=)\w+/);
                if (match) { //Handle values which start with an operator.
                    operator = match[1];
                    value = value.substring(operator.length);
                }
                this.where(field, operator, value);
            }
        }

        //Set where clause by using keywords in a vague searching senario.
        if (args.keywords && this.__searchable) {
            var keywords = args.keywords;
            if (typeof keywords == 'string') keywords = [keywords];
            for (let i in keywords) {
                //Escape special characters.
                keywords[i] = keywords[i].replace('%', '\%')
                    .replace("\\", "\\\\");
            }
            //Construct nested conditions.
            this.where((query) => {
                for (let field of this.__searchable) {
                    query.orWhere((query) => {
                        for (let keyword of keywords) {
                            query.orWhere(field, 'like', '%' + keyword + '%');
                        }
                    });
                }
            });
        }

        //Get paginated information.
        return this.paginate(args.page, args.limit).then(info => {
            return Object.assign(args, info);
        });
    }

    /*************************** Static Wrappers ****************************/

    /**
     * Uses a connection that is already established.
     * 
     * @param {Object} db An DB instance with a established connection.
     * 
     * @return {DB} Returns the current instance for function chaining.
     */
    static use(db) {
        return (new this()).use(db);
    }

    /**
     * Starts a transaction and handle codes in it.
     * 
     * @param {Function} callback If a function is passed, the codes in it 
     *                            will be automatically handled, that means 
     *                            if the program goes well, the transaction 
     *                            will be automatically committed, otherwise 
     *                            it will automatically roll backed. If no 
     *                            function is passed, it just start the 
     *                            transaction, that means you have to commit 
     *                            and roll back manually.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    static transaction(callback = null) {
        return (new this()).transaction(callback);
    }

    /**
     * Sets the fields that need to be fetched.
     * 
     * @param  {Any} fields A list of all target fields, each one passed as an
     *                      argument. Or just pass the first argument as an 
     *                      array that carries all the field names.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static select(...fields) {
        return (new this()).select(fields);
    }

    /**
     * Sets the inner join clause for the SQL statement.
     * 
     * @param  {String} table    A table name that needs to join with.
     * @param  {String} field1   A field name in the table that currently 
     *                           binds to.
     * @param  {String} operator Condition operator, if the `field2` isn't 
     *                           passed, then this argument will replace it,
     *                           and the operator will become an `=`.
     * @param  {String} field2   [optional] A field in `table` that needs to
     *                           be compared with `field1`. If this argument
     *                           is missed, then `operator` will replace it, 
     *                           and the operator will become an `=`.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static join(table, field1, operator, field2) {
        return (new this()).join(table, field1, operator, field2);
    }

    /**
     * Sets a left join clause for the SQL statement.
     * 
     * @param  {String} table    A table name that needs to join with.
     * @param  {String} field1   A field name in the table that currently 
     *                           binds to.
     * @param  {String} operator Condition operator, if the `field2` isn't 
     *                           passed, then this argument will replace it,
     *                           and the operator will become an `=`.
     * @param  {String} field2   [optional] A field in `table` that needs to
     *                           be compared with `field1`. If this argument
     *                           is missed, then `operator` will replace it, 
     *                           and the operator will become an `=`.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static leftJoin(table, field1, operator, field2) {
        return (new this()).leftJoin(table, field1, operator, field2);
    }

    /**
     * Sets a right join clause for the SQL statement.
     * 
     * @param  {String} table    A table name that needs to join with.
     * @param  {String} field1   A field name in the table that currently 
     *                           binds to.
     * @param  {String} operator Condition operator, if the `field2` isn't 
     *                           passed, then this argument will replace it,
     *                           and the operator will become an `=`.
     * @param  {String} field2   [optional] A field in `table` that needs to
     *                           be compared with `field1`. If this argument
     *                           is missed, then `operator` will replace it, 
     *                           and the operator will become an `=`.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static rightJoin(table, field1, operator, field2) {
        return (new this()).rightJoin(table, field1, operator, field2);
    }

    /**
     * Sets a full join clause for the SQL statement.
     * 
     * @param  {String} table    A table name that needs to join with.
     * @param  {String} field1   A field name in the table that currently 
     *                           binds to.
     * @param  {String} operator Condition operator, if the `field2` isn't 
     *                           passed, then this argument will replace it,
     *                           and the operator will become an `=`.
     * @param  {String} field2   [optional] A field in `table` that needs to
     *                           be compared with `field1`. If this argument
     *                           is missed, then `operator` will replace it, 
     *                           and the operator will become an `=`.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static fullJoin(table, field1, operator, field2) {
        return (new this()).fullJoin(table, field1, operator, field2);
    }

    /**
     * Sets a cross join clause for the SQL statement.
     * 
     * @param  {String} table    A table name that needs to join with.
     * @param  {String} field1   A field name in the table that currently 
     *                           binds to.
     * @param  {String} operator Condition operator, if the `field2` isn't 
     *                           passed, then this argument will replace it,
     *                           and the operator will become an `=`.
     * @param  {String} field2   [optional] A field in `table` that needs to
     *                           be compared with `field1`. If this argument
     *                           is missed, then `operator` will replace it, 
     *                           and the operator will become an `=`.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static crossJoin(table, field1, operator, field2) {
        return (new this()).crossJoin(table, field1, operator, field2);
    }

    /**
     * Set a where clause for the SQL statement.
     * 
     * @param  {Any}    field    This could be a field name, or an object that
     *                           sets multiple `=` (equal) conditions for the 
     *                           clause. Or pass a callback function to 
     *                           generate nested conditions, the only argument
     *                           passed to the callback is a new Query 
     *                           instance with its features.
     * @param  {String} operator Condition operator, if the `value` isn't 
     *                           passed, then this argument will replace it,
     *                           and the operator will become an `=`.
     * @param  {Any}    value    [optional] A value that needs to be compared 
     *                           with `field`. If this argument is missed, 
     *                           then `operator` will replace it, and the 
     *                           operator will become an `=`.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static where(field, operator, value) {
        return (new this()).where(field, operator, value);
    }

    /**
     * Sets a where...between clause for the SQL statement.
     * 
     * @param  {String} field A field name in the table that currently 
     *                        binds to.
     * @param  {Array}  range An array that carries only two elements which
     *                        represent the start point and the end point.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static whereBetween(field, range) {
        return (new this()).whereBetween(field, range);
    }

    /**
     * Sets a where...not between clause for the SQL statement.
     * 
     * @param  {String} field A field name in the table that currently 
     *                        binds to.
     * @param  {Array}  range An array that carries only two elements which
     *                        represent the start point and the end point.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static whereNotBetween(field, range) {
        return (new this()).whereNotBetween(field, range);
    }

    /**
     * Sets a where...in clause for the SQL statement.
     * 
     * @param  {String} field  A field name in the table that currently 
     *                         binds to.
     * @param  {Any}    values An array that carries all possible values. Or 
     *                         pass a callback function to handle nested 
     *                         SQL statement, the only argument passed to 
     *                         the callback is a new Query instance, so
     *                         that you can use its features to generate 
     *                         a SQL statement.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static whereIn(field, values) {
        return (new this()).whereIn(field, values);
    }

    /**
     * Sets a where...not in clause for the SQL statement.
     * 
     * @param  {String} field  A field name in the table that currently 
     *                         binds to.
     * @param  {Any}    values An array that carries all possible values. Or 
     *                         pass a callback function to handle nested 
     *                         SQL statement, the only argument passed to 
     *                         the callback is a new Query instance, so
     *                         that you can use its features to generate 
     *                         a SQL statement.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static whereNotIn(field, values) {
        return (new this()).whereNotIn(field, values);
    }

    /**
     * Sets a where...is null clause for the SQL statement.
     * 
     * @param  {String} field  A field name in the table that currently 
     *                         binds to.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static whereNull(field) {
        return (new this()).whereNull(field);
    }

    /**
     * Sets a where...is not null clause for the SQL statement.
     * 
     * @param  {String} field  A field name in the table that currently 
     *                         binds to.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static whereNotNull(field) {
        return (new this()).whereNotNull(field);
    }

    /**
     * Sets a where...exists clause for the SQL statement.
     * 
     * @param  {Function} callback Pass a callback function to handle nested 
     *                             SQL statement, the only argument passed to 
     *                             the callback is a new Query instance, so
     *                             that you can use its features to generate 
     *                             a SQL statement.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static whereExists(callback) {
        return (new this()).whereExists(callback);
    }

    /**
     * Sets a where...not exists clause for the SQL statement.
     * 
     * @param  {Function} callback Pass a callback function to handle nested 
     *                             SQL statement, the only argument passed to 
     *                             the callback is a new Query instance, so
     *                             that you can use its features to generate 
     *                             a SQL statement.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static whereNotExists(callback) {
        return (new this()).whereNotExists(callback);
    }

    /**
     * Sets a order by clause for the SQL statement.
     * 
     * @param  {String} field    A field name in the table that currently 
     *                           binds to.
     * @param  {String} sequence [optional] The way that records ordered, it
     *                           could be either `asc` or `desc`.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static orderBy(field, sequence = "") {
        return (new this()).orderBy(field, sequence);
    }

    /**
     * Sets that the records will be ordered in random sequence.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static random() {
        return (new this()).random();
    }

    /**
     * Sets a group by clause for the SQL statement.
     * 
     * @param  {Any} fields A list of all target fields, each one passed as an
     *                      argument. Or just pass the first argument as an
     *                      array that carries all the field names.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static groupBy(...fields) {
        return (new this()).groupBy(fields);
    }

    /**
     * Sets a having clause for the SQL statement.
     * 
     * @param  {String} raw  A SQL clause to define comparing conditions.
     * @return {Query}  this 当前实例
     */
    static having(raw) {
        return (new this()).having(raw);
    }

    /**
     * Sets a limit clause for the SQL statement.
     * 
     * @param  {Number} offset The start point, count from `0`. If `length` is
     *                         not passed, then this argument will replace it,
     *                         and the offset will become 0.
     * @param  {Number} length [optional] The top limit of how many counts 
     *                         that this query will fetch.
     * 
     * @return {Query} Returns the current instance for function chaining.
     */
    static limit(offset, length = 0) {
        return (new this()).limit(offset, length);
    }

    /**
     * Gets all models from the database.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is all fetched models 
     *                   carried in an array.
     */
    static all() {
        return (new this()).all();
    }

    /**
     * Gets all counts of records.
     * 
     * @param {String} field [optional] Count a specified field.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is a Number that counts
     *                   records.
     */
    static count(field = "*") {
        return (new this()).count(field);
    }

    /**
     * Gets the maximum value of a specified field in the table.
     * 
     * @param {String} field The specified field.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the maximum value 
     *                   fetched.
     */
    static max(field) {
        return (new this()).max(field);
    }

    /**
     * Gets the minimum value of a specified field in the table.
     * 
     * @param {String} field The specified field.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the minimum value 
     *                   fetched.
     */
    static min(field) {
        return (new this()).min(field);
    }

    /**
     * Gets the average value of a specified field in the table.
     * 
     * @param {String} field The specified field.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the average value 
     *                   fetched.
     */
    static avg(field) {
        return (new this()).avg(field);
    }

    /**
     * Gets the summarized value of a specified field in the table.
     * 
     * @param {String} field The specified field.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the summarized value 
     *                   fetched.
     */
    static sum(field) {
        return (new this()).sum(field);
    }

    /**
     * Processes chunked data with a specified length.
     * 
     * @param {Number}   length   The top limit of how many records that each 
     *                            chunk will carry.
     * @param {Function} callback A function for processing every chunked 
     *                            data, the only argument passed to it is the 
     *                            data that current chunk carries.
     * 
     * @return {Promise} Returns a Promise, and the only argument passed to
     *                   the callback of then() is the last chunk of data. If
     *                   the callback returns `false`, then stop chunking.
     */
    static chunk(length, callback) {
        return (new this()).chunk(length, callback);
    }

    /**
     * Gets paginated information of all models that suit the given 
     * conditions.
     * 
     * @param  {Number}  page  [optional] The current page, default is `1`.
     * @param  {Number}  limit [optional] The top limit of per page, default 
     *                         is `10`.
     * 
     * @return {Promise} Returns a Promise, the only argument passes to the 
     *                   callback of `then()` is an object that carries the 
     *                   information, it includes:
     *                   * `page` The current page.
     *                   * `limit` The top limit of per page.
     *                   * `pages` Represents all pages.
     *                   * `total` Represents all counts of data.
     *                   * `data`  Carries all fetched data in an array.
     */
    static paginate(page = 1, limit = 10) {
        return (new this()).paginate(page, limit);
    }

    /**
     * Inserts a new model in to the database.
     * 
     * @param  {Object} data An object that carries fields and their values.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    static insert(data) {
        return (new this(data)).insert();
    }

    /**
     * Deletes an existing model.
     * 
     *  @param {Number} id [optional] The value of the model's primary key.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    static delete(args) {
        return (new this()).delete(args);
    }

    /**
     * Gets a model from the database.
     * 
     * @param {Number} id [optional] The value of the model's primary key.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the fetched data.
     */
    static get(args) {
        return (new this()).get(args);
    }

    /**
     * Gets multiple models that suit the given condition. Unlike 
     * `Model.all()`, this method accepts other arguments in a simpler way to 
     * generate sophisticated SQL statement and fetch models with paginated 
     * information.
     * 
     * @param  {Object}  args [optional] An object carries key-value pairs 
     *                        information for fields, and it also accepts 
     *                        these properties:
     *                        * `page` The current page, default is `1`.
     *                        * `limit` The top limit of per page, default is 
     *                           `10`.
     *                        * `orderBy` Ordered by a particular field, 
     *                          default is the primary key.
     *                        * `sequence` The sequence of how the data are 
     *                          ordered, it could be `asc`, `desc` or `rand`, 
     *                          default is `asc`.
     *                        * `keywords` Keywords for vague searching, it 
     *                          could be a string or an array.
     * 
     * @return {Promise} Returns a promise, and the only argument passes to 
     *                   the callback of `then()` is an object that carries 
     *                   some information of these:
     *                   * `page` The current page.
     *                   * `limit` The top limit of per page.
     *                   * `orderBy` Ordered by a particular field.
     *                   * `sequence` Sequence of how the data are ordered.
     *                   * `keywords` Keywords for vague searching.
     *                   * `pages` A number of all model pages.
     *                   * `total` A number of all model counts.
     *                   * `data` An array that carries all fetched models.
     */
    static getMany(args = {}) {
        return (new this()).getMany(args);
    }

    /**************************** Associations *****************************/

    /**
     * Defines a has (many) association.
     * 
     * @param  {Model}  Model      A model class that needs to be associated.
     * @param  {String} foreignKey A foreign key in the associated model.
     * 
     * @return {Model} Returns the associated model instance so you can use 
     *                 its features to handle data.
     */
    has(Model, foreignKey) {
        return Model.use(this).where(foreignKey, this.__data[this.__primary]);
    }

    /**
     * Defines a has-(many)-through association.
     * 
     * @param {Model}  Model       A model class that needs to be associated.
     * @param {Model}  MiddleModel The class of the middle model. 
     * @param {String} foreignKey1 A foreign key in the associated model.
     * @param {String} foreignKey2 A foreign key in the middle model.
     * 
     * @return {Model} Returns the associated model instance so you can use 
     *                 its features to handle data.
     */
    hasThrough(Model, MiddleModel, foreignKey1, foreignKey2) {
        var model = new Model,
            _model = new MiddleModel;
        return model.use(this).whereIn(foreignKey1, query => {
            query.select(_model.__primary).from(_model.__table)
                .where(foreignKey2, this.__data[this.__primary]);
        });
    }

    /**
     * Defines a belongs-to association.
     * 
     * @param  {Model}  Model      A model class that needs to be associated.
     * @param  {String} foreignKey A foreign key in the current model.
     * 
     * @return {Model} Returns the associated model instance so you can use 
     *                 its features to handle data.
     */
    belongsTo(Model, foreignKey) {
        var model = (new Model).use(this);
        return model.where(model.__primary, this.__data[foreignKey]);
    }

    /**
     * Defines a many-to-many association.
     * 
     * @param  {Model}  Model      A model class that needs to be associated.
     * @param  {String} pivotTable The name of the pivot table.
     * 
     * @return {Model} Returns the associated model instance so you can use 
     *                 its features to handle data.
     */
    belongsToMany(Model, pivotTable) {
        var pivot = this.__pivots[pivotTable],
            model = new Model;
        return model.use(this).whereIn(model.__primary, query => {
            query.select(pivot[1]).from(pivotTable)
                .where(pivot[0], this.__data[this.__primary]);
        });
    }

    /**
     * Associates the current model to another model.
     * 
     * @param {String} foreignKey A foreign key in the current model.
     * @param {Model}  model      A model that needs to be associated.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    associate(foreignKey, model) {
        this.__data[foreignKey] = model.__data[model.__primary];
        return this.save();
    }

    /**
     * Removes an association of the current model.
     * 
     * @param {String} foreignKey A foreign key in the current model.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    dissociate(foreignKey) {
        this.__data[foreignKey] = null;
        return this.save();
    }

    /**
     * Updates associations in a pivot table.
     * 
     * @param {String} pivotTable The name of the pivot table.
     * @param {Array}  models     An array carries all models that needs to 
     *                            be associated, or an array carries all IDs 
     *                            of models that needs to be associated.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    attach(pivotTable, models) {
        var id1 = this.__data[this.__primary],
            pivot = this.__pivots[pivotTable];

        //Handle procedure in a transaction.
        return this.transaction(() => {
            let ids = [];
            for (let model of models) {
                if (typeof model == "number")
                    ids.push(model);
                else
                    ids.push(model.__data[model.__primary]);
            }
            var query = (new Query(pivotTable)).use(this);
            return query.where(pivot[0], id1).all().then(data => {
                let _ids = [],
                    deletes = [];
                for (let single of data) {
                    let id2 = single[pivot[1]];
                    _ids.push(id2);
                    if (!ids.includes(id2)) {
                        //Get foreign keys that needs to be deleted.
                        deletes.push(id2);
                    }
                }
                let __ids = [];
                for (let id of ids) {
                    if (!_ids.includes(id))
                        __ids.push(id);
                }
                let i = -1,
                    //Insert association records within a recursive loop.
                    loop = (_query = null) => {
                        if (!__ids.length) return this;
                        let _data = {};
                        _data[pivot[0]] = id1;
                        _data[pivot[1]] = __ids.splice(i += 1, 1)[0];
                        if (!_query)
                            _query = (new Query(pivotTable)).use(this);
                        return _query.insert(_data).then(_query => {
                            return loop(_query);
                        });
                    };
                if (deletes.length) {
                    //Delete association records which are not in the provided
                    //models.
                    let _query = (new Query(pivotTable)).use(this);
                    return _query.where(pivot[0], id1)
                        .whereIn(pivot[1], deletes)
                        .delete().then(_query => {
                            return loop(_query);
                        });
                } else if (ids.length) {
                    return loop();
                } else {
                    return this;
                }
            });
        })
    }

    /**
     * Deletes associations in a pivot table.
     * 
     * @param {String} pivotTable The name of the pivot table.
     * @param {Array}  models     [optional] An array carries all models that 
     *                            needs to be dissociated, or an array carries 
     *                            all IDs of models that needs to be
     *                            dissociated. If this parameter is not 
     *                            provided, delete all associations of the 
     *                            current model in the pivot table.
     * 
     * @return {Promise} Returns a Promise, and the the only argument passed 
     *                   to the callback of `then()` is the current instance.
     */
    detach(pivotTable, models = []) {
        var id1 = this.__data[this.__primary],
            pivot = this.__pivots[pivotTable],
            query = (new Query(pivotTable)).use(this);
        if (models.length > 0) {
            //Delete association records which are in the provided models.
            let ids = [];
            for (let model of models) {
                if (typeof model == "number")
                    ids.push(model);
                else
                    ids.push(model.__data[model.__primary]);
            }
            return query.where(pivot[0], id1)
                .whereIn(pivot[1], ids)
                .delete()
                .then(query => this);
        } else {
            //Delete all association records.
            return query.where(pivot[0], id1).delete().then(query => this);
        }
        return query;
    }

    /**
     * Gets the data that the model represents.
     * 
     * @return {Object} The model data in an object.
     */
    valueOf() {
        var data = {};
        for (let key in this.__data) {
            let get = this.__lookupGetter__(key);
            if (get instanceof Function && get.name.includes(' ')) {
                //Calling getter.
                let value = get.call(this, this.__data[key]);
                //Set this property only if getter returns an non-undefined
                //value.
                if (value !== undefined)
                    data[key] = value;
            } else {
                data[key] = this.__data[key];
            }
        }
        return data;
    }

    /**
     * Gets the data string in a JSON that the model holds.
     * 
     * @return {String} A JSON string that represents the model data.
     */
    toString() {
        return JSON.stringify(this);
    }

    /**
     * Implements toJSON API
     */
    toJSON() {
        return this.valueOf();
    }

    /**
     * Implements Iterator API
     */
    [Symbol.iterator]() {
        var data = this.valueOf(),
            keys = Object.keys(data),
            length = keys.length,
            index = -1;
        return {
            next: () => {
                index++;
                if (index < length) {
                    return {
                        value: [keys[index], data[keys[index]]],
                        done: false,
                    };
                } else {
                    return { value: undefined, done: true };
                }
            }
        }
    }
}

module.exports = Model;
module.exports = Model;