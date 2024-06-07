
//Modules used
const express = require('express');
const session = require('express-session');
const {jwtDecode} = require("jwt-decode");
const path = require('path');
const config = require('./config');
const pool = require('./dbPool');
const app = express();

//App configurations
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: config.SECRET,
    resave: false,
    saveUninitialized: true
}));
app.use((req, res, next) =>{
    res.locals.user = req.session.user;
    next();
});

//Framework
app.set("view engine", "ejs");

//To execute SQL statements
async function executeSQL(sql, params) {
    return new Promise(function (resolve, reject) {
        pool.query(sql, params, function (err, rows, fields) {
            if (err) {
                console.error("Error executing SQL query:", err);
                reject(err); // Reject the promise with the error
            } else {
                resolve(rows);
            }
        });
    });
}

//Routes
app.get('/', (req, res) => {
    res.render('index', {"funFacts": config.funFacts});
});
app.post('/', async (req, res) => {
    try {
        let googleUser = jwtDecode(req.body.gJWToken);
        let givenGoogleID = googleUser.sub;
        let sql = `SELECT * FROM authorized_users WHERE googleID = ${givenGoogleID}`;
        let user = await executeSQL(sql);
        if (user.length !== 0) {
            req.session.user = givenGoogleID;
            res.render('update', { "funFacts": config.funFacts, "isAdmin": user[0].isAdmin });
        }
    } catch (error) {
        console.error("Error querying the database:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get('/update', async (req, res) => {
    try {
        let sql = `SELECT isAdmin FROM authorized_users WHERE googleID=${req.session.user}`;
        let user = await executeSQL(sql);
        res.render('update', { "funFacts": config.funFacts, "isAdmin": user[0].isAdmin });
    } catch (error) {
        console.error("Error querying the database:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/update', async (req, res) => {
    try {
        let location = "";
        let returnTime = "";
        let status = req.body.selectedStatus;
        if (req.body.location) {
            location = req.body.location;
        }
        if (req.body.returnTime) {
            returnTime = req.body.returnTime;
        }
        let userip = req.ip;
        let sql = `UPDATE authorized_users SET currentStatus = ?, currentLocation = ?, returnTime = ? where googleID = ?`;
        let params = [status, location, returnTime, req.session.user];
        await executeSQL(sql, params);
        sql = `INSERT INTO activity_log (timestamp, googleID, ipAddress, location, status)
        VALUES (CURRENT_TIMESTAMP, ?, ?, ?, ?)`;
        params = [req.session.user, userip, location, status];
        await executeSQL(sql, params);
        sql = `SELECT isAdmin FROM authorized_users WHERE googleID = ${req.session.user}`;
        let check = await executeSQL(sql);
        res.render('update', {"funFacts": config.funFacts, "isAdmin": check[0].isAdmin, "Message": "Log updated!"});
    } catch (error) {
        console.error("Error updating the database: ", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/administrator', async (req, res) =>{
   try {
       let sql = 'SELECT timestamp, fName, lName, ipAddress, location, status ' +
           'FROM authorized_users JOIN activity_log ON authorized_users.googleID = activity_log.googleID ' +
           'ORDER BY timestamp DESC LIMIT 10';
       let activityRows = await executeSQL(sql);
       sql = `SELECT * FROM authorized_users WHERE googleID = ${req.session.user}`;
       let admin = await executeSQL(sql);
       sql = `SELECT fName, lName, googleID FROM authorized_users`;
       let etisUsers = await executeSQL(sql);
       let report = [];
       res.render('administrator', {
           "etisUsers": etisUsers,
           "rows": activityRows,
           "admin": admin,
           "funFacts": config.funFacts,
           "report": report,
           modifyStatus
       });
   } catch (error) {
       console.error("Error querying the database:", error);
       res.status(500).send("Internal Server Error");
   }
});
app.post('/administrator', async (req, res) => {
    try{
        let employee = req.body.etisUser;
        let start = req.body.startDate;
        let end = req.body.endDate;
        let sql = `SELECT * FROM activity_log WHERE googleID = ? AND timestamp > ? AND timestamp < ?`;
        let params = [employee, start, end];
        let report = await executeSQL(sql, params);
        if (!report) {
            report = [];
        }
        sql = 'SELECT timestamp, fName, lName, ipAddress, location, status FROM authorized_users JOIN activity_log ON authorized_users.googleID = activity_log.googleID LIMIT 10';
        let activityRows = await executeSQL(sql);
        sql = `SELECT * FROM authorized_users WHERE googleID = ${req.session.user}`;
        let admin = await executeSQL(sql);
        sql = `SELECT fName, lName, googleID FROM authorized_users`;
        let etisUsers = await executeSQL(sql);
        sql = `SELECT fName, lName FROM authorized_users WHERE googleID = ${employee}`;
        employee = await executeSQL(sql);
        res.render('administrator', {
            "employee": employee,
            "report": report,
            "etisUsers": etisUsers,
            "rows": activityRows,
            "admin": admin,
            "funFacts": config.funFacts,
            modifyStatus
        });
    } catch (error){
        console.error("Error querying the database:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/signOut', (req, res) => {
    req.session.user = undefined;
    res.render('index', {"funFacts": config.funFacts});
});

app.get('/burgerLog', async (req, res) => {
   try {
       let sql = `SELECT fName, lName, currentStatus, currentLocation, returnTime, burger FROM authorized_users`;
       let rows = await executeSQL(sql);
       res.render('burgerLog', {"funFacts": config.funFacts, "rows": rows, modifyStatus});
   } catch (error) {
       console.error("Error querying the database:", error);
       res.status(500).send("Internal Server Error");
   }
});

// Explicitly set Content-Type for CSS file
app.get('/public/css/styles.css', (req, res) => {
    res.type('text/css');
    res.sendFile(path.join(__dirname, 'public', 'css', 'styles.css'));
});

//For styling
function modifyStatus(status) {
    switch (status) {
        case 'in':
            return 'In 🫡';
        case 'out':
            return 'Out ✌️';
        case 'lunch':
            return 'Lunch 🍔';
        case 'break':
            return 'Break 😎';
        case 'on-site':
            return 'On-Site 🤓';
        case 'sick':
            return 'Sick 😷';
        case 'vacation':
            return 'Vacation 🍹';
        default:
            return 'Error';
    }
}

// Start the server
app.listen(config.PORT, config.HOSTNAME, () => {
    console.log(`Server is running on port `+config.PORT);
});

