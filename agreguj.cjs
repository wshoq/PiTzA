const fs = require('fs');
const path = require('path');

const PIZZAS = [
  "Marinara", "Margherita", "Parano", "Mortadela", "Funghi", "Halloumi", "Peperoni", "Farma",
  "Margherita vegan", "PARMA", "Chorizo", "Red Goat", "Spinaci", "CAPROCIOSA", "Hawajska",
  "CON CARNI (FARMA)", "MELANZANA", "PICANTA", "QUATRO FORMAGGI", "RUSTICA", "GAMBERI",
  "CHORIZO CON GAMBERI", "PERA", "VEGANO"
];

function normalize(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}

function formatDateToPolish(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

const normalizedPizzaMap = {};
for (const pizza of PIZZAS) {
  normalizedPizzaMap[normalize(pizza)] = pizza;
}

const downloadsDir = path.join(__dirname, 'downloads');
const files = fs.readdirSync(downloadsDir).filter(f => f.startsWith('raport-') && f.endsWith('.csv'));
files.sort();

const summary = [];

function parseCSV(content) {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(';').map(cell => cell.replace(/^"|"$/g, '')));
}

for (const file of files) {
  const date = file.slice(7, 17);
  const dailyData = {};
  for (const pizza of PIZZAS) dailyData[pizza] = 0;
  dailyData['date'] = date;

  const filePath = path.join(downloadsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);

  let dataStart = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'Nazwa') {
      dataStart = i + 1;
      break;
    }
  }

  if (dataStart === 0) {
    console.warn(`⚠️  Nie znaleziono sekcji danych w pliku ${file}`);
    continue;
  }

  console.log(`📄 Przetwarzam plik ${file} (${rows.length - dataStart} rekordów danych)`);

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 5) continue;

    const rawName = row[0];
    const quantityStr = row[4].replace(',', '.');
    const quantity = parseFloat(quantityStr);
    if (isNaN(quantity)) continue;

    const normName = normalize(rawName);
    if (normName in normalizedPizzaMap) {
      const pizzaName = normalizedPizzaMap[normName];
      dailyData[pizzaName] += quantity;
      console.log(`🍕 ${pizzaName}: +${quantity} (${rawName})`);
    }
  }

  summary.push(dailyData);
}

// Przygotowanie danych CSV
const headers = ['Data', ...PIZZAS, 'RAZEM'];
const csvRows = [];
csvRows.push(headers.join(';'));

for (const day of summary) {
  const row = [formatDateToPolish(day.date)];
  let sum = 0;
  for (const pizza of PIZZAS) {
    const val = day[pizza] || 0;
    sum += val;
    row.push(val || '');
  }
  row.push(sum);
  csvRows.push(row.join(';'));
}

const totalRow = [''];
for (const pizza of PIZZAS) {
  const total = summary.reduce((acc, day) => acc + (day[pizza] || 0), 0);
  totalRow.push(total);
}
totalRow.push(totalRow.slice(1).reduce((acc, val) => acc + val, 0));
csvRows.push(totalRow.join(';'));

// Zapis pliku CSV
const outputFile = path.join(__dirname, 'podsumowanie.csv');
fs.writeFileSync(outputFile, csvRows.join('\n'), 'utf-8');

console.log(`✅ Gotowe! Podsumowanie zapisane jako ${outputFile}`);
console.log(`📊 Cudowanie zakończone.`);
