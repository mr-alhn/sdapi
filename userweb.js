const express = require("express");
const bodyParser = require("body-parser");
const db = require("./database");
const multer = require("multer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const router = express.Router();

router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

router.use(bodyParser.urlencoded({ extended: true }));
router.use(express.json());
router.use(bodyParser.json());
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({ storage: storage });

//Covered
router.get("/book-details/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const userId = req.query.user_id;

    const [bookdetails] = await db.query("SELECT * FROM ebooks WHERE id = ?", [
      bookId,
    ]);
    const [purchased] = await db.query(
      "SELECT * FROM ebook_purchased WHERE user_id = ? AND ebook_id = ?",
      [userId, bookId]
    );
    const [bestSeller] = await db.query(
      `
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            ORDER BY ebooks.purchase_count DESC
            LIMIT 10
        `,
      [userId]
    );
    const [quote] = await db.query(
      "SELECT * FROM quotes ORDER BY RAND() LIMIT 1"
    );
    const [review] = await db.query("SELECT * FROM review WHERE ebook_id = ?", [
      bookId,
    ]);

    res.json({
      bookdetails,
      purchased,
      bestSeller,
      quote,
      review,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Database error: " + error.message,
    });
  }
});

//Covered
router.get("/books", async (req, res) => {
  try {
    const type = req.query.type; // The type is passed as a query parameter
    const userId = req.query.user_id || 0; // Get user_id from query, default to 1 if not provided

    let orderBy = ["id", "desc"];
    let extraCondition = "";

    if (type === "best-seller") {
      orderBy = ["ebooks.purchase_count", "desc"];
    } else if (type === "editot") {
      extraCondition = ' AND ebooks.editor = "yes" ';
    }

    const [books] = await db.query(
      `
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE 1 ${extraCondition}
            ORDER BY ?? DESC
        `,
      [userId, orderBy[0]]
    );

    res.json({ books });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Database error: " + error.message,
    });
  }
});

//Covered
router.get("/homepage-data", async (req, res) => {
  try {
    const userId = req.query.userId || 0;

    const [banners] = await db.query(
      `SELECT * FROM banners WHERE type = 'desktop' ORDER BY id DESC`
    );
    const [category] = await db.query(`SELECT * FROM ebookcategory`);
    const [ebooks] = await db.query(
      `
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            ORDER BY ebooks.id DESC
            LIMIT 10
        `,
      [userId]
    );

    const [editorchoice] = await db.query(`
            SELECT * FROM ebooks WHERE editor = 'yes' ORDER BY id DESC LIMIT 9
        `);

    const [bestSeller] = await db.query(
      `
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            ORDER BY ebooks.purchase_count DESC
            LIMIT 10
        `,
      [userId]
    );

    const [language] = await db.query(
      `
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = 4
            LIMIT 10
        `,
      [userId]
    );

    const [teaching] = await db.query(
      `
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = 7
            LIMIT 10
        `,
      [userId]
    );

    const [police] = await db.query(
      `
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = 5
            LIMIT 10
        `,
      [userId]
    );

    const [testprep] = await db.query(
      `
            SELECT ebooks.*, IF(wishlist.ebook_id IS NULL, 0, 1) as wishlist
            FROM ebooks
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = 6
            LIMIT 10
        `,
      [userId]
    );

    const [blogs] = await db.query(`SELECT * FROM blogs ORDER BY id DESC`);

    const [banneData] = await db.query(
      `SELECT banner_img FROM banners ORDER BY id DESC`
    );
    const bannersImg = banneData.map((item) => item.banner_img);

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
      blogs,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Database error: " + error.message,
    });
  }
});

router.get("/book-category-data", async (req, res) => {
  try {
    const userId = req.query.userId;
    const ebookCate = req.query.ebookCate;

    if (!userId || !ebookCate) {
      return res
        .status(400)
        .json({ status: false, message: "UserId and ebookCate are required." });
    }

    const [books] = await db.execute(
      `
            SELECT ebooks.*, 
            CASE WHEN wishlist.ebook_id IS NULL THEN 0 ELSE 1 END as wishlist
            FROM ebooks 
            LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
            WHERE ebooks.ebook_cate = ? 
            ORDER BY ebooks.id DESC
        `,
      [userId, ebookCate]
    );

    res.json(books);
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Database error: " + error.message,
    });
  }
});

//Covred
router.delete("/remove-wishlist", async (req, res) => {
  try {
    const userId = req.query.userId;
    const ebookId = req.query.ebookId;

    if (!userId || !ebookId) {
      return res
        .status(400)
        .json({ status: false, message: "UserId and ebookId are required." });
    }

    const [result] = await db.execute(
      `
            DELETE FROM wishlist WHERE user_id = ? AND ebook_id = ?
        `,
      [userId, ebookId]
    );

    if (result.affectedRows > 0) {
      res.json({ status: true, message: "success" });
    } else {
      res.json({ status: false, message: "failed" });
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Database error: " + error.message,
    });
  }
});

//Covred
router.post("/add-wishlist", async (req, res) => {
  try {
    const userId = req.body.userId;
    const ebookId = req.body.ebookId;

    if (!userId || !ebookId) {
      return res
        .status(400)
        .json({ status: false, message: "UserId and ebookId are required." });
    }

    const [result] = await db.execute(
      `
            INSERT INTO wishlist (user_id, ebook_id) VALUES (?, ?)
        `,
      [userId, ebookId]
    );

    if (result.affectedRows > 0) {
      res.json({ status: true, message: "success" });
    } else {
      res.json({ status: false, message: "failed" });
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Database error: " + error.message,
    });
  }
});

//Covred
router.get("/search-ebooks", async (req, res) => {
  const searchTerm = req.query.search;

  try {
    const query = `
            SELECT * FROM ebooks 
            WHERE ebook_name LIKE ? 
            OR ebook_info LIKE ? 
            OR ebook_overview LIKE ? 
            OR author LIKE ?
        `;

    const values = [
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
    ];

    const [results] = await db.query(query, values);
    res.json(results);
  } catch (err) {
    console.error(err); // This will help you to see the error in console
    res.status(500).send("Error while searching for ebooks");
  }
});

//Not
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: false,
        message: "Email and password are required.",
      });
    }

    const [user] = await db.query("SELECT * FROM users WHERE phone = ?", [
      email,
    ]);

    if (user) {
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (passwordMatch) {
        res.status(200).json({
          status: true,
          message: "success",
          user: {
            id: user.id,
            role: user.role,
            profile: user.profile,
          },
        });
      } else {
        res.status(401).json({
          status: false,
          message: "Password not matched",
        });
      }
    } else {
      res.status(401).json({
        status: false,
        message: "User not found",
      });
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error.",
    });
  }
});

//Covered
router.get("/viewPdf", async (req, res) => {
  const ebook_id = req.query.ebook_id;
  const user_id = req.query.user_id;
  let [prchaseCheck] = await db.query(
    "SELECT * FROM ebook_purchased WHERE user_id = ? AND ebook_id = ?",
    [user_id, ebook_id]
  );

  let [book] = await db.query("SELECT * FROM ebooks WHERE id = ?", [ebook_id]);

  res.json({ book, prchaseCheck });
});

//Covered
router.get("/readUpdate", async (req, res) => {
  const pageNo = req.query.page_no;
  const bookId = req.query.ebook_id;
  const userId = req.query.user_id;

  let check = await db.query(
    "SELECT * FROM readebook WHERE user_id = ? AND ebook_id = ?",
    [userId, bookId]
  );
  let updateEbook;
  if (check.length > 0) {
    updateEbook = await db.query(
      "UPDATE readebook SET page_no = ? WHERE user_id = ? AND ebook_id = ?",
      [pageNo, userId, bookId]
    );
  } else {
    updateEbook = await db.query(
      "INSERT INTO readebook (page_no, ebook_id, user_id) VALUES (?, ?, ?)",
      [pageNo, bookId, userId]
    );
  }
  if (updateEbook) {
    res.send("success");
  } else {
    res.send("Failed");
  }
});

router.get("/handlePaymentDb", async (req, res) => {
  const userId = req.query.user_id;
  const transactionId = req.query.transaction_id;
  const status = req.query.status;
  const amount = req.query.amount;
  const ebookId = req.query.ebook_id;

  let insertTransaction = await db.query(
    "INSERT INTO transaction (user_id, transaction_id, status, amount, ebook_id) VALUES (?, ?, ?, ?, ?)",
    [userId, transactionId, status, amount, ebookId]
  );
  if (status === "captured") {
    let insertPurchase = await db.query(
      "INSERT INTO ebook_purchased (ebook_id, user_id) VALUES (?, ?)",
      [ebookId, userId]
    );

    if (insertPurchase) {
      res.send("success");
    } else {
      res.send("failed");
    }
  } else {
    res.send("payment not captured");
  }
});

//Covered
router.get("/getWishlist", async (req, res) => {
  const userId = req.query.user_id;

  let wishlist = await db.query(
    "SELECT wishlist.*, ebooks.* FROM wishlist JOIN ebooks ON ebooks.id = wishlist.ebook_id WHERE wishlist.user_id = ? ORDER BY wishlist.id DESC",
    [userId]
  );
  res.json(wishlist);
});

//Covered
router.get("/getLibrary", async (req, res) => {
  const userId = req.query.user_id;
  let library = await db.query(
    "SELECT ebooks.*, readebook.*, ebooks.id as id FROM readebook JOIN ebooks ON ebooks.id = readebook.ebook_id WHERE readebook.user_id = ?",
    [userId]
  );
  library.forEach((item) => {
    item.total_pages = 100;
  });
  res.json(library);
});

//Covered
router.get("/getProfile", async (req, res) => {
  const userId = req.query.user_id;
  let [profile] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
  res.json(profile);
});

//Covered
router.get("/getAllBlogs", async (req, res) => {
  let blogs = await db.query("SELECT * FROM blogs ORDER BY id DESC");
  res.json(blogs);
});

//Covered
router.get("/getBlogView", async (req, res) => {
  let blogs;
  const blogId = req.query.id;
  const path = req.query.path;

  if (path === "prev") {
    blogs = await db.query(
      "SELECT * FROM blogs WHERE id < ? ORDER BY id DESC LIMIT 1",
      [blogId]
    );
  } else if (path === "next") {
    blogs = await db.query(
      "SELECT * FROM blogs WHERE id > ? ORDER BY id ASC LIMIT 1",
      [blogId]
    );
  } else {
    blogs = await db.query(
      "SELECT * FROM blogs WHERE id = ? ORDER BY id DESC",
      [blogId]
    );
  }
  if (blogs.length === 0) {
    blogs = await db.query(
      "SELECT * FROM blogs WHERE id = ? ORDER BY id DESC",
      [blogId]
    );
  }
  const allBlogs = await db.query("SELECT * FROM blogs ORDER BY id DESC");
  res.json({ blogs: blogs, allBlogs });
});

//Covered
router.get("/getCartItems", async (req, res) => {
  const userId = req.query.user_id;

  let cartItems = await db.query(
    "SELECT cart.*, ebooks.*, cart.id as id FROM cart JOIN ebooks ON ebooks.id = cart.ebook_id WHERE cart.user_id = ? ORDER BY cart.id DESC",
    [userId]
  );
  let similarProduct = await db.query(
    "SELECT * FROM ebooks ORDER BY RAND() LIMIT 3"
  );
  res.json({ cartItems, similarProduct });
});

//Covered
router.get("/getCheckoutDetails", async (req, res) => {
  const userId = req.query.user_id;

  let cartItems = await db.query(
    "SELECT cart.id as id, cart.*, ebooks.* FROM cart JOIN ebooks ON ebooks.id = cart.ebook_id WHERE cart.user_id = ? ORDER BY cart.id DESC",
    [userId]
  );

  let similarProduct = await db.query(
    "SELECT * FROM ebooks ORDER BY RAND() LIMIT 3"
  );
  let address = await db.query(
    "SELECT * FROM address WHERE user_id = ? ORDER BY id DESC",
    [userId]
  );
  res.json({ cartItems, similarProduct, address });
});

//TODO
router.post("/address-edit", async (req, res) => {
  const {
    address_id,
    addressedit,
    add_state,
    add_city,
    add_pin,
    add_Landmark,
    add_Phone,
  } = req.body;

  try {
    const updateQuery = `
      UPDATE address
      SET
        address = ?,
        state = ?,
        city = ?,
        pincode = ?,
        landmark = ?
      WHERE id = ?
    `;
    await db.query(updateQuery, [
      addressedit,
      add_state,
      add_city,
      add_pin,
      add_Landmark,
      address_id,
    ]);

    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

//Covered
router.post("/addToCart", async (req, res) => {
  const userId = req.body.user_id;
  const ebookId = req.body.ebook_id;

  let checkItem = await db.query(
    "SELECT * FROM cart WHERE user_id = ? AND ebook_id = ?",
    [userId, ebookId]
  );

  if (checkItem.length > 0) {
    return res.json({ message: "Item already in cart go to cart" });
  } else {
    let addcart = await db.query(
      "INSERT INTO cart (user_id, ebook_id) VALUES (?, ?)",
      [userId, ebookId]
    );

    if (addcart) {
      return res.json({ message: "success" });
    } else {
      return res.json({ message: "failed , Try again" });
    }
  }
});

//Covered
router.delete("/deleteFromCart", async (req, res) => {
  const cartId = req.body.id;

  let result = await db.query("DELETE FROM cart WHERE id = ?", [cartId]);

  if (result.affectedRows > 0) {
    return res.json({ message: "success" });
  } else {
    return res.json({ message: "Something wents wrong, Try again !" });
  }
});

//Covered
router.put("/updateQuantity", async (req, res) => {
  const cartId = req.body.id;
  const state = req.body.state;

  let item = await db.query("SELECT * FROM cart WHERE id = ?", [cartId]);
  let qty = item[0].qty;

  if (state === "min") {
    qty = qty <= 1 ? 1 : qty - 1;
  } else if (state === "plus") {
    qty = qty + 1;
  }

  let update = await db.query("UPDATE cart SET qty = ? WHERE id = ?", [
    qty,
    cartId,
  ]);

  if (update.affectedRows > 0) {
    return res.json({ qty: qty });
  } else {
    return res.json({ message: "Failed to update quantity" });
  }
});

//Covered
router.get("/cartPriceUpdate", async (req, res) => {
  const userId = req.query.user_id;

  let cartItems = await db.query(
    `
        SELECT cart.*, ebooks.*, cart.id as id 
        FROM cart 
        JOIN ebooks ON ebooks.id = cart.ebook_id 
        WHERE cart.user_id = ? 
        ORDER BY cart.id DESC`,
    [userId]
  );

  if (cartItems) {
    return res.json(cartItems);
  } else {
    return res.json({ message: "Failed to fetch cart items" });
  }
});

//Covered
router.post("/addAddress", async (req, res) => {
  const userId = req.body.user_id;
  const tittle = req.body.tittle;
  const building_no = req.body.building_no;
  const state = req.body.state;
  const city = req.body.city;
  const pincode = req.body.pincode;
  const landmark = req.body.landmark;

  await db.query(`UPDATE address SET isDefault = 'no' WHERE user_id = ?`, [
    userId,
  ]);

  const result = await db.query(
    `
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

router.delete("/deleteAddress", async (req, res) => {
  const addressId = req.body.id;

  const result = await db.query(`DELETE FROM address WHERE id = ?`, [
    addressId,
  ]);

  if (result.affectedRows > 0) {
    return res.json({ message: "success" });
  } else {
    return res.json({ message: "Failed" });
  }
});

//Covered
router.put("/setDefault", async (req, res) => {
  const userId = req.body.user_id;
  const addressId = req.body.id;

  db.query(
    `UPDATE address SET isDefault = 'no' WHERE user_id = ?`,
    [userId],
    (error, result) => {
      if (error) {
        return res.json({ message: "Failed" });
      }
      if (result.affectedRows > 0) {
        db.query(
          `UPDATE address SET isDefault = 'yes' WHERE id = ?`,
          [addressId],
          (error, result) => {
            if (error) {
              return res.json({ message: "Failed" });
            }
            if (result.affectedRows > 0) {
              return res.json({ message: "success" });
            } else {
              return res.json({ message: "Failed" });
            }
          }
        );
      }
    }
  );
});

//Covered
router.get("/returnOrder", async (req, res) => {
  const orderId = req.query.id;
  try {
    const [orders] = await db.query(
      `
      SELECT ebooks.id AS ebooks_id, ebooks.*, orders.*
      FROM orders
      JOIN ebooks ON ebooks.id = orders.ebook_id
      WHERE orders.id = ?
    `,
      [orderId]
    );
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Error while fetching order for return.",
    });
  }
});

//Covered
router.get("/userorder", async (req, res) => {
  const userId = req.query.user_id;

  try {
    const [userOrder] = await db.query(
      `
      SELECT orders.*, ebooks.*, orders.id as order_id, ebooks.id as ebooks_id 
      FROM orders 
      JOIN ebooks ON ebooks.id = orders.ebook_id 
      WHERE orders.user_id = ? 
      ORDER BY orders.id DESC
    `,
      [userId]
    );

    res.json(userOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Error while fetching user orders.",
    });
  }
});

//Covered
router.get("/test/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;

  try {
    const [data] = await db.query("SELECT * FROM test WHERE id = ?", [id]);
    const [questions] = await db.query(`
      SELECT q.*, tg.type, tg.ans_id as ans
      FROM questions q
      LEFT JOIN test_given tg ON q.id = tg.question_id
    `);
    const [user] = await db.query("SELECT * FROM users WHERE id = ?", [
      user_id,
    ]);

    res.json({ data, questions, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.post("/testupdate", async (req, res) => {
  const { id, option, qid, type, test_id } = req.body;
  const user_id = req.query.user_id;

  try {
    let optionValue = option !== "" ? option : 0;

    const checkF = await db.query(
      "SELECT * FROM test_given WHERE question_id = ? AND user_id = ?",
      [qid, user_id]
    );

    if (checkF.length > 0) {
      await db.query(
        "UPDATE test_given SET ans_id = ?, type = ? WHERE question_id = ? AND user_id = ?",
        [optionValue, type, qid, user_id]
      );
    } else {
      await db.query(
        "INSERT INTO test_given (ans_id, test_id, question_id, user_id, type) VALUES (?, ?, ?, ?, ?)",
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
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/all-category", async (req, res) => {
  try {
    const [allcategory] = await db.query("SELECT * FROM ebookcategory");
    res.json(allcategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/category/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [ebookcategory] = await db.query(
      `
      SELECT ebookcategory.*, ebooks.*, ebooks.id AS ebooks_id
      FROM ebookcategory
      JOIN ebooks ON ebooks.ebook_cate = ebookcategory.id
      WHERE ebookcategory.id = ?
    `,
      [id]
    );

    res.json(ebookcategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/videos", async (req, res) => {
  try {
    const [allvideo] = await db.query("SELECT * FROM videos");

    res.json(allvideo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/editors", async (req, res) => {
  try {
    const [editorchoice] = await db.query(
      'SELECT * FROM ebooks WHERE editor = "yes" ORDER BY id DESC'
    );

    res.json(editorchoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/ebooks", async (req, res) => {
  try {
    const userId = req.query.user_id ?? 1;

    const [ebooks] = await db.query(
      `
      SELECT ebooks.*, 
        CASE WHEN wishlist.ebook_id IS NULL THEN 0 ELSE 1 END as wishlist 
      FROM ebooks
      LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
      ORDER BY ebooks.purchase_count DESC
    `,
      [userId]
    );

    res.json(ebooks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/police_ebooks", async (req, res) => {
  try {
    const userId = req.query.user_id ?? 1;

    const [policeEbooks] = await db.query(
      `
      SELECT ebooks.*, 
        CASE WHEN wishlist.ebook_id IS NULL THEN 0 ELSE 1 END as wishlist 
      FROM ebooks
      LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
      WHERE ebooks.ebook_cate = 7
    `,
      [userId]
    );

    res.json(policeEbooks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/testprep", async (req, res) => {
  try {
    const userId = req.query.user_id;

    const [testPrepEbooks] = await db.query(
      `
      SELECT ebooks.*, 
        CASE WHEN wishlist.ebook_id IS NULL THEN 0 ELSE 1 END as wishlist 
      FROM ebooks
      LEFT JOIN wishlist ON wishlist.ebook_id = ebooks.id AND wishlist.user_id = ?
      WHERE ebooks.ebook_cate = 6
      LIMIT 10
    `,
      [userId]
    );

    res.json(testPrepEbooks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/testdata", async (req, res) => {
  try {
    const [testData] = await db.query(`
      SELECT * FROM test
      WHERE test_category = 1
      ORDER BY id DESC
    `);

    const [categories] = await db.query("SELECT * FROM mock_test_category");

    res.json({ testData, categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/bookloadtest/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const [books] = await db.query(
      `
      SELECT test.*
      FROM test
      WHERE test_category = ?
      ORDER BY id DESC
    `,
      [id]
    );

    res.json({ books });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Admin
//Covered
router.get("/admin/index", async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT orders.*, ebooks.*, ebooks.id AS ebook_id
      FROM orders
      LEFT JOIN ebooks ON ebooks.id = orders.ebook_id
    `);

    const [total_pro_month] = await db.query(`
      SELECT orders.*, ebooks.*
      FROM orders
      LEFT JOIN ebooks ON ebooks.id = orders.ebook_id
    `);
    const total_book_mon = total_pro_month.length;
    const [users] = await db.query("SELECT COUNT(*) as count FROM users");

    res.json({ orders, users: users.count, total_book_mon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/admin/books", async (req, res) => {
  try {
    const [books] = await db.query("SELECT * FROM ebooks ORDER BY id DESC");
    const [category] = await db.query("SELECT * FROM ebookcategory");

    res.json({ books, category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/admin/editbook/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [books] = await db.query("SELECT * FROM ebooks WHERE id = ?", [id]);
    const [category] = await db.query("SELECT * FROM ebookcategory");
    res.json({ books, category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/admin/getEbook", async (req, res) => {
  try {
    const [category] = await db.query("SELECT * FROM ebookcategory");
    res.json({ category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.get("/admin/loadBookcate", async (req, res) => {
  const categoryId = req.query.id;

  try {
    let books;
    if (categoryId === "" || !categoryId) {
      [books] = await db.query("SELECT * FROM ebooks ORDER BY id DESC");
    } else {
      [books] = await db.query(
        "SELECT * FROM ebooks WHERE ebook_cate = ? ORDER BY id DESC LIMIT 12",
        [categoryId]
      );
    }

    res.json({ books });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covered
router.post(
  "/admin/addebooks",
  upload.fields([
    { name: "book_image", maxCount: 1 },
    { name: "eng_pdf", maxCount: 1 },
    { name: "hindi_pdf", maxCount: 1 },
  ]),
  async (req, res) => {
    if (!req.files.book_image || !req.files.eng_pdf || !req.files.hindi_pdf) {
      return res.status(400).send("All files are required.");
    }

    const pdfImage = req.files.book_image[0].path;
    const engpdf = req.files.eng_pdf[0].path;
    const hindidf = req.files.hindi_pdf[0].path;

    const editor = req.body.editorchoice == 1 ? "yes" : "no";

    const insertQuery = `
      INSERT INTO ebooks (
        ebook_name, ebook_info, ebook_overview, ebook_cate, author, editor,
        ebook_price, physical_price, physical_price_dics, ebook_price_dics, 
        off_price, shipping_charge, pdf_image, eng_file, hin_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(
      insertQuery,
      [
        req.body.book_name,
        req.body.book_info,
        req.body.book_overview,
        req.body.category,
        req.body.author,
        editor,
        req.body.pdf_price,
        req.body.hard_price,
        req.body.hard_copy_desc,
        req.body.soft_copy_desc,
        req.body.off_price,
        req.body.shipping_charges,
        pdfImage,
        engpdf,
        hindidf,
      ],
      (error, results) => {
        if (error) {
          return res.send("Book insertion failed.");
        }
        return res.send("success");
      }
    );
  }
);

//Covered
router.put(
  "/admin/editebooks/:id",
  upload.fields([
    { name: "book_image", maxCount: 1 },
    { name: "eng_pdf", maxCount: 1 },
    { name: "hindi_pdf", maxCount: 1 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    const {
      book_name,
      book_info,
      book_overview,
      category,
      author,
      editorchoice,
      pdf_price,
      hard_price,
      hard_copy_desc,
      soft_copy_desc,
      off_price,
      shipping_charges,
      pdfimage,
      engpdf,
      hindidf,
    } = req.body;

    const editor = editorchoice == 1 ? "yes" : "no";

    try {
      const updateResult = await db.query(
        `
      UPDATE ebooks SET 
      ebook_name = ?, ebook_info = ?, ebook_overview = ?, 
      ebook_cate = ?, author = ?, editor = ?, ebook_price = ?, 
      physical_price = ?, physical_price_dics = ?, ebook_price_dics = ?, 
      off_price = ?, shipping_charge = ?, pdf_image = ?, eng_file = ?, hin_file = ?
      WHERE id = ?`,
        [
          book_name,
          book_info,
          book_overview,
          category,
          author,
          editor,
          pdf_price,
          hard_price,
          hard_copy_desc,
          soft_copy_desc,
          off_price,
          shipping_charges,
          pdfimage,
          engpdf,
          hindidf,
          id,
        ]
      );

      if (updateResult.affectedRows > 0) {
        res.json({ message: "success" });
      } else {
        res.json({ message: "failed" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

//Covered
router.delete("/admin/deleteBooks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deleteResult = await db.query("DELETE FROM ebooks WHERE id = ?", [
      id,
    ]);
    if (deleteResult.affectedRows > 0) {
      res.json({ message: "success" });
    } else {
      res.json({ message: "failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Covvered
router.post("/admin/addbookCategory", async (req, res) => {
  const { title } = req.body;

  try {
    const insertResult = await db.query(
      "INSERT INTO ebookcategory (category_name) VALUES (?)",
      [title]
    );
    if (insertResult.insertId) {
      const cate = await db.query("SELECT * FROM ebookcategory");
      let data = '<option value="">All</option>';
      cate.forEach((category) => {
        data += `<option value="${category.id}">${category.category_name}</option>`;
      });
      res.send(data);
    } else {
      res.json({ message: "failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/getCategories", async (req, res) => {
  try {
    const [categories] = await db.query(
      "SELECT * FROM ebookcategory ORDER BY id DESC"
    );
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/deleteCategory/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;
    const deleteQuery = "DELETE FROM ebookcategory WHERE id = ?";
    const result = await db.query(deleteQuery, [categoryId]);

    if (result.affectedRows > 0) {
      res.json({ message: "success" });
    } else {
      res.json({ message: "failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/getBlogs", async (req, res) => {
  try {
    const selectQuery = "SELECT * FROM blogs ORDER BY id DESC";
    const [blogs] = await db.query(selectQuery);
    res.json(blogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post(
  "/admin/addBlogs",
  upload.single("blog_image"),
  async (req, res) => {
    try {
      const { filename } = req.file;
      const { blog_title, published, content } = req.body;

      const insertQuery = `
      INSERT INTO blogs (blog_image, tittle, pblished_by, description)
      VALUES (?, ?, ?, ?)
    `;

      const insertResult = await db.query(insertQuery, [
        filename,
        blog_title,
        published,
        content,
      ]);

      if (insertResult.affectedRows > 0) {
        res.json({ message: "success" });
      } else {
        res.json({ message: "Something went wrong" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.put(
  "/admin/editBlog/:id",
  upload.single("blog_image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { filename } = req.file;
      const { blog_title, published, content } = req.body;

      const insertQuery = await db.query(
        `
      UPDATE blogs SET tittle = ?, pblished_by = ?, description = ? WHERE id = ?
    `,
        [blog_title, published, content, id]
      );

      if (insertQuery.affectedRows > 0) {
        res.json({ message: "success" });
      } else {
        res.json({ message: "Something went wrong" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.delete("/admin/deleteBlog/:id", async (req, res) => {
  try {
    const blogId = req.params.id;
    const deleteQuery = "DELETE FROM blogs WHERE id = ?";
    const result = await db.query(deleteQuery, [blogId]);

    if (result.affectedRows > 0) {
      res.json({ message: "success" });
    } else {
      res.json({ message: "failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/orders", async (req, res) => {
  try {
    const ordersQuery = `
      SELECT orders.*, users.first_name, users.last_name, ebooks.ebook_price
      FROM orders
      LEFT JOIN users ON users.id = orders.user_id
      LEFT JOIN ebooks ON ebooks.id = orders.ebook_id
      LEFT JOIN order_status ON order_status.order_id = orders.id`;

    const [orders] = await db.query(ordersQuery);

    res.json({ orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/canceledOrders", async (req, res) => {
  try {
    const canceledOrdersQuery = `
      SELECT orders.*, users.first_name, users.last_name, ebooks.ebook_price
      FROM orders
      LEFT JOIN users ON users.id = orders.user_id
      LEFT JOIN ebooks ON ebooks.id = orders.ebook_id
      LEFT JOIN order_status ON order_status.order_id = orders.id
      WHERE orders.status = 'canceld'`;

    const [canceledOrders] = await db.query(canceledOrdersQuery);

    res.json({ canceledOrders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/completedOrders", async (req, res) => {
  try {
    const completedOrdersQuery = `
      SELECT orders.*, users.first_name, users.last_name, ebooks.ebook_price
      FROM orders
      LEFT JOIN users ON users.id = orders.user_id
      LEFT JOIN ebooks ON ebooks.id = orders.ebook_id
      LEFT JOIN order_status ON order_status.order_id = orders.id
      WHERE orders.status = 'completed'`;

    const [completedOrders] = await db.query(completedOrdersQuery);

    res.json({ completedOrders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/videos", async (req, res) => {
  try {
    const videosQuery = `SELECT * FROM videos ORDER BY id DESC`;

    const [videos] = await db.query(videosQuery);

    res.json({ videos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/videos/add", async (req, res) => {
  try {
    const { embed_link, title, duration } = req.body;

    const insertQuery = `
      INSERT INTO videos (embed_link, title, duration)
      VALUES (?, ?, ?)
    `;

    await db.query(insertQuery, [embed_link, title, duration]);

    res.json({ message: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/admin/videos/delete/:id", async (req, res) => {
  try {
    const videoId = req.params.id;

    const deleteQuery = `
      DELETE FROM videos WHERE id = ?
    `;

    await db.query(deleteQuery, [videoId]);

    res.json({ message: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/videos/search", async (req, res) => {
  try {
    const searchTerm = req.query.searchTerm;

    const searchQuery = `
      SELECT * FROM videos WHERE title LIKE ?
    `;

    const [videos] = await db.query(searchQuery, [`%${searchTerm}%`]);

    res.json(videos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/tests", async (req, res) => {
  try {
    const [testLoad] = await db.query(
      "SELECT * FROM mock_test_category2 ORDER BY id DESC"
    );
    const [category] = await db.query("SELECT * FROM mock_test_category");

    res.json({ testLoad, category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/getTestCategory", async (req, res) => {
  try {
    const [categories] = await db.query("SELECT * FROM mock_test_category");

    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/addTestCategory", async (req, res) => {
  const { title } = req.body;

  try {
    const insertResult = await db.query(
      "INSERT INTO mock_test_category (category_name) VALUES (?)",
      [title]
    );

    if (insertResult.affectedRows > 0) {
      res.json({ message: "success" });
    } else {
      res.json({ message: "failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/getTestCategoryOptions", async (req, res) => {
  try {
    const [categories] = await db.query("SELECT * FROM mock_test_category");

    let data = '<option value="">All</option>';
    categories.forEach((category) => {
      data +=
        '<option value="' +
        category.id +
        '">' +
        category.category_name +
        "</option>";
    });

    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/getTestLoad", async (req, res) => {
  const mockTestId = req.query.id;

  try {
    let testLoad;
    if (mockTestId) {
      [testLoad] = await db.query(
        "SELECT * FROM mock_test_category2 WHERE mock_test_id = ? ORDER BY id DESC",
        [mockTestId]
      );
    } else {
      [testLoad] = await db.query(
        "SELECT * FROM mock_test_category2 ORDER BY id DESC"
      );
    }

    res.json({ testLoad });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post(
  "/admin/addTestCategorySectionm",
  upload.single("book_image"),
  async (req, res) => {
    const { test_title, test_category } = req.body;
    const pdfImage = req.file ? `image/${req.file.filename}` : "";

    try {
      const insert = await db.query(
        "INSERT INTO mock_test_category2 (category_name, mock_test_id, img) VALUES (?, ?, ?)",
        [test_title, test_category, pdfImage]
      );
      if (insert.insertId) {
        res.json({ message: "success" });
      } else {
        res.json({ message: "failed" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Image upload failed, Try again" });
    }
  }
);

router.get("/admin/getEditTestCatePageData", async (req, res) => {
  const categoryId = req.query.id;

  try {
    const [data] = await db.query(
      "SELECT * FROM mock_test_category2 WHERE id = ?",
      [categoryId]
    );
    const [category] = await db.query("SELECT * FROM mock_test_category");

    res.json({ data, category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/deleteTestCate", async (req, res) => {
  const categoryId = req.body.id;

  try {
    const deleteResult = await db.query(
      "DELETE FROM mock_test_category2 WHERE id = ?",
      [categoryId]
    );

    if (deleteResult.affectedRows > 0) {
      res.json({ message: "success" });
    } else {
      res.json({ message: "failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/admin/editBook", upload.single("book_image"), async (req, res) => {
  const { id, test_title, test_category, oldimg } = req.body;
  const pdfImage = req.file ? `image/${req.file.filename}` : oldimg;

  try {
    const update = await db.query(
      "UPDATE mock_test_category2 SET category_name = ?, mock_test_id = ?, img = ? WHERE id = ?",
      [test_title, test_category, pdfImage, id]
    );
    if (update.affectedRows > 0) {
      res.json({ message: "success" });
    } else {
      res.json({ message: "failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Update failed, Try again" });
  }
});

router.post("/admin/viewtestcatepage", async (req, res) => {
  const categoryId = req.body.id;

  try {
    const [category] = await db.query(
      "SELECT * FROM test_category WHERE mock_test_category2_id = ?",
      [categoryId]
    );
    const [testLoad] = await db.query(
      `
      SELECT test.*, test_category.*, test.id AS test_id
      FROM test
      JOIN test_category ON test_category.id = test.test_category
      WHERE test_category.mock_test_category2_id = ?
      ORDER BY test.id DESC
    `,
      [categoryId]
    );

    res.json({ category, testLoad });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/addtesttestCategory", async (req, res) => {
  const { title, mock_test_category2_id } = req.body;

  try {
    const insertResult = await db.query(
      "INSERT INTO test_category (category_name, mock_test_category2_id) VALUES (?, ?)",
      [title, mock_test_category2_id]
    );
    if (insertResult.affectedRows > 0) {
      const [cate] = await db.query(
        "SELECT * FROM test_category WHERE mock_test_category2_id = ?",
        [mock_test_category2_id]
      );
      let data = '<option value="">All</option>';
      for (const category of cate) {
        data += `<option value="${category.id}">${category.category_name}</option>`;
      }
      res.json({ data });
    } else {
      res.json({ message: "failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/fetchTestCategories/:id", async (req, res) => {
  const mockTestCategoryId = req.params.id;

  try {
    const [categories] = await db.query(
      "SELECT * FROM test_category WHERE mock_test_category2_id = ?",
      [mockTestCategoryId]
    );
    res.json({ categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/addTest", upload.single("book_image"), async (req, res) => {
  const pdfImage = req.file ? `image/${req.file.filename}` : null;

  const {
    test_title,
    test_duration,
    test_price,
    test_category,
    mock_test_category2_id,
  } = req.body;

  try {
    const insert = await db.query(
      "INSERT INTO test (test_title, total_timing, price, test_category, mock_test_category2_id, img) VALUES (?, ?, ?, ?, ?, ?)",
      [
        test_title,
        test_duration,
        test_price,
        test_category,
        mock_test_category2_id,
        pdfImage,
      ]
    );

    if (insert) {
      res.json({ message: "success" });
    } else {
      res.json({ message: "failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/getQuestions/:testId", async (req, res) => {
  const { testId } = req.params;

  try {
    const [questions] = await db.query(
      "SELECT * FROM questions WHERE test_id = ?",
      [testId]
    );

    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/addQuestion", async (req, res) => {
  const {
    q_hin,
    q_eng,
    opt_1_hin,
    opt_1,
    opt_2_hin,
    opt_2,
    opt_3_hin,
    opt_3,
    opt_4_hin,
    opt_4,
    ans,
    plus,
    min,
    test_id,
  } = req.body;

  try {
    const insertResult = await db.query(
      "INSERT INTO questions (question_hindi, question_english, opt1_hindi, opt1_eng, opt2_hindi, opt2_eng, opt3_hindi, opt3_eng, opt4_hindi, opt4_eng, correct_ans, positive, nagetive, test_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        q_hin,
        q_eng,
        opt_1_hin,
        opt_1,
        opt_2_hin,
        opt_2,
        opt_3_hin,
        opt_3,
        opt_4_hin,
        opt_4,
        ans,
        plus,
        min,
        test_id,
      ]
    );

    if (insertResult.affectedRows > 0) {
      res.json({ message: "success" });
    } else {
      res.status(500).json({ message: "Failed to insert question" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/admin/updateQuestion", async (req, res) => {
  const {
    Question_id,
    q_hin,
    q_eng,
    opt_1_hin,
    opt_1,
    opt_2_hin,
    opt_2,
    opt_3_hin,
    opt_3,
    opt_4_hin,
    opt_4,
    ans,
    plus,
    min,
    test_id,
  } = req.body;

  try {
    const updateResult = await db.query(
      "UPDATE questions SET question_hindi = ?, question_english = ?, opt1_hindi = ?, opt1_eng = ?, opt2_hindi = ?, opt2_eng = ?, opt3_hindi = ?, opt3_eng = ?, opt4_hindi = ?, opt4_eng = ?, correct_ans = ?, positive = ?, nagetive = ?, test_id = ? WHERE id = ?",
      [
        q_hin,
        q_eng,
        opt_1_hin,
        opt_1,
        opt_2_hin,
        opt_2,
        opt_3_hin,
        opt_3,
        opt_4_hin,
        opt_4,
        ans,
        plus,
        min,
        test_id,
        Question_id,
      ]
    );

    if (updateResult.affectedRows > 0) {
      res.json({ message: "success" });
    } else {
      res.status(500).json({ message: "Failed to update question" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/getQuestion/:id", async (req, res) => {
  const questionId = req.params.id;

  try {
    const [question] = await db.query("SELECT * FROM questions WHERE id = ?", [
      questionId,
    ]);

    if (question.length > 0) {
      res.json(question[0]);
    } else {
      res.status(404).json({ message: "Question not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/getBanners", async (req, res) => {
  try {
    const [banners] = await db.query("SELECT * FROM banners ORDER BY id DESC");
    res.json(banners);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post(
  "/admin/addBanners",
  upload.single("banner_image"),
  async (req, res) => {
    try {
      const { type, status } = req.body;
      const bannerImg = req.file.filename;

      const insertQuery =
        "INSERT INTO banners (banner_img, type, status) VALUES (?, ?, ?)";
      const insertValues = [bannerImg, type, status];

      await db.query(insertQuery, insertValues);

      res.json({ message: "success" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.post("/admin/deleteBanners", async (req, res) => {
  try {
    const { id } = req.body;

    const deleteQuery = "DELETE FROM banners WHERE id = ?";
    const deleteValues = [id];

    await db.query(deleteQuery, deleteValues);

    res.json({ message: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/getFooterData", async (req, res) => {
  try {
    const [footerData] = await db.query(
      "SELECT * FROM footer ORDER BY id DESC"
    );
    res.json(footerData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/addFooterData", async (req, res) => {
  const { footer_link, footer_colomn, footer_title, status } = req.body;
  const statusValue = status === "on" ? "active" : "deactive";

  try {
    const insertQuery = `
      INSERT INTO footer (footer_link, footer_colomn, footer_name, status)
      VALUES (?, ?, ?, ?)
    `;
    await db.query(insertQuery, [
      footer_link,
      footer_colomn,
      footer_title,
      statusValue,
    ]);

    res.json({ message: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin/deleteFooterData", async (req, res) => {
  const { id } = req.body;

  try {
    const deleteQuery = `
      DELETE FROM footer
      WHERE id = ?
    `;
    await db.query(deleteQuery, [id]);

    res.json({ message: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// <--------------------->

router.post("/signUp-check", upload.single("profile"), async (req, res) => {
  try {
    let email = req.body.email;
    let phone = req.body.phone;
    let profilePath = null;

    const [emailUsers] = await db.execute(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );
    if (emailUsers.length > 0) {
      return res.status(400).send("Email already exists");
    }

    const [phoneUsers] = await db.execute(
      `SELECT * FROM users WHERE phone = ?`,
      [phone]
    );
    if (phoneUsers.length > 0) {
      return res.status(400).send("Phone number already exists");
    }

    if (req.file) {
      profilePath = "image/" + req.file.filename;
    }

    const code = Math.floor(100000 + Math.random() * 900000);
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const referenceCode = "SDP" + crypto.randomBytes(4).toString("hex");

    let query = `
            INSERT INTO users (first_name, last_name, email, phone, password, code, reference_code)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

    let parameters = [
      req.body.first_name,
      req.body.last_name,
      email,
      phone,
      hashedPassword,
      code,
      referenceCode,
    ];

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
        service: "gmail",
        auth: {
          user: "trusher@gmail.com",
          pass: "Sd Campus Publication",
        },
      });

      const mailOptions = {
        from: "trusher@gmail.com",
        to: email,
        subject: "Otp Verification",
        text: `Hello ${req.body.first_name} ${req.body.last_name}, Here is your OTP: ${code}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
          return res.status(500).send("Email sending failed");
        } else {
          console.log("Email sent: " + info.response);
          return res.send("success");
        }
      });
    } else {
      res.status(500).send("failed");
    }
  } catch (error) {
    res.status(500).send("Database error: " + error.message);
  }
});

module.exports = router;

// Online Payment
// Order Full Proccess .Order .Cancel ...
// Auth
