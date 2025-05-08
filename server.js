require('dotenv').config();

const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const twilio = require('twilio');
const multer = require('multer');
const app = express();
const upload = multer();

app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.json());
app.use(cors());
app.use(bodyParser.json({
  limit: '10mb'
}));
app.use(express.urlencoded({
  limit: '10mb',
  extended: true
}));



const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const twilioClient = twilio(accountSid, authToken);

// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT
// });



// db.connect(err => {
//   if (err) {
//     console.error('MySQL Connection Error:', err);
//     return;
//   }
//   console.log(' MySQL Connected to freesql...');
// });



let db;

function handleDisconnect() {
  db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  db.connect(err => {
    if (err) {
      console.error('Error connecting to MySQL:', err);
      setTimeout(handleDisconnect, 2000); // Retry connection after 2 seconds
    } else {
      console.log('MySQL Connected...');
    }
  });

  db.on('error', err => {
    console.error('MySQL Error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('Reconnecting to MySQL...');
      handleDisconnect(); // Reconnect on connection loss
    } else {
      throw err;
    }
  });
}

handleDisconnect();


// Add product to cart
app.post('/api/add-to-cart', (req, res) => {
  const {
    productId,
    productName,
    productPrice
  } = req.body;

  const checkQuery = "SELECT * FROM cart WHERE product_id = ?";
  db.query(checkQuery, [productId], (err, result) => {
    if (err) {
      console.error('Error checking cart:', err);
      return res.json({
        success: false,
        error: err
      });
    }

    if (result.length > 0) {
      return res.json({
        success: false,
        message: "Product already in cart"
      });
    }

    const insertQuery = "INSERT INTO cart (product_id, product_name, product_price) VALUES (?, ?, ?)";
    db.query(insertQuery, [productId, productName, productPrice], (err, result) => {
      if (err) {
        console.error('Error adding to cart:', err);
        return res.json({
          success: false,
          error: err
        });
      }
      res.json({
        success: true
      });
    });
  });
});

// Get cart products
app.get('/api/cart', (req, res) => {
  const query = "SELECT * FROM cart";
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching cart:', err);
      return res.json({
        success: false,
        error: err
      });
    }
    res.json({
      success: true,
      cart: results
    });
  });
});

// Remove product from cart
app.delete('/api/remove-from-cart/:productId', (req, res) => {
  const {
    productId
  } = req.params;

  const deleteQuery = "DELETE FROM cart WHERE product_id = ?";
  db.query(deleteQuery, [productId], (err, result) => {
    if (err) {
      console.error('Error removing from cart:', err);
      return res.json({
        success: false,
        error: err
      });
    }
    res.json({
      success: true
    });
  });
});


// Save product
app.post('/api/save-product', (req, res) => {
  const {
    productId,
    productName,
    productPrice
  } = req.body;

  const checkQuery = "SELECT * FROM saved WHERE product_id = ?";
  db.query(checkQuery, [productId], (err, result) => {
    if (err) return res.json({
      success: false,
      error: err
    });

    if (result.length > 0) {
      return res.json({
        success: false,
        message: "Product already saved"
      });
    }

    const insertQuery = "INSERT INTO saved (product_id, product_name, product_price) VALUES (?, ?, ?)";
    db.query(insertQuery, [productId, productName, productPrice], (err, result) => {
      if (err) return res.json({
        success: false,
        error: err
      });

      res.json({
        success: true
      });
    });
  });
});

// Get saved products
app.get('/api/saved-products', (req, res) => {
  db.query("SELECT * FROM saved", (err, results) => {
    if (err) return res.json({
      success: false,
      error: err
    });

    res.json({
      success: true,
      saved: results
    });
  });
});

// Remove saved product
app.delete('/api/remove-saved-product/:productId', (req, res) => {
  const {
    productId
  } = req.params;

  db.query("DELETE FROM saved WHERE product_id = ?", [productId], (err, result) => {
    if (err) return res.json({
      success: false,
      error: err
    });

    res.json({
      success: true
    });
  });
});

app.use(express.static(path.join(__dirname,'frontend')));

// Serve order.html
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, '../frontend', 'Rathamapp.html'));
// });



app.use(cors({
  origin: 'https://frontend-uoj7.onrender.com' // Allow requests from the frontend
}));
app.get('/', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/Rathamapp.html');
});

app.post('/submit-order', (req, res) => {
  console.log("Received form submission:", req.body); // Debugging log

  const {
    name,
    phone
  } = req.body;
  if (!name || !phone) {
    console.log(" Missing name or phone");
    return res.status(400).send(" Name and phone are required!");
  }

  const checkQuery = "SELECT * FROM orders WHERE phone = ?";
  db.query(checkQuery, [phone], (err, results) => {
    if (err) {
      console.error(" Database Error:", err);
      return res.status(500).send(" Database error");
    }

    if (results.length > 0) {
      console.log(" Phone already exists");
    } else {
      const insertQuery = "INSERT INTO orders (name, phone) VALUES (?, ?)";
      db.query(insertQuery, [name, phone], (err, result) => {
        if (err) {
          console.error(" Insert Failed:", err);
          return res.status(500).send(" Insert failed");
        }
        console.log(" Order inserted:", result.insertId);
      });
    }

    // Send SMS
    twilioClient.messages
      .create({
        body: `New Order\nName: ${name}\nPhone: ${phone}`,
        from: process.env.TWILIO_PHONE_FROM,
        to: process.env.TWILIO_PHONE_TO
      })
      .then(message => {

        res.redirect('https://frontend-uoj7.onrender.com/sent.html');

      })
      .catch(err => {
        console.error(" SMS Error:", err);
        res.status(500).send(" Failed to send SMS");
      });
  });
});


// Signup Route
app.post('/signup', (req, res) => {
  const {
    Firstname,
    Lastname,
    number,
    password
  } = req.body;


  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.log(err);
      return res.status(500).json({
        error: "Error hashing password"
      });
    }

    const sql = "INSERT INTO signin (Firstname, Lastname, number, password) VALUES (?, ?, ?, ?)";
    db.query(sql, [Firstname, Lastname, number, hashedPassword], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({
          error: "Signup Failed"
        });
      }
      res.status(200).json({
        message: "Signup Successful"
      });
    });
  });
});



// // Login Route
app.post('/login', (req, res) => {
  const {
    number,
    password
  } = req.body;

  const query = "SELECT * FROM signin WHERE number = ?";
  db.query(query, [number], async (err, results) => {
    if (err) {
      console.error('Login Error:', err);
      return res.status(500).json({
        error: "Internal server error"
      });
    }

    if (results.length === 0) {
      return res.status(401).json({
        error: "Invalid Number or Password"
      });
    }

    const user = results[0];
try {
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid Number or Password"
      });
    }

    // Send SMS to owner after successful login
    twilioClient.messages.create({
      body: `User with number ${number} has logged in.`,
      from: process.env.TWILIO_PHONE_FROM,
      to: process.env.TWILIO_PHONE_TO
    });

    res.status(200).json({
      message: "Login successful"
    });
    } catch (err) {
      console.error("Error during password comparison or SMS:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});





// POST endpoint to save profile data
app.post('/api/profile', (req, res) => {
  const {
    name,
    number,
    address,
    profileImage
  } = req.body;

  // Ensure that the profile is saved under the correct phone number
  const sql = 'INSERT INTO profiles (name, phone_number, address, profile_image) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, address = ?, profile_image = ?';
  db.query(sql, [name, number, address, profileImage, name, address, profileImage], (err, result) => {
    if (err) {
      console.error('Error saving profile:', err);
      res.status(500).json({
        error: 'Failed to save profile data'
      });
      return;
    }
    res.status(200).json({
      message: 'Profile saved successfully'
    });
  });
});

// GET endpoint to retrieve profile data for the logged-in user (using their phone number)
app.get('/api/profile', (req, res) => {
  const {
    phoneNumber
  } = req.query; // Fetch phone number from query params or session

  if (!phoneNumber) {
    return res.status(400).json({
      error: 'Phone number is required'
    });
  }

  // Fetch profile data specific to the logged-in phone number
  const sql = 'SELECT * FROM profiles WHERE phone_number = ? LIMIT 1';
  db.query(sql, [phoneNumber], (err, results) => {
    if (err) {
      console.error('Error fetching profile:', err);
      res.status(500).json({
        error: 'Failed to fetch profile data'
      });
      return;
    }
    if (results.length > 0) {
      res.status(200).json(results[0]);
    } else {
      res.status(404).json({
        message: 'No profile data found'
      });
    }
  });
});



app.get('/signup', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/signup.html');
});

app.get('/login', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/login.html');
});

app.get('/Rathamapp', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/Rathamapp.html');
});

app.get('/sent', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/sent.html');
});

app.get('/about', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/about.html');
});
app.get('/contact', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/contact.html');
});
app.get('/mainabout', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/mainabout.html');
});
app.get('/maincontact', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/maincontact.html');
});
app.get('/dupliproducts', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/dupliproducts.html');
});

app.get('/mainapp', (req, res) => {
  res.redirect('https://frontend-uoj7.onrender.com/mainapp.html');
});




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

