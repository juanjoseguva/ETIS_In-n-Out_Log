const mysql = require('mysql2');

const pool  = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'etisadmin',
    password: 'burgerlord',
    database: 'ETISBurgerLogData'
});

module.exports = pool;
