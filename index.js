const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const multer = require("multer");
const fs = require('fs');
const session = require('express-session');  // <-- Add session

// Configure body parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Set up session middleware
app.use(session({
    secret: 'your_secret_key',  // Change to a secure secret
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }  // Set secure: true if using HTTPS
}));

// MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'upload'
});
connection.connect();

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Route to render the homepage
app.get('/', (req, res) => {
    res.render("index");
});

// Signup route
app.get('/signup', (req, res) => {
    const { username, email, Password } = req.query;
    const data = connection.query(`INSERT INTO users VALUES ('${username}', '${email}', '${Password}')`);
    if (data) {
        res.send("Data submitted");
    } else {
        res.send("Data not submitted");
    }
});

// Signin route
app.get('/signin', (req, res) => {
    const { username, password } = req.query;
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    connection.query(sql, [trimmedUsername, trimmedPassword], (err, result) => {
        if (err) {
            return res.status(500).send('Internal Server Error');
        }

        if (result.length > 0) {
            // Save session on successful login
            req.session.loggedIn = true;
            req.session.username = trimmedUsername;  // Save username in session

            return res.render('upload', { username: trimmedUsername });
        } else {
            return res.status(401).send('Wrong credentials');
        }
    });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Error during logout');
        }
        res.redirect('/');  // Redirect to home (login page) after logout
    });
});

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
    if (req.session.loggedIn) {
        next();  // User is authenticated, proceed to the next middleware
    } else {
        res.redirect('/');  // Redirect to home (login page) if not authenticated
    }
}

// Upload file route
const upload = multer({ 
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, path.join(__dirname, 'files'));
        },
        filename: function (req, file, cb) {
            cb(null, file.originalname);
        }
    })
});

// Show upload page (with username from session)
app.get('/upload', isLoggedIn, (req, res) => {
    res.render("upload", { username: req.session.username });
});

app.post('/upload', upload.array('files', 10), isLoggedIn, (req, res) => {
    console.log(req.files);
    res.send('Files uploaded successfully!');
});

// View uploaded files
app.get('/view', isLoggedIn, (req, res) => {
    const uploadDir = path.join(__dirname, 'files');
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            return res.status(500).send('Unable to scan directory');
        }
        res.render('view', { files, username: req.session.username });
    });
});

// Download files
app.get('/download/:filename', isLoggedIn, (req, res) => {
    const filePath = path.join(__dirname, 'files', req.params.filename);
    res.download(filePath, (err) => {
        if (err) {
            res.status(404).send('File not found');
        }
    });
});

// Start server
app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
