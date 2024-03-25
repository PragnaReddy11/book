// Include all libraries needed
const express = require('express');
const mysql = require('mysql2');
require('dotenv').config();
const app = express();

// Wait 1 secound
console.log('Trying to connect');

// MySQL connection
const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

// Connect to database
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to database');
});

// Drop books table before creating the table to ensure db errors are mitiagated
connection.query(` DROP TABLE IF EXISTS books; `, (err, results) => {
  if (err) throw err;
  console.log('Books table dropped!');
});

// Drop customer table before creating the table to ensure db errors are mitiagated
connection.query(` DROP TABLE IF EXISTS customers; `, (err, results) => {
  if (err) throw err;
  console.log('Customers table dropped!');
});

// Create books table by the given schema
connection.query(
  ` CREATE TABLE IF NOT EXISTS books (
  ISBN VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255),
  Author VARCHAR(255),
  description TEXT,
  genre VARCHAR(255),
  price DECIMAL(10, 2), -- Decimal with precision 10 and scale 2
  quantity INT
);`,
  (err, results) => {
    if (err) throw err;
    console.log('Books table created!');
  }
);

// Create customers table by the given schema
connection.query(
  `CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  phone VARCHAR(15),
  address TEXT,
  address2 TEXT,
  city VARCHAR(255),
  state VARCHAR(255),
  zipcode VARCHAR(10)
);
`,
  (err, results) => {
    if (err) throw err;
    console.log('customers table created!');
  }
);

// Middleware for JSON parsing
app.use(express.json());

// Add Book endpoint
app.post('/books', (req, res) => {
  const book = req.body;
  const { ISBN } = book;

  // Check if all fields are present
  if (
    !ISBN ||
    !book.title ||
    !book.Author ||
    !book.description ||
    !book.genre ||
    !book.price ||
    !book.quantity
  ) {
    res
      .status(400)
      .json({ message: 'All fields in the request body are mandatory.' });
    return;
  }

  // Check if price is a valid number with 2 decimal places
  if (!/^\d+(\.\d{1,2})?$/.test(book.price)) {
    res
      .status(400)
      .json({ message: 'Price must be a valid number with 2 decimal places.' });
    return;
  }

  // Check if ISBN already exists
  connection.query(
    'SELECT * FROM books WHERE ISBN = ?',
    ISBN,
    (err, results) => {
      if (err) {
        console.error('Error querying MySQL: ', err);
        res.status(500).json({ message: 'Internal Server Error' });
        return;
      }
      // ISBN already exists in the system
      if (results.length > 0) {
        res
          .status(422)
          .json({ message: 'This ISBN already exists in the system.' });
        return;
      }

      // Insert book into the database
      connection.query(
        'INSERT INTO books SET ?',
        { ...book, price: parseFloat(book.price) },
        (err) => {
          if (err) {
            console.error('Error inserting book into MySQL: ', err);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
          }
          // Success
          res.status(201).location(`/books/${ISBN}`).json(book);
        }
      );
    }
  );
});

// Update Book endpoint
app.put('/books/:ISBN', (req, res) => {
  const ISBN = req.params.ISBN;
  const book = req.body;
  // Validate all fields are present
  const requiredFields = [
    'ISBN',
    'title',
    'Author',
    'description',
    'genre',
    'price',
    'quantity',
  ];
  // Check all fields are present or not
  for (const field of requiredFields) {
    if (!book[field]) {
      return res
        .status(400)
        .json({ message: `Missing required field: ${field}` });
    }
  }
  // Validating ISBN and book should be present
  if (!ISBN || !book) {
    res.status(400).json({ message: 'Illegal, missing, or malformed input' });
    return;
  }
  // Validate price format
  if (!/^\d+(\.\d{1,2})?$/.test(book.price)) {
    res
      .status(400)
      .json({ message: 'Price must be a valid number with 2 decimal places' });
    return;
  }

  // Check if ISBN exists
  connection.query(
    'SELECT * FROM books WHERE ISBN = ?',
    ISBN,
    (err, results) => {
      if (err) {
        console.error('Error querying MySQL: ', err);
        res.status(500).json({ message: 'Internal Server Error' });
        return;
      }

      // ISBN not found
      if (results.length === 0) {
        res.status(404).json({ message: 'ISBN not found' });
        return;
      }

      // Update book in the database
      connection.query(
        'UPDATE books SET ? WHERE ISBN = ?',
        [book, ISBN],
        (err, results) => {
          if (err) {
            console.error('Error updating book in MySQL: ', err);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
          }
          // Success
          res.status(200).json(book);
        }
      );
    }
  );
});

// Retrieve Book endpoint
app.get(['/books/isbn/:ISBN', '/books/:ISBN'], (req, res) => {
  const ISBN = req.params.ISBN;

  // Retrieve book from the database
  connection.query(
    'SELECT * FROM books WHERE ISBN = ?',
    ISBN,
    (err, results) => {
      if (err) {
        console.error('Error querying MySQL: ', err);
        res.status(500).json({ message: 'Internal Server Error' });
        return;
      }
      // ISBN not found
      if (results.length === 0) {
        res.status(404).json({ message: 'ISBN not found' });
        return;
      }
      // Convert price to numeric value before returning
      const book = { ...results[0], price: parseFloat(results[0].price) };
      // Success
      res.status(200).json(book);
    }
  );
});

// Add Customer endpoint
app.post('/customers', (req, res) => {
  const customer = req.body;

  // Check if all fields are present
  if (
    !customer.userId ||
    !customer.name ||
    !customer.phone ||
    !customer.address ||
    !customer.city ||
    !customer.state ||
    !customer.zipcode
  ) {
    res.status(400).json({ message: 'Illegal, missing, or malformed input' });
    return;
  }

  // Check if userId is a valid email address
  if (!/\S+@\S+\.\S+/.test(customer.userId)) {
    res.status(400).json({ message: 'Illegal, missing, or malformed input' });
    return;
  }

  // Check if the state is valid
  const validStates = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
  ];

  // Check if state is from valid states array
  if (!validStates.includes(customer.state.toUpperCase())) {
    res.status(400).json({ message: 'Illegal, missing, or malformed input' });
    return;
  }

  // Check if the userId already exists in the system
  connection.query(
    'SELECT * FROM customers WHERE userId = ?',
    customer.userId,
    (err, results) => {
      if (err) {
        console.error('Error querying MySQL: ', err);
        res.status(500).json({ message: 'Internal Server Error' });
        return;
      }

      // If the userId already exists, return 422 status code
      if (results.length > 0) {
        res
          .status(422)
          .json({ message: 'This user ID already exists in the system.' });
        return;
      }

      // Insert customer into the database
      connection.query(
        'INSERT INTO customers SET ?',
        customer,
        (err, results) => {
          if (err) {
            console.error('Error inserting customer into MySQL: ', err);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
          }
          customer.id = results.insertId;
          res
            .status(201)
            .location(`/customers/${results.insertId}`)
            .json(customer);
        }
      );
    }
  );
});

// Retrieve custoer by id
app.get('/customers/:id', (req, res) => {
  const id = req.params.id;
  // Check if id is missing or malformed
  if (!id) {
    res.status(400).json({ message: 'Illegal, missing, or malformed input' });
    return;
  }

  // Check if id is not a valid integer
  if (!Number.isInteger(Number(id))) {
    res.status(400).json({ message: 'Illegal, missing, or malformed input' });
    return;
  }

  // Retrieve customer from the database
  connection.query(
    'SELECT * FROM customers WHERE id = ?',
    id,
    (err, results) => {
      if (err) {
        console.error('Error querying MySQL: ', err);
        res.status(500).json({ message: 'Internal Server Error' });
        return;
      }
      // No customer found with the ID
      if (results.length === 0) {
        res.status(404).json({ message: 'ID does not exist in the system' });
      } else {
        // Success
        res.status(200).json(results[0]);
      }
    }
  );
});

// Retrieve Customer by user ID endpoint
app.get('/customers', (req, res) => {
  const userId = req.query.userId;
  // Check if userId is missing or malformed
  if (!userId) {
    res.status(400).json({ message: 'Illegal, missing, or malformed input' });
    return;
  }

  // Check if userId is missing or malformed
  if (!userId || !/\S+@\S+\.\S+/.test(userId)) {
    res.status(400).json({ message: 'Illegal, missing, or malformed input' });
    return;
  }
  // Retrieve customer from the database using userId
  connection.query(
    'SELECT * FROM customers WHERE userId = ?',
    userId,
    (err, results) => {
      if (err) {
        console.error('Error querying MySQL: ', err);
        res.status(500).json({ message: 'Internal Server Error' });
        return;
      }
      // User does not exist in the system
      if (results.length === 0) {
        res
          .status(404)
          .json({ message: 'User-ID does not exist in the system' });
        return;
      }
      // Success
      res.status(200).json(results[0]);
    }
  );
});

// Start the server
app.listen(80, () => {
  console.log(`Server is running on http://localhost:80`);
});
