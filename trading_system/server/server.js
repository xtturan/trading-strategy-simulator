const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, '../data/trades.json');

// Middleware
app.use(cors());
app.use(express.json());

// Ensure data directory exists
async function ensureDataFile() {
  try {
    await fs.access(path.dirname(DATA_FILE));
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  }
  
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]');
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all data
app.get('/api/data', async (req, res) => {
  try {
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    res.json({ data, count: data.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// Add single number
app.post('/api/data', async (req, res) => {
  try {
    const { number } = req.body;
    
    if (typeof number !== 'number' || number < 0 || number > 9) {
      return res.status(400).json({ error: 'Invalid number (must be 0-9)' });
    }

    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    data.push(number);
    
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    
    res.json({ 
      message: 'Number added', 
      number,
      total: data.length 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add number' });
  }
});

// Bulk add numbers
app.post('/api/data/bulk', async (req, res) => {
  try {
    const { data: newNumbers } = req.body;
    
    if (!Array.isArray(newNumbers)) {
      return res.status(400).json({ error: 'Data must be an array' });
    }

    // Validate all numbers
    if (!newNumbers.every(n => typeof n === 'number' && n >= 0 && n <= 9)) {
      return res.status(400).json({ error: 'All items must be numbers 0-9' });
    }

    const existingData = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    const updatedData = [...existingData, ...newNumbers];
    
    await fs.writeFile(DATA_FILE, JSON.stringify(updatedData, null, 2));
    
    res.json({ 
      message: `Added ${newNumbers.length} numbers`, 
      total: updatedData.length 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add bulk data' });
  }
});

// Get prediction (simple volatility breakout strategy)
app.get('/api/predict', async (req, res) => {
  try {
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    
    if (data.length < 10) {
      return res.json({ 
        prediction: null, 
        confidence: 0,
        reason: 'Insufficient data'
      });
    }

    // Get last 20 numbers for analysis
    const recentNumbers = data.slice(-20);
    
    // Calculate volatility (average absolute difference)
    let volatilitySum = 0;
    for (let i = 1; i < recentNumbers.length; i++) {
      volatilitySum += Math.abs(recentNumbers[i] - recentNumbers[i-1]);
    }
    const avgVolatility = volatilitySum / (recentNumbers.length - 1);
    
    // Calculate recent mean
    const recentMean = recentNumbers.reduce((a, b) => a + b, 0) / recentNumbers.length;
    
    // Get last number
    const lastNumber = recentNumbers[recentNumbers.length - 1];
    
    let prediction, confidence, reason;
    
    if (avgVolatility > 2.0) {
      // High volatility - trend continuation
      prediction = lastNumber >= 5 ? 'BIG' : 'SMALL';
      confidence = 70;
      reason = `High volatility (${avgVolatility.toFixed(1)}) trend continuation`;
    } else if (lastNumber >= 5) {
      // Normal case - recent high number suggests BIG
      prediction = 'BIG';
      confidence = 60;
      reason = `Last result ${lastNumber} >= 5`;
    } else {
      // Recent low number suggests SMALL
      prediction = 'SMALL';
      confidence = 60;
      reason = `Last result ${lastNumber} < 5`;
    }
    
    res.json({ 
      prediction,
      confidence,
      reason,
      volatility: avgVolatility,
      recentMean
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

// Delete specific entry
app.delete('/api/data/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    
    if (index < 0 || index >= data.length) {
      return res.status(404).json({ error: 'Index out of range' });
    }
    
    data.splice(index, 1);
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    
    res.json({ 
      message: 'Entry deleted', 
      remaining: data.length 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Start server
async function startServer() {
  await ensureDataFile();
  
  app.listen(PORT, () => {
    console.log(`🚀 Trading Server running on http://localhost:${PORT}`);
    console.log(`📂 Data file: ${DATA_FILE}`);
  });
}

startServer().catch(console.error);