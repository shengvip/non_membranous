import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import * as xlsx from 'xlsx';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// File-based storage for the uploaded data (to persist across requests)
const DATA_FILE = path.join(process.cwd(), 'data.json');

function getCurrentData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading data file:', e);
  }
  return { data: [], columns: [] };
}

function saveCurrentData(data: any[], columns: string[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ data, columns }), 'utf-8');
  } catch (e) {
    console.error('Error writing data file:', e);
  }
}

// API Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    let data: any[] = [];
    
    if (ext === '.csv' || ext === '.xls' || ext === '.xlsx') {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(worksheet, { defval: null });
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      saveCurrentData(data, columns);
      res.json({ message: 'File uploaded successfully', rows: data.length, columns: columns });
    } else {
      return res.status(400).json({ error: 'File is empty or could not be parsed' });
    }
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file: ' + error.message });
  }
});

app.get('/api/data', (req, res) => {
  const { data, columns } = getCurrentData();
  res.json({ data, columns });
});

app.post('/api/data', (req, res) => {
  const { data } = req.body;
  if (Array.isArray(data)) {
    let columns: string[] = [];
    if (data.length > 0) {
      columns = Object.keys(data[0]);
    }
    saveCurrentData(data, columns);
    res.json({ message: 'Data updated successfully' });
  } else {
    res.status(400).json({ error: 'Invalid data format' });
  }
});

// Helper function to preprocess data (replace missing with mode)
function preprocessData(data: any[], columns: string[]) {
  const processedData = JSON.parse(JSON.stringify(data));
  
  const isMissing = (val: any) => {
    if (val === null || val === undefined || val === '') return true;
    const strVal = String(val).trim().toLowerCase();
    return strVal === 'n/a' || strVal === 'nan' || strVal === 'null';
  };

  columns.forEach(col => {
    const frequency: Record<string, number> = {};
    let maxFreq = 0;
    let mode = '';

    processedData.forEach((row: any) => {
      const val = row[col];
      if (!isMissing(val)) {
        const strVal = String(val);
        frequency[strVal] = (frequency[strVal] || 0) + 1;
        if (frequency[strVal] > maxFreq) {
          maxFreq = frequency[strVal];
          mode = strVal;
        }
      }
    });

    if (mode !== '') {
      processedData.forEach((row: any, idx: number) => {
        if (isMissing(row[col])) {
          processedData[idx][col] = mode;
        }
      });
    }
  });

  return processedData;
}

// Mock ML training endpoint
app.post('/api/train', (req, res) => {
  const { model, data: reqData, columns: reqColumns } = req.body;
  const { data: currentData, columns: currentColumns } = reqData ? { data: reqData, columns: reqColumns } : getCurrentData();
  
  if (!currentData || currentData.length === 0) {
    return res.status(400).json({ error: 'No data available for training' });
  }

  // Check if 'level' column exists
  if (!currentColumns.includes('level')) {
    return res.status(400).json({ error: 'Target column "level" not found in data' });
  }

  // Preprocess data: replace missing values with mode
  const processedData = preprocessData(currentData, currentColumns);

  // Simulate training delay
  setTimeout(() => {
    const metrics = generateMetricsForModel(model);
    res.json({ model, metrics, message: 'Data preprocessed (missing values replaced with mode) and model trained successfully.' });
  }, 1500);
});

app.post('/api/train-all', (req, res) => {
  const { data: reqData, columns: reqColumns } = req.body;
  const { data: currentData, columns: currentColumns } = reqData ? { data: reqData, columns: reqColumns } : getCurrentData();

  if (!currentData || currentData.length === 0) {
    return res.status(400).json({ error: 'No data available for training' });
  }

  if (!currentColumns.includes('level')) {
    return res.status(400).json({ error: 'Target column "level" not found in data' });
  }

  // Preprocess data: replace missing values with mode
  const processedData = preprocessData(currentData, currentColumns);

  setTimeout(() => {
    const models = ['XGBoost', 'CatBoost', 'random forest', 'decision tree', 'Elastic Net', 'LightGBM', '人工神经网络'];
    const results = models.map(model => ({
      model,
      metrics: generateMetricsForModel(model)
    }));
    res.json({ results, message: 'Data preprocessed (missing values replaced with mode) and all models trained successfully.' });
  }, 3000);
});

function generateMetricsForModel(model: string) {
  const generateMetrics = (baseAcc: number) => {
    const variance = 0.05;
    const acc = baseAcc + (Math.random() * variance - variance / 2);
    return {
      accuracy: acc.toFixed(4),
      precision: (acc - 0.02 + Math.random() * 0.04).toFixed(4),
      recall: (acc - 0.03 + Math.random() * 0.06).toFixed(4),
      specificity: (acc + 0.01 + Math.random() * 0.03).toFixed(4),
      f1Score: (acc - 0.01 + Math.random() * 0.02).toFixed(4),
      mcc: (acc - 0.1 + Math.random() * 0.05).toFixed(4),
    };
  };

  switch (model) {
    case 'XGBoost': return generateMetrics(0.88);
    case 'CatBoost': return generateMetrics(0.89);
    case 'random forest': return generateMetrics(0.85);
    case 'decision tree': return generateMetrics(0.78);
    case 'Elastic Net': return generateMetrics(0.75);
    case 'LightGBM': return generateMetrics(0.87);
    case '人工神经网络': return generateMetrics(0.86);
    default: return generateMetrics(0.80);
  }
}

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
