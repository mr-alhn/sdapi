const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const multer = require('multer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();


const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});

app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.json());
app.use(bodyParser.json());
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '_' + file.originalname);
    }
});

const upload = multer({ storage: storage });


router.get('/book-details/:id', async (req, res) => {
    try {
        const bookId = req.params.id;
        const userId = req.query.user_id; 

        const [bookdetails] = await db.query('SELECT * FROM ebooks WHERE id = ?', [bookId]);
        const [purchased] = await db.query('SELECT * FROM ebook_purchased WHERE user_id = ? AND ebook_id = ?', [userId, bookId]);
        const [bestSeller] = await db.query(`
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            ORDER BY ebooks.purchase_count DESC
            LIMIT 10
        `, [userId]);
        const [quote] = await db.query('SELECT * FROM quotes ORDER BY RAND() LIMIT 1');
        const [review] = await db.query('SELECT * FROM review WHERE ebook_id = ?', [bookId]);

        res.json({
            bookdetails,
            purchased,
            bestSeller,
            quote,
            review
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Database error: ' + error.message
        });
    }
});

router.get('/books', async (req, res) => {
    try {
        const type = req.query.type;  // The type is passed as a query parameter
        const userId = req.query.user_id || 0;  // Get user_id from query, default to 1 if not provided

        let orderBy = ['id', 'desc'];
        let extraCondition = '';

        if (type === "best-seller") {
            orderBy = ['ebooks.purchase_count', 'desc'];
        } else if (type === "editot") {
            extraCondition = ' AND ebooks.editor = "yes" ';
        }

        const [books] = await db.query(`
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE 1 ${extraCondition}
            ORDER BY ?? DESC
        `, [userId, orderBy[0]]);

        res.json({ books });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Database error: ' + error.message
        });
    }
});

router.get('/homepage-data', async (req, res) => {
    try {
        const userId = req.query.userId || 0;

        const [banners] = await db.query(`SELECT * FROM banners WHERE type = 'desktop' ORDER BY id DESC`);
        const [category] = await db.query(`SELECT * FROM ebookcategory`);
        const [ebooks] = await db.query(`
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            ORDER BY ebooks.id DESC
            LIMIT 10
        `, [userId]);

        const [editorchoice] = await db.query(`
            SELECT * FROM ebooks WHERE editor = 'yes' ORDER BY id DESC LIMIT 9
        `);

        const [bestSeller] = await db.query(`
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            ORDER BY ebooks.purchase_count DESC
            LIMIT 10
        `, [userId]);

        const [language] = await db.query(`
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = 4
            LIMIT 10
        `, [userId]);

        const [teaching] = await db.query(`
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = 7
            LIMIT 10
        `, [userId]);

        const [police] = await db.query(`
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = 5
            LIMIT 10
        `, [userId]);

        const [testprep] = await db.query(`
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = 6
            LIMIT 10
        `, [userId]);

        const [blogs] = await db.query(`SELECT * FROM blogs ORDER BY id DESC`);

        const [banneData] = await db.query(`SELECT banner_img FROM banners ORDER BY id DESC`);
        const bannersImg = banneData.map(item => item.banner_img);

        res.json({
            banners: bannersImg,
            category,
            ebooks,
            editorchoice,
            bestSeller,
            language,
            teaching,
            police,
            testprep,
            blogs
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Database error: ' + error.message
        });
    }
});

router.get('/book-category-data', async (req, res) => {
    try {
        const userId = req.query.userId;
        const ebookCate = req.query.ebookCate;

        if (!userId || !ebookCate) {
            return res.status(400).json({ status: false, message: 'UserId and ebookCate are required.' });
        }

        const [books] = await db.execute(`
            SELECT ebooks.*, 
            CASE WHEN wishlist.ebook_id IS NULL THEN 0 ELSE 1 END as wishlist
            FROM ebooks 
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = ? 
            ORDER BY ebooks.id DESC
        `, [userId, ebookCate]);

        res.json(books);

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Database error: ' + error.message
        });
    }
});

router.delete('/remove-wishlist', async (req, res) => {
    try {
        const userId = req.query.userId;
        const ebookId = req.query.ebookId;

        if (!userId || !ebookId) {
            return res.status(400).json({ status: false, message: 'UserId and ebookId are required.' });
        }

        const [result] = await db.execute(`
            DELETE FROM wishlist WHERE user_id = ? AND ebook_id = ?
        `, [userId, ebookId]);

        if (result.affectedRows > 0) {
            res.json({ status: true, message: 'success' });
        } else {
            res.json({ status: false, message: 'failed' });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Database error: ' + error.message
        });
    }
});

router.post('/add-wishlist', async (req, res) => {
    try {
        const userId = req.body.userId;
        const ebookId = req.body.ebookId;

        if (!userId || !ebookId) {
            return res.status(400).json({ status: false, message: 'UserId and ebookId are required.' });
        }

        const [result] = await db.execute(`
            INSERT INTO wishlist (user_id, ebook_id) VALUES (?, ?)
        `, [userId, ebookId]);

        if (result.affectedRows > 0) {
            res.json({ status: true, message: 'success' });
        } else {
            res.json({ status: false, message: 'failed' });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Database error: ' + error.message
        });
    }
});

router.get('/search-ebooks', async (req, res) => {
    const searchTerm = req.query.search;

    try {
        const query = `
            SELECT * FROM ebooks 
            WHERE ebook_name LIKE ? 
            OR ebook_info LIKE ? 
            OR ebook_overview LIKE ? 
            OR author LIKE ?
        `;

        const values = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];
        
        const [results] = await db.query(query, values);
        res.json(results);

    } catch (err) {
        console.error(err); // This will help you to see the error in console
        res.status(500).send('Error while searching for ebooks');
    }
});

router.post('/login-check', async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;

        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length > 0) {
            const user = users[0];

            if (bcrypt.compareSync(password, user.password)) {
                req.session.userId = user.id;
                req.session.role = user.role;
                req.session.userImg = user.profile;
                res.json({ status: 'success', role: user.role });
            } else {
                res.json({ status: 'error', message: 'Password not matched' });
            }
        } else {
            res.json({ status: 'error', message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Database error: ' + error.message
        });
    }
});

router.get('/viewPdf', async (req, res) => {
    const ebook_id = req.query.ebook_id;
    const user_id = req.query.user_id;
    let prchaseCheck = await db.query("SELECT * FROM ebook_purchased WHERE user_id = ? AND ebook_id = ?", [user_id, ebook_id]);

    let book = await db.query("SELECT * FROM ebooks WHERE id = ?", [ebook_id]);

    res.json({ book, prchaseCheck });
});

router.get('/readUpdate', async (req, res) => {
    const pageNo = req.query.page_no;
    const bookId = req.query.ebook_id;
    const userId = req.query.user_id;

    let check = await db.query("SELECT * FROM readebook WHERE user_id = ? AND ebook_id = ?", [userId, bookId]);
    let updateEbook;
    if (check.length > 0) {
        updateEbook = await db.query("UPDATE readebook SET page_no = ? WHERE user_id = ? AND ebook_id = ?", [pageNo, userId, bookId]);
    } else {
        updateEbook = await db.query("INSERT INTO readebook (page_no, ebook_id, user_id) VALUES (?, ?, ?)", [pageNo, bookId, userId]);
    }
    if (updateEbook) {
        res.send("success");
    } else {
        res.send("Failed");
    }
});

router.get('/handlePaymentDb', async (req, res) => {
    const userId = req.query.user_id;
    const transactionId = req.query.transaction_id;
    const status = req.query.status;
    const amount = req.query.amount;
    const ebookId = req.query.ebook_id;

    let insertTransaction = await db.query("INSERT INTO transaction (user_id, transaction_id, status, amount, ebook_id) VALUES (?, ?, ?, ?, ?)", [userId, transactionId, status, amount, ebookId]);
    if (status === "captured") {
        let insertPurchase = await db.query("INSERT INTO ebook_purchased (ebook_id, user_id) VALUES (?, ?)", [ebookId, userId]);

        if (insertPurchase) {
            res.send("success");
        } else {
            res.send("failed");
        }
    } else {
        res.send("payment not captured");
    }
});

router.get('/getWishlist', async (req, res) => {
    const userId = req.query.user_id;

    let wishlist = await db.query(
        "SELECT wishlist.*, ebooks.* FROM wishlist JOIN ebooks ON ebooks.id = wishlist.ebook_id WHERE wishlist.user_id = ? ORDER BY wishlist.id DESC", 
        [userId]
    );
    res.json(wishlist);
});

router.get('/getLibrary', async (req, res) => {
    const userId = req.query.user_id;
    let library = await db.query(
        "SELECT ebooks.*, readebook.*, ebooks.id as id FROM readebook JOIN ebooks ON ebooks.id = readebook.ebook_id WHERE readebook.user_id = ?", 
        [userId]
    );
    library.forEach(item => {
        item.total_pages = 100;
    });
    res.json(library);
});

router.get('/getProfile', async (req, res) => {
    const userId = req.query.user_id;
    let profile = await db.query(
        "SELECT * FROM users WHERE id = ?", 
        [userId]
    );
    res.json(profile);
});

router.get('/getAllBlogs', async (req, res) => {
    let blogs = await db.query("SELECT * FROM blogs ORDER BY id DESC");
    res.json(blogs);
});

router.get('/getBlogView', async (req, res) => {
    let blogs;
    const blogId = req.query.id;
    const path = req.query.path;

    if (path === 'prev') {
        blogs = await db.query("SELECT * FROM blogs WHERE id < ? ORDER BY id DESC LIMIT 1", [blogId]);
    } else if (path === 'next') {
        blogs = await db.query("SELECT * FROM blogs WHERE id > ? ORDER BY id ASC LIMIT 1", [blogId]);
    } else {
        blogs = await db.query("SELECT * FROM blogs WHERE id = ? ORDER BY id DESC", [blogId]);
    }
    if (blogs.length === 0) {
        blogs = await db.query("SELECT * FROM blogs WHERE id = ? ORDER BY id DESC", [blogId]);
    }
    const allBlogs = await db.query("SELECT * FROM blogs ORDER BY id DESC");
    res.json({ blogs: blogs, allBlogs });  
});

router.get('/getCartItems', async (req, res) => {
    const userId = req.query.user_id;

    let cartItems = await db.query(
        "SELECT cart.*, ebooks.*, cart.id as id FROM cart JOIN ebooks ON ebooks.id = cart.ebook_id WHERE cart.user_id = ? ORDER BY cart.id DESC", 
        [userId]
    );
    let similarProduct = await db.query("SELECT * FROM ebooks ORDER BY RAND() LIMIT 3");
    res.json({ cartItems, similarProduct });
});

router.get('/getCheckoutDetails', async (req, res) => {
    const userId = req.query.user_id;

    let cartItems = await db.query(
        "SELECT cart.id as id, cart.*, ebooks.* FROM cart JOIN ebooks ON ebooks.id = cart.ebook_id WHERE cart.user_id = ? ORDER BY cart.id DESC", 
        [userId]
    );

    let similarProduct = await db.query("SELECT * FROM ebooks ORDER BY RAND() LIMIT 3");
    let address = await db.query("SELECT * FROM address WHERE user_id = ? ORDER BY id DESC", [userId]);
    res.json({ cartItems, similarProduct, address }); 
});

router.post('/addToCart', async (req, res) => {
    const userId = req.body.user_id;
    const ebookId = req.body.ebook_id;

    let checkItem = await db.query("SELECT * FROM cart WHERE user_id = ? AND ebook_id = ?", [userId, ebookId]);

    if (checkItem.length > 0) {
        return res.json({ message: "Item already in cart go to cart" });
    } else {
        let addcart = await db.query("INSERT INTO cart (user_id, ebook_id) VALUES (?, ?)", [userId, ebookId]);

        if (addcart) {
            return res.json({ message: "success" });
        } else {
            return res.json({ message: "failed , Try again" });
        }
    }
});

router.delete('/deleteFromCart', async (req, res) => {
    const cartId = req.body.id;

    let result = await db.query("DELETE FROM cart WHERE id = ?", [cartId]);

    if (result.affectedRows > 0) {
        return res.json({ message: "success" });
    } else {
        return res.json({ message: "Something wents wrong, Try again !" });
    }
});

router.put('/updateQuantity', async (req, res) => {
    const cartId = req.body.id;
    const state = req.body.state;

    let item = await db.query("SELECT * FROM cart WHERE id = ?", [cartId]);
    let qty = item[0].qty;

    if (state === 'min') {
        qty = (qty <= 1) ? 1 : qty - 1;
    } else if (state === 'plus') {
        qty = qty + 1;
    }

    let update = await db.query("UPDATE cart SET qty = ? WHERE id = ?", [qty, cartId]);

    if (update.affectedRows > 0) {
        return res.json({ qty: qty });
    } else {
        return res.json({ message: "Failed to update quantity" });
    }
});

router.get('/cartPriceUpdate', async (req, res) => {
    const userId = req.query.user_id;

    let cartItems = await db.query(`
        SELECT cart.*, ebooks.*, cart.id as id 
        FROM cart 
        JOIN ebooks ON ebooks.id = cart.ebook_id 
        WHERE cart.user_id = ? 
        ORDER BY cart.id DESC`, [userId]);

    if (cartItems) {
        return res.json(cartItems);
    } else {
        return res.json({ message: "Failed to fetch cart items" });
    }
});

router.post('/addAddress', async (req, res) => {
    const userId = req.body.user_id;
    const tittle = req.body.tittle;
    const building_no = req.body.building_no;
    const state = req.body.state;
    const city = req.body.city;
    const pincode = req.body.pincode;
    const landmark = req.body.landmark;

    await db.query(`UPDATE address SET isDefault = 'no' WHERE user_id = ?`, [userId]);

    const result = await db.query(`
        INSERT INTO address(user_id, tittle, address, state, city, pincode, landmark, isDefault) 
        VALUES(?,?,?,?,?,?,?, 'yes')`, 
        [userId, tittle, building_no, state, city, pincode, landmark]
    );

    if (result.insertId) {
        return res.json({ message: "success" });
    } else {
        return res.json({ message: "failed" });
    }
});

router.delete('/deleteAddress', async (req, res) => {
    const addressId = req.body.id;

    const result = await db.query(`DELETE FROM address WHERE id = ?`, [addressId]);

    if (result.affectedRows > 0) {
        return res.json({ message: "success" });
    } else {
        return res.json({ message: "Failed" });
    }
});

router.put('/setDefault', async (req, res) => {
    const userId = req.body.user_id;
    const addressId = req.body.id;

    db.query(`UPDATE address SET isDefault = 'no' WHERE user_id = ?`, [userId], (error, result) => {
        if (error) {
            return res.json({ message: "Failed" });
        }
        if (result.affectedRows > 0) {
            db.query(`UPDATE address SET isDefault = 'yes' WHERE id = ?`, [addressId], (error, result) => {
                if (error) {
                    return res.json({ message: "Failed" });
                }
                if (result.affectedRows > 0) {
                    return res.json({ message: "success" });
                } else {
                    return res.json({ message: "Failed" });
                }
            });
        }
    });
});

router.get('/test/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;

  try {
    const data = await db.query('SELECT * FROM test WHERE id = ?', [id]);
    const questions = await db.query(`
      SELECT q.*, tg.type, tg.ans_id as ans
      FROM questions q
      LEFT JOIN test_given tg ON q.id = tg.question_id
    `);
    const user = await db.query('SELECT * FROM users WHERE id = ?', [user_id]);

    res.json({ data, questions, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/testupdate', async (req, res) => {
  const { id, option, qid, type, test_id } = req.body;
  const user_id = req.query.user_id; 

  try {
    let optionValue = option !== "" ? option : 0;

    const checkF = await db.query(
      'SELECT * FROM test_given WHERE question_id = ? AND user_id = ?',
      [qid, user_id]
    );

    if (checkF.length > 0) {
      await db.query(
        'UPDATE test_given SET ans_id = ?, type = ? WHERE question_id = ? AND user_id = ?',
        [optionValue, type, qid, user_id]
      );
    } else {
      await db.query(
        'INSERT INTO test_given (ans_id, test_id, question_id, user_id, type) VALUES (?, ?, ?, ?, ?)',
        [optionValue, test_id, qid, user_id, type]
      );
    }

    const questions = await db.query(`
      SELECT q.*, tg.type, tg.ans_id as ans
      FROM questions q
      LEFT JOIN test_given tg ON q.id = tg.question_id
    `);

    res.json({ questions, id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// <--------------------->

router.post('/signUp-check', upload.single('profile'), async (req, res) => {
    try {
        let email = req.body.email;
        let phone = req.body.phone;
        let profilePath = null; 

        const [emailUsers] = await db.execute(`SELECT * FROM users WHERE email = ?`, [email]);
        if (emailUsers.length > 0) {
            return res.status(400).send('Email already exists');
        }

        const [phoneUsers] = await db.execute(`SELECT * FROM users WHERE phone = ?`, [phone]);
        if (phoneUsers.length > 0) {
            return res.status(400).send('Phone number already exists');
        }

        if (req.file) {
            profilePath = 'image/' + req.file.filename;
        }

        const code = Math.floor(100000 + Math.random() * 900000);
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const referenceCode = 'SDP' + crypto.randomBytes(4).toString('hex');

        let query = `
            INSERT INTO users (first_name, last_name, email, phone, password, code, reference_code)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        let parameters = [req.body.first_name, req.body.last_name, email, phone, hashedPassword, code, referenceCode];

        if (profilePath) {
            query = `
            INSERT INTO users (first_name, last_name, email, phone, password, profile, code, reference_code) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        parameters.push(profilePath);
        }

        const [result] = await db.execute(query, parameters);

        if (result.affectedRows > 0) {
            // Send mail logic
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'trusher@gmail.com',
                    pass: 'Sd Campus Publication'
                }
            });

            const mailOptions = {
                from: 'trusher@gmail.com',
                to: email,
                subject: 'Otp Verification',
                text: `Hello ${req.body.first_name} ${req.body.last_name}, Here is your OTP: ${code}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                    return res.status(500).send('Email sending failed');
                } else {
                    console.log('Email sent: ' + info.response);
                    return res.send('success');
                }
            });
        } else {
            res.status(500).send('failed');
        }

    } catch (error) {
        res.status(500).send('Database error: ' + error.message);
    }
});

module.exports = router;