const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'sdpublication.cblikg6yg8bk.eu-north-1.rds.amazonaws.com',
    user: 'sdpublication',
    password: 'abwEke0n967wfk4Z83iC',
    database: 'sdpublication'
});

// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'sdcampusbook'
// });

module.exports = pool.promise();
