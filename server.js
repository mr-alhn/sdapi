const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const fileUpload = require('express-fileupload');
const bcrypt = require('bcrypt');

const app = express();

app.use('/api', require('./userweb'));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});

app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.json());
app.use(fileUpload());

app.get('/', (req, res) =>{
    res.status(200).json({
        status: true,
        message: 'SDPublication'
    });
});

app.post('/insertUser', async (req, res) => {
    try {
        const { first_name, last_name, phone, password, email } = req.body;

        const requiredFields = ['first_name', 'last_name', 'phone', 'password'];
        for (let field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({ status: false, message: `${field.replace('_', ' ')} is required.` });
            }
        }

        const [existingUsers] = await db.execute('SELECT * FROM users WHERE phone = ? OR email = ?', [phone, email || null]);
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ status: false, message: 'Phone or email is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let uploadDir = 'uploads/';
        let profilePicture = req.files && req.files.profile_picture ? req.files.profile_picture.name : null;
        let targetFilePath = profilePicture ? uploadDir + profilePicture : null;

        if (profilePicture) {
            req.files.profile_picture.mv(targetFilePath);
        }

        let columns = ['first_name', 'last_name', 'phone', 'password'];
        let placeholders = ['?', '?', '?', '?'];
        let values = [first_name, last_name, phone, hashedPassword];

        if (email) {
            columns.push('email');
            placeholders.push('?');
            values.push(email);
        }

        if (profilePicture) {
            columns.push('profile');
            placeholders.push('?');
            values.push(`uploads/${profilePicture}`);
        }

        const query = `
            INSERT INTO users (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
        `;

        const [results] = await db.execute(query, values);

        res.json({
            status: true,
            message: 'User registered successfully.'
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Database error: ' + error.message
        });
    }
});

app.post('/editProfile', async (req, res) => {
    try {
        const { phone, first_name, last_name } = req.body;

        // Check if phone number is provided
        if (!phone) {
            return res.status(400).json({ status: false, message: 'Phone is required.' });
        }

        // Check if user exists
        const [existingUsers] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        
        if (existingUsers.length <= 0) {
            return res.status(400).json({ status: false, message: 'User not found with the given phone number.' });
        }

        let updates = [];

        // Update first_name if provided
        if (first_name) {
            updates.push(`first_name='${first_name}'`);
        }

        // Update last_name if provided
        if (last_name) {
            updates.push(`last_name='${last_name}'`);
        }

        // Handle profile_picture upload
        let profilePicture = req.files && req.files.profile_picture ? req.files.profile_picture.name : null;
        let targetFilePath = profilePicture ? `uploads/${profilePicture}` : null;

        if (profilePicture) {
            req.files.profile_picture.mv(targetFilePath);
            updates.push(`profile_picture='${targetFilePath}'`);
        }

        // Update user if there are any changes
        if (updates.length) {
            const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE phone=?`;
            await db.execute(updateQuery, [phone]);
        } else {
            return res.json({ status: false, message: 'No changes detected.' });
        }

        // Fetch updated user's details
        const [userDetails] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);

        res.json({
            status: true,
            message: 'Profile updated successfully.',
            details: userDetails[0] // Assuming the phone number is unique and returns only one record.
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Database error: ' + error.message
        });
    }
});

app.post('/loginUser', async (req, res) => {
    try {
        const { phone, password } = req.body;

        // Validation
        if (!phone || !password) {
            return res.status(400).json({
                status: false, 
                message: "Phone and password are required."
            });
        }

        const [users] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        
        if (users.length > 0) {
            const user = users[0];
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {
                res.status(200).json({
                    status: true,
                    message: 'Login successful.',
                    details: user
                });
            } else {
                res.status(401).json({
                    status: false,
                    message: 'Incorrect password.'
                });
            }
        } else {
            res.status(401).json({
                status: false,
                message: 'Phone not registered.'
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal server error.'
        });
    }
});

app.get('/books', async (req, res) => {
    try {
        const [categories] = await db.execute("SELECT id, category_name FROM ebookcategory");
        let response = {};

        for (let category of categories) {
            const [books] = await db.execute("SELECT * FROM ebooks WHERE ebook_cate = ?", [category.id]);
            response[category.category_name] = books;
        }

        res.status(200).json({
            data: response
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getCart', async (req, res) => {
    try {
        const userId = req.query.id;

        if (!userId) {
            return res.status(400).json({
                status: false,
                message: "User ID is required."
            });
        }

        const [books] = await db.execute("SELECT * FROM cart WHERE user_id = ?", [userId]);

        if (books.length > 0) {
            res.json({
                status: true,
                books: books
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No books found."
            });
        }
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.post('/addCart', async (req, res) => {
    try {
        const { userid, bookid } = req.body;

        if (!userid || !bookid) {
            return res.status(400).json({
                status: false,
                message: 'User ID and Book ID are required.'
            });
        }

        const [result] = await db.execute(
            "INSERT INTO cart (user_id, ebook_id, qty) VALUES (?, ?, 1)",
            [userid, bookid]
        );

        res.json({
            status: true,
            message: 'Added to cart successfully'
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.delete('/deleteCart', async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                status: false,
                message: 'ID is required.'
            });
        }

        const [result] = await db.execute(
            "DELETE FROM cart WHERE id = ?",
            [id]
        );

        if (result.affectedRows > 0) {
            res.json({
                status: true,
                message: 'Deleted from cart successfully'
            });
        } else {
            res.status(404).json({
                status: false,
                message: 'No item found with that ID in the cart.'
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getFav', async (req, res) => {
    try {
        const userId = req.query.id;

        if (!userId) {
            return res.status(400).json({
                status: false,
                message: "User ID is required."
            });
        }

        const [books] = await db.execute("SELECT * FROM wishlist WHERE user_id = ?", [userId]);

        if (books.length > 0) {
            res.json({
                status: true,
                books: books
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No books found."
            });
        }
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.post('/addFav', async (req, res) => {
    try {
        const userId = req.body.user_id;
        const bookId = req.body.ebook_id;

        if (!userId || !bookId) {
            return res.status(400).json({
                status: false,
                message: "User ID and Book ID are required."
            });
        }

        const [result] = await db.execute(
            "INSERT INTO wishlist (user_id, ebook_id) VALUES (?, ?)",
            [userId, bookId]
        );

        if (result.affectedRows > 0) {
            res.json({
                status: true,
                message: 'Successfully added to wishlist!'
            });
        } else {
            res.status(500).json({
                status: false,
                message: 'Failed to add to wishlist.'
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.delete('/deleteFav', async (req, res) => {
    try {
        const id = req.query.id;

        if (!id) {
            return res.status(400).json({
                status: false,
                message: "ID is required."
            });
        }

        const [result] = await db.execute(
            "DELETE FROM wishlist WHERE id = ?",
            [id]
        );

        if (result.affectedRows > 0) {
            res.json({
                status: true,
                message: 'Successfully removed from wishlist!'
            });
        } else {
            res.status(404).json({
                status: false,
                message: 'Entry not found in wishlist.'
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getLib', async (req, res) => {
    try {
        const userId = req.query.id;

        if (!userId) {
            return res.status(400).json({
                status: false,
                message: "User ID is required."
            });
        }

        const [books] = await db.execute("SELECT * FROM readebook WHERE user_id = ?", [userId]);

        if (books.length > 0) {
            res.json({
                status: true,
                books: books
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No books found."
            });
        }
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.post('/addLib', async (req, res) => {
    try {
        const { id, bid } = req.body;

        if (!id || !bid) {
            return res.status(400).json({
                status: false,
                message: 'User ID and eBook ID are required.'
            });
        }

        const p = '0';

        const [result] = await db.execute(
            "INSERT INTO readebook (user_id, ebook_id, page_no) VALUES (?, ?, ?)",
            [id, bid, p]
        );

        if (result.affectedRows > 0) {
            res.json({
                status: true,
                message: 'Added to library successfully'
            });
        } else {
            res.status(500).json({
                status: false,
                message: 'Failed to add to library.'
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getAdd', async (req, res) => {
    try {
        const userId = req.query.id;

        if (!userId) {
            return res.status(400).json({
                status: false,
                message: "User ID is required."
            });
        }

        const [addresses] = await db.execute("SELECT * FROM address WHERE user_id = ?", [userId]);

        if (addresses.length > 0) {
            res.json({
                status: true,
                address: addresses
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No Address found."
            });
        }
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.post('/addAddress', async (req, res) => {
    try {
        const {
            userid,
            title,
            address,
            state,
            city,
            pincode,
            landmark,
            isDefault
        } = req.body;

        if (!userid || !title || !address || !state || !city || !pincode || typeof isDefault === "undefined") {
            res.status(400).json({
                status: false,
                message: "Missing required parameters."
            });
            return;
        }

        await db.execute(
            "INSERT INTO address (user_id, tittle, address, state, city, pincode, landmark, isDefault) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [userid, title, address, state, city, pincode, landmark, isDefault]
        );

        res.json({
            status: true,
            message: "Address added successfully."
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getOrder', async (req, res) => {
    try {
        const userId = req.query.id;

        if (!userId) {
            return res.status(400).json({
                status: false,
                message: "User ID is required."
            });
        }

        const [orders] = await db.execute("SELECT * FROM orders WHERE user_id = ?", [userId]);

        if (orders.length > 0) {
            res.json({
                status: true,
                order: orders
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No Orders found."
            });
        }
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/checkPhoneandEmail', async (req, res) => {
    try {
        const { email, phone } = req.query;

        if (!email || !phone) {
            return res.status(400).json({
                status: false,
                message: "Both email and phone are required."
            });
        }

        const [emailResult] = await db.execute("SELECT id FROM users WHERE email = ?", [email]);

        if (emailResult && emailResult.length > 0) {
            return res.json({
                status: false,
                message: "Email already registered."
            });
        }

        const [phoneResult] = await db.execute("SELECT id FROM users WHERE phone = ?", [phone]);

        if (phoneResult && phoneResult.length > 0) {
            return res.json({
                status: false,
                message: "Phone already registered."
            });
        }

        res.json({
            status: true,
            message: "Success"
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/startTest', async (req, res) => {
    try {
        const { userid: user_id, testid, time: starttime } = req.query;

        if (!user_id || !testid || !starttime) {
            res.status(400).json({
                status: false,
                message: "Missing parameters."
            });
            return;
        }

        await db.execute("INSERT INTO test_timing (user_id, test_id, start_time) VALUES (?, ?, ?)", [user_id, testid, starttime]);

        res.json({
            status: true,
            message: "Test started successfully"
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getMyTest', async (req, res) => {
    try {
        const { id: user_id } = req.query;

        if (!user_id) {
            res.status(400).json({
                status: false,
                message: "User ID is required."
            });
            return;
        }

        const [rows] = await db.execute("SELECT * FROM test_timing WHERE user_id = ?", [user_id]);

        if (rows.length > 0) {
            res.json({
                status: true,
                Tests: rows
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No Tests found."
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.post('/giveTest', async (req, res) => {
    try {
        const { tid: test_id, qid, aid, uid, type } = req.body;

        if (!test_id || !qid || !aid || !uid || !type) {
            res.status(400).json({
                status: false,
                message: "All fields are required."
            });
            return;
        }

        await db.execute(
            "INSERT INTO test_given (test_id, question_id, ans_id, user_id, type) VALUES (?, ?, ?, ?, ?)", 
            [test_id, qid, aid, uid, type]
        );

        res.json({
            status: true,
            message: "Test recorded successfully."
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getNoti', async (req, res) => {
    try {
        const userId = req.query.id;

        if (!userId) {
            return res.status(400).json({
                status: false,
                message: "User ID is required."
            });
        }

        const [rows] = await db.execute(
            "SELECT * FROM notifications WHERE user_id = ?",
            [userId]
        );

        if (rows.length > 0) {
            res.json({
                status: true,
                noti: rows
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No Notifications found."
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});


// Details

app.get('/getCategory', async (req, res) => {
    try {
        const [categories] = await db.execute("SELECT id, category_name FROM ebookcategory");

        if (categories.length > 0) {
            res.status(200).json({
                status: true,
                categories
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No categories found."
            });
        }
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getBanners', async (req, res) => {
    try {
        const [result] = await db.execute("SELECT * FROM banners");

        if (result && result.length > 0) {
            return res.json({
                status: true,
                banners: result
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No banners found."
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getTestCat', async (req, res) => {
    try {
        const [categories] = await db.execute("SELECT * FROM mock_test_category");

        if (categories.length > 0) {
            res.json({
                status: true,
                Categories: categories
            });
        } else {
            res.status(404).json({
                status: false,
                message: 'No Categories found.'
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getTestCat2', async (req, res) => {
    try {
        const mockTestId = req.query.id;

        if(!mockTestId) {
            res.status(400).json({
                status: false,
                message: "Missing mock_test_id parameter."
            });
            return;
        }

        const [categories] = await db.execute("SELECT * FROM mock_test_category2 WHERE mock_test_id = ?", [mockTestId]);

        if (categories.length > 0) {
            res.json({
                status: true,
                Categories: categories
            });
        } else {
            res.status(404).json({
                status: false,
                message: 'No Categories found.'
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getTCat', async (req, res) => {
    try {
        const mockTestCategory2Id = req.query.id;

        if(!mockTestCategory2Id) {
            res.status(400).json({
                status: false,
                message: "Missing mock_test_category2_id parameter."
            });
            return;
        }

        const [categories] = await db.execute("SELECT * FROM test_category WHERE mock_test_category2_id = ?", [mockTestCategory2Id]);

        if (categories.length > 0) {
            res.json({
                status: true,
                Categories: categories
            });
        } else {
            res.status(404).json({
                status: false,
                message: 'No Categories found.'
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getTCat2', async (req, res) => {
    try {
        const testCategoryId = req.query.id;

        if(!testCategoryId) {
            res.status(400).json({
                status: false,
                message: "Missing test_category parameter."
            });
            return;
        }

        const [tests] = await db.execute("SELECT * FROM test WHERE test_category = ?", [testCategoryId]);

        if (tests.length > 0) {
            res.json({
                status: true,
                Tests: tests
            });
        } else {
            res.status(404).json({
                status: false,
                message: 'No Tests found.'
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

app.get('/getQuestions', async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            res.status(400).json({
                status: false,
                message: "Missing test ID parameter."
            });
            return;
        }

        const [rows] = await db.execute("SELECT * FROM questions WHERE test_id = ?", [id]);

        if (rows.length > 0) {
            res.json({
                status: true,
                Question: rows
            });
        } else {
            res.status(404).json({
                status: false,
                message: "No Question found."
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
});

module.exports = app;