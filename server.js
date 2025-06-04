import express from 'express';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let currentRun = null;

app.post('/start', (req, res) => {
  const { email, password, month } = req.body;
  if (!email || !password || !month) return res.status(400).send('Brakuje danych.');

  fs.writeFileSync('.env', `EMAIL=${email}\nPASSWORD=${password}\nMONTH=${month}`);
  currentRun = spawn('node', ['run.js']);

  res.sendStatus(200);
});

app.get('/progress-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!currentRun) {
    res.write(`data: ${JSON.stringify({ line: '⛔ Brak aktywnego procesu' })}\n\n`);
    return;
  }

  const sendLine = (line) => {
    res.write(`data: ${JSON.stringify({ line })}\n\n`);
  };

  currentRun.stdout.on('data', chunk => {
    chunk.toString().split('\n').forEach(line => {
      if (line.trim()) sendLine(line.trim());
    });
  });

  currentRun.stderr.on('data', chunk => {
    chunk.toString().split('\n').forEach(line => {
      if (line.trim()) sendLine(`❌ ${line.trim()}`);
    });
  });

  currentRun.on('close', code => {
    sendLine(`✅ Zakończono z kodem ${code}`);

    const aggreg = spawn('node', ['agreguj.cjs']);
    aggreg.stdout.on('data', chunk => {
      chunk.toString().split('\n').forEach(line => {
        if (line.trim()) sendLine(`📊 ${line.trim()}`);
      });
    });
    aggreg.stderr.on('data', chunk => {
      chunk.toString().split('\n').forEach(line => {
        if (line.trim()) sendLine(`❌ ${line.trim()}`);
      });
    });

    aggreg.on('close', code => {
      sendLine(`📁 Agregacja zakończona z kodem ${code}`);
      res.end();
    });
  });
});

// Endpoint do pobierania pliku podsumowanie.csv i sprzątania po pobraniu
app.get('/podsumowanie.csv', (req, res) => {
  const filePath = path.join(__dirname, 'podsumowanie.csv');

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Plik nie znaleziony');
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error('Błąd przy wysyłaniu pliku:', err);
      // Nie usuwamy nic, bo pobranie się nie powiodło
      return;
    }

    // Usuwamy plik podsumowanie.csv
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error('Błąd usuwania podsumowanie.csv:', unlinkErr);
      else console.log('Usunięto plik podsumowanie.csv');
    });

    // Usuwamy .env
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      fs.unlink(envPath, (unlinkErr) => {
        if (unlinkErr) console.error('Błąd usuwania .env:', unlinkErr);
        else console.log('Usunięto plik .env');
      });
    }

    // Usuwamy raporty w downloads
    const downloadsDir = path.join(__dirname, 'downloads');
    if (fs.existsSync(downloadsDir)) {
      fs.readdir(downloadsDir, (readErr, files) => {
        if (readErr) {
          console.error('Błąd czytania katalogu downloads:', readErr);
          return;
        }
        files.filter(f => f.startsWith('raport-') && f.endsWith('.csv')).forEach(file => {
          const fileToDelete = path.join(downloadsDir, file);
          fs.unlink(fileToDelete, (unlinkErr) => {
            if (unlinkErr) console.error(`Błąd usuwania pliku ${file}:`, unlinkErr);
            else console.log(`Usunięto plik ${file}`);
          });
        });
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serwer działa na http://localhost:${PORT}`);
});
