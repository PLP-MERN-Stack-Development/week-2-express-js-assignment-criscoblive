// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory database for demonstration
let products = [
  {
    id: '1',
    name: 'Laptop',
    description: 'High-performance laptop',
    price: 999.99,
    category: 'Electronics',
    inStock: true
  },
  {
    id: '2',
    name: 'Desk Chair',
    description: 'Ergonomic office chair',
    price: 199.99,
    category: 'Furniture',
    inStock: true
  }
];

// Middleware
app.use(bodyParser.json());

// Custom logger middleware
const logger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
};

app.use(logger);

// Authentication middleware
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    throw new UnauthorizedError('Invalid API key');
  }
  next();
};

// Custom error classes
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

// Validation middleware
const validateProduct = (req, res, next) => {
  const product = req.body;
  if (!product.name || !product.price) {
    throw new ValidationError('Name and price are required');
  }
  if (typeof product.price !== 'number' || product.price <= 0) {
    throw new ValidationError('Price must be a positive number');
  }
  next();
};

// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Get all products with filtering and pagination
app.get('/api/products', (req, res) => {
  let result = [...products];
  
  // Filter by category
  if (req.query.category) {
    result = result.filter(p => p.category === req.query.category);
  }
  
  // Search by name
  if (req.query.search) {
    const searchTerm = req.query.search.toLowerCase();
    result = result.filter(p => 
      p.name.toLowerCase().includes(searchTerm) || 
      p.description.toLowerCase().includes(searchTerm)
    );
  }
  
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const paginatedResult = result.slice(startIndex, endIndex);
  
  res.json({
    total: result.length,
    page,
    totalPages: Math.ceil(result.length / limit),
    data: paginatedResult
  });
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }
  res.json(product);
});

// Create new product (protected)
app.post('/api/products', authenticate, validateProduct, (req, res) => {
  const newProduct = {
    id: uuidv4(),
    name: req.body.name,
    description: req.body.description || '',
    price: req.body.price,
    category: req.body.category || 'Uncategorized',
    inStock: req.body.inStock !== undefined ? req.body.inStock : true
  };
  
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// Update product (protected)
app.put('/api/products/:id', authenticate, validateProduct, (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    throw new NotFoundError('Product not found');
  }
  
  products[index] = {
    ...products[index],
    name: req.body.name,
    description: req.body.description || products[index].description,
    price: req.body.price,
    category: req.body.category || products[index].category,
    inStock: req.body.inStock !== undefined ? req.body.inStock : products[index].inStock
  };
  
  res.json(products[index]);
});

// Delete product (protected)
app.delete('/api/products/:id', authenticate, (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    throw new NotFoundError('Product not found');
  }
  
  products = products.filter(p => p.id !== req.params.id);
  res.status(204).send();
});

// Product statistics
app.get('/api/products/stats', (req, res) => {
  const stats = {
    totalProducts: products.length,
    categories: {},
    inStock: products.filter(p => p.inStock).length,
    outOfStock: products.filter(p => !p.inStock).length
  };
  
  products.forEach(product => {
    stats.categories[product.category] = (stats.categories[product.category] || 0) + 1;
  });
  
  res.json(stats);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: err.message,
      type: err.name || 'InternalServerError'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
