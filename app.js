const pg = require('pg');
const knex = require("knex")({
    client: 'pg',
    connection: {
        user: "postgres",
        password: "123",
        host: "localhost",
        port: '5432',
        database: "testdb"
    },
    pool: {
        min: 0,
        max: 5
    },
    requestTimeout: 10000,
    acquireConnectionTimeout: 10000
});


GetBookByCallBack();
GetBookByPromise();
GetAuthor();
// DeleteAuthor();
//InsertAuthor();
// UpdateAuthor();
// GetAuthor();
knex.destroy();



function GetAuthor() {
    knex.select().from('author').then(d => {
        console.log(d);
    })
}

function GetBookByCallBack() {
    //The below code using callback, compare it with GetBookByPromise()
    //In term of function, these two functions are the same
    knex.select().from("book").asCallback(function (err, values) {
        if (err) {
            console.log(err);
        }
        else {
            console.log(values);
        }
    });
}
function GetBookByPromise() {
    // No need to check err object as this function will 
    // only be executed only when it is a success.
    knex.select().from('book').then(d => {
        console.log(d);
    }).catch(function (err) {
        // All the error can be checked in this piece of code
        console.log(err);
    })
}
function UpdateAuthor() {
    knex("author").where("id", "1")
        .update({ firstname: "Michelle" }).then(d => {
            console.log(d);
        }).catch(e => {
            console.log(e);
        })
}
function InsertAuthor() {
    var authorData = { id: "3", firstname: "aaa", lastname: "bbb" };
    knex.insert(authorData).into("author").then(d => {
        console.log(d);
    }).catch(e => {
        console.log(e);
    })
}
function DeleteAuthor() {
    var authorData = { id: "3", firstname: "aaa", lastname: "bbb" };
    knex("author").where("id", "3")
        .del().then(d => {
            console.log(d);
        }).catch(e => {
            console.log(e);
        })
}




