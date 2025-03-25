// Konstanta untuk ID Spreadsheet dan Info Telegram
const SPREADSHEET_ID = '<ID-SPREADSHEET>';
const SHEET_NAME_HADIST = 'hadist';
const SHEET_NAME_LOG = 'logAccess';
const SHEET_NAME_CACHE = 'apiCache';
const SHEET_NAME_STATS = 'apiStats';
const TELEGRAM_TOKEN = '<TOKEN-BOT-TELEGRAM>';
const TELEGRAM_CHAT_ID = '<CHAT-ID>';

// Konstanta untuk cache
const CACHE_EXPIRY = 3600; // Cache berlaku selama 1 jam (dalam detik)

/**
 * Fungsi doGet untuk menangani request HTTP GET
 * @param {Object} e - parameter event dari request
 * @return {Object} - respons JSON yang akan dikirim kembali
 */
function doGet(e) {
  // Log akses ke spreadsheet
  logAccess(e);
  
  // Tentukan action berdasarkan parameter
  const action = e.parameter.action || '';
  
  let result;
  // Cek apakah respons ada di cache
  const cacheKey = generateCacheKey(e.parameters);
  const cachedResponse = getCachedResponse(cacheKey);
  
  if (cachedResponse) {
    result = cachedResponse;
  } else {
    if (action === 'hadith') {
      const bookId = e.parameter.book || '';
      const range = e.parameter.range || '1-10';
      result = getHadith(bookId, range);
    } else if (action === 'random') {
      const count = parseInt(e.parameter.count || '1', 10);
      result = getRandomHadith(count);
    } else if (action === 'search') {
      const query = e.parameter.q || '';
      result = searchHadith(query);
    } else if (action === 'books') {
      result = getBooks();
    } else if (action === 'stats') {
      result = getApiStats();
    } else if (action === 'admin') {
      return HtmlService.createHtmlOutput(generateAdminPanel())
        .setTitle('API Hadist - Admin Panel')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    } else {
      // Jika tidak ada action, tampilkan halaman informasi API
      result = getApiInfo();
    }
    
    // Simpan ke cache jika bukan endpoint admin atau stats
    if (action !== 'admin' && action !== 'stats') {
      cacheResponse(cacheKey, result);
    }
  }
  
  // Update statistik API
  updateApiStats(action);
  
  // Kirim notifikasi ke Telegram (kecuali untuk halaman info API atau admin)
  if (action !== '' && action !== 'admin' && action !== 'stats') {
    sendTelegramNotification(e, result);
  }
  
  // Kembalikan hasil sebagai JSON
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fungsi untuk membuat kunci cache berdasarkan parameter
 * @param {Object} parameters - parameter dari request
 * @return {string} - kunci cache
 */
function generateCacheKey(parameters) {
  return JSON.stringify(parameters);
}

/**
 * Fungsi untuk mendapatkan respons dari cache
 * @param {string} key - kunci cache
 * @return {Object|null} - respons dari cache atau null jika tidak ditemukan/expired
 */
function getCachedResponse(key) {
  try {
    let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_CACHE);
    if (!sheet) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Cari cache berdasarkan key
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0] === key) {
        const timestamp = new Date(row[1]).getTime();
        const now = new Date().getTime();
        
        // Cek apakah cache masih berlaku
        if ((now - timestamp) / 1000 < CACHE_EXPIRY) {
          return JSON.parse(row[2]);
        } else {
          // Cache sudah expired, hapus dari spreadsheet
          sheet.deleteRow(i + 1);
          return null;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached response:', error);
    return null;
  }
}

/**
 * Fungsi untuk menyimpan respons ke cache
 * @param {string} key - kunci cache
 * @param {Object} response - respons yang akan di-cache
 */
function cacheResponse(key, response) {
  try {
    let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_CACHE);
    if (!sheet) {
      // Jika sheet cache belum ada, buat sheet baru
      const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      const newSheet = spreadsheet.insertSheet(SHEET_NAME_CACHE);
      
      // Buat header untuk sheet cache
      newSheet.appendRow([
        'Key', 
        'Timestamp', 
        'Response'
      ]);
      
      sheet = newSheet;
    }
    
    // Simpan respons ke cache
    sheet.appendRow([
      key,
      new Date(),
      JSON.stringify(response)
    ]);
    
    // Bersihkan cache lama jika terlalu banyak baris
    const maxCacheRows = 100;
    if (sheet.getLastRow() > maxCacheRows) {
      sheet.deleteRows(2, sheet.getLastRow() - maxCacheRows);
    }
  } catch (error) {
    console.error('Error caching response:', error);
  }
}

/**
 * Fungsi untuk menampilkan informasi API
 * @return {Object} - informasi tentang API dan endpoint yang tersedia
 */
function getApiInfo() {
  const deploymentUrl = ScriptApp.getService().getUrl();
  
  return {
    name: "API Hadist",
    version: "1.1",
    description: "API untuk mengakses koleksi hadist dari berbagai periwayat",
    endpoints: [
      {
        path: "/",
        method: "GET",
        description: "Halaman informasi API",
        example: deploymentUrl
      },
      {
        path: "/?action=books",
        method: "GET",
        description: "Mendapatkan daftar semua buku/periwayat hadist",
        example: `${deploymentUrl}?action=books`
      },
      {
        path: "/?action=hadith&book=[id]&range=[start]-[end]",
        method: "GET",
        description: "Mendapatkan hadist berdasarkan periwayat dan range nomor",
        parameters: {
          book: "ID periwayat hadist, contoh: bukhari, muslim, dll",
          range: "Format [start]-[end], contoh: 1-10"
        },
        example: `${deploymentUrl}?action=hadith&book=bukhari&range=1-10`
      },
      {
        path: "/?action=random&count=[jumlah]",
        method: "GET",
        description: "Mendapatkan hadist secara acak",
        parameters: {
          count: "Jumlah hadist yang diambil, default: 1"
        },
        example: `${deploymentUrl}?action=random&count=5`
      },
      {
        path: "/?action=search&q=[keyword]",
        method: "GET",
        description: "Mencari hadist berdasarkan kata kunci",
        parameters: {
          q: "Kata kunci pencarian"
        },
        example: `${deploymentUrl}?action=search&q=nikah`
      },
      {
        path: "/?action=stats",
        method: "GET",
        description: "Menampilkan statistik penggunaan API",
        example: `${deploymentUrl}?action=stats`
      },
      {
        path: "/?action=admin",
        method: "GET",
        description: "Panel admin untuk melihat statistik dan penggunaan API",
        example: `${deploymentUrl}?action=admin`
      }
    ],
    contact: "Dibuat oleh Classy Indonesia Mandiri",
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Fungsi untuk mendapatkan daftar buku/periwayat hadist
 * @return {Object} - objek hasil dengan data buku
 */
function getBooks() {
  try {
    // Ambil data dari spreadsheet
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_HADIST);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Dapatkan header
    const headers = values[0];
    const riwayatIndex = headers.indexOf('riwayat');
    const idIndex = headers.indexOf('id');
    
    if (riwayatIndex === -1 || idIndex === -1) {
      throw new Error('Format kolom spreadsheet tidak sesuai');
    }
    
    // Hitung jumlah hadist per periwayat
    const bookCounts = {};
    const bookIds = {};
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const riwayat = row[riwayatIndex];
      const id = row[idIndex];
      
      if (riwayat) {
        if (!bookCounts[riwayat]) {
          bookCounts[riwayat] = 0;
          bookIds[riwayat] = id;
        }
        bookCounts[riwayat]++;
      }
    }
    
    // Format hasil
    const books = Object.keys(bookCounts).map(name => {
      return {
        name: name,
        id: bookIds[name],
        available: bookCounts[name]
      };
    });
    
    return {
      code: 200,
      message: `${books.length} books sent.`,
      data: books,
      error: false
    };
  } catch (error) {
    return {
      code: 400,
      message: error.message,
      data: [],
      error: true
    };
  }
}

/**
 * Fungsi untuk mengambil hadits berdasarkan periwayat dan range
 * @param {string} bookId - ID periwayat hadits
 * @param {string} range - range data dalam format "start-end"
 * @return {Object} - objek hasil dengan data hadits
 */
function getHadith(bookId, range) {
  try {
    if (!bookId) {
      throw new Error('Parameter book tidak boleh kosong');
    }
    
    // Parsing range
    const [start, end] = range.split('-').map(num => parseInt(num.trim(), 10));
    
    if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
      throw new Error('Range tidak valid. Gunakan format "start-end"');
    }
    
    // Ambil data dari spreadsheet
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_HADIST);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Dapatkan header
    const headers = values[0];
    const numberIndex = headers.indexOf('number');
    const arabIndex = headers.indexOf('arab');
    const indonesiaIndex = headers.indexOf('indonesia');
    const riwayatIndex = headers.indexOf('riwayat');
    const idIndex = headers.indexOf('id');
    
    if (numberIndex === -1 || arabIndex === -1 || indonesiaIndex === -1 || riwayatIndex === -1 || idIndex === -1) {
      throw new Error('Format kolom spreadsheet tidak sesuai');
    }
    
    // Filter berdasarkan periwayat
    const filteredData = values.slice(1).filter(row => row[idIndex] === bookId);
    
    if (filteredData.length === 0) {
      throw new Error(`Periwayat dengan ID "${bookId}" tidak ditemukan`);
    }
    
    // Mengambil data sesuai range
    const totalHadiths = filteredData.length;
    const requested = Math.min(end - start + 1, totalHadiths);
    const hadiths = [];
    
    for (let i = start - 1; i < Math.min(end, totalHadiths); i++) {
      if (i >= 0 && i < filteredData.length) {
        const row = filteredData[i];
        hadiths.push({
          number: row[numberIndex],
          arab: row[arabIndex],
          indonesia: row[indonesiaIndex]
        });
      }
    }
    
    // Ambil informasi periwayat
    const riwayat = filteredData[0][riwayatIndex];
    const id = filteredData[0][idIndex];
    
    return {
      code: 200,
      message: `${requested} hadiths requested.`,
      data: {
        name: riwayat,
        id: id,
        available: totalHadiths,
        requested: requested,
        hadiths: hadiths
      },
      error: false
    };
  } catch (error) {
    return {
      code: 400,
      message: error.message,
      data: null,
      error: true
    };
  }
}

/**
 * Fungsi untuk mengambil hadits secara acak
 * @param {number} count - jumlah hadits yang diambil
 * @return {Object} - objek hasil dengan data hadits acak
 */
function getRandomHadith(count) {
  try {
    if (isNaN(count) || count < 1) {
      count = 1;
    }
    
    // Batasi jumlah maksimum hadits acak
    count = Math.min(count, 20);
    
    // Ambil data dari spreadsheet
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_HADIST);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Dapatkan header
    const headers = values[0];
    const numberIndex = headers.indexOf('number');
    const arabIndex = headers.indexOf('arab');
    const indonesiaIndex = headers.indexOf('indonesia');
    const riwayatIndex = headers.indexOf('riwayat');
    const idIndex = headers.indexOf('id');
    
    if (numberIndex === -1 || arabIndex === -1 || indonesiaIndex === -1 || riwayatIndex === -1 || idIndex === -1) {
      throw new Error('Format kolom spreadsheet tidak sesuai');
    }
    
    // Data tanpa header
    const data = values.slice(1);
    
    // Mengambil hadits secara acak
    const hadiths = [];
    const totalHadiths = data.length;
    
    // Membuat array indeks acak
    const randomIndices = [];
    for (let i = 0; i < count; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * totalHadiths);
      } while (randomIndices.includes(randomIndex) && randomIndices.length < totalHadiths);
      
      if (randomIndices.length < totalHadiths) {
        randomIndices.push(randomIndex);
      }
    }
    
    // Mengambil hadits berdasarkan indeks acak
    for (const index of randomIndices) {
      const row = data[index];
      hadiths.push({
        number: row[numberIndex],
        arab: row[arabIndex],
        indonesia: row[indonesiaIndex],
        riwayat: row[riwayatIndex],
        id: row[idIndex]
      });
    }
    
    return {
      code: 200,
      message: `${hadiths.length} random hadiths sent.`,
      data: hadiths,
      error: false
    };
  } catch (error) {
    return {
      code: 400,
      message: error.message,
      data: [],
      error: true
    };
  }
}

/**
 * Fungsi pencarian hadits berdasarkan kata kunci
 * @param {string} query - kata kunci pencarian
 * @return {Object} - objek hasil dengan data hadits yang cocok
 */
function searchHadith(query) {
  try {
    if (!query || query.trim() === '') {
      throw new Error('Parameter pencarian tidak boleh kosong');
    }
    
    // Ambil data dari spreadsheet
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_HADIST);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Dapatkan header
    const headers = values[0];
    const numberIndex = headers.indexOf('number');
    const arabIndex = headers.indexOf('arab');
    const indonesiaIndex = headers.indexOf('indonesia');
    const riwayatIndex = headers.indexOf('riwayat');
    const idIndex = headers.indexOf('id');
    
    if (numberIndex === -1 || arabIndex === -1 || indonesiaIndex === -1 || riwayatIndex === -1 || idIndex === -1) {
      throw new Error('Format kolom spreadsheet tidak sesuai');
    }
    
    // Cari data berdasarkan kata kunci di kolom indonesia
    const results = [];
    const keyword = query.toLowerCase();
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const indonesiaText = String(row[indonesiaIndex]).toLowerCase();
      
      if (indonesiaText.includes(keyword)) {
        results.push({
          number: row[numberIndex],
          arab: row[arabIndex],
          indonesia: row[indonesiaIndex],
          riwayat: row[riwayatIndex],
          id: row[idIndex]
        });
      }
    }
    
    return {
      status: 'success',
      keyword: query,
      count: results.length,
      data: results
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      count: 0,
      data: []
    };
  }
}

/**
 * Fungsi untuk menampilkan statistik API
 * @return {Object} - objek hasil dengan data statistik
 */
function getApiStats() {
  try {
    let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_STATS);
    if (!sheet) {
      return {
        code: 200,
        message: "API statistics",
        data: {
          totalRequests: 0,
          endpointStats: {}
        },
        error: false
      };
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Mengambil statistik dari sheet
    const stats = {
      totalRequests: 0,
      endpointStats: {}
    };
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const endpoint = row[0];
      const count = row[1];
      
      stats.totalRequests += count;
      stats.endpointStats[endpoint] = count;
    }
    
    return {
      code: 200,
      message: "API statistics",
      data: stats,
      error: false
    };
  } catch (error) {
    return {
      code: 400,
      message: error.message,
      data: null,
      error: true
    };
  }
}

/**
 * Fungsi untuk update statistik API
 * @param {string} endpoint - nama endpoint yang diakses
 */
function updateApiStats(endpoint) {
  try {
    let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_STATS);
    if (!sheet) {
      // Jika sheet stats belum ada, buat sheet baru
      const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      const newSheet = spreadsheet.insertSheet(SHEET_NAME_STATS);
      
      // Buat header untuk sheet stats
      newSheet.appendRow([
        'Endpoint', 
        'Count', 
        'Last Access'
      ]);
      
      sheet = newSheet;
    }
    
    // Jika endpoint kosong, gunakan 'info'
    endpoint = endpoint || 'info';
    
    // Cari endpoint di sheet
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    let found = false;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === endpoint) {
        // Update count dan last access
        const count = values[i][1] + 1;
        sheet.getRange(i + 1, 2).setValue(count);
        sheet.getRange(i + 1, 3).setValue(new Date());
        found = true;
        break;
      }
    }
    
    // Jika endpoint belum ada, tambahkan baris baru
    if (!found) {
      sheet.appendRow([
        endpoint,
        1,
        new Date()
      ]);
    }
  } catch (error) {
    console.error('Error updating API stats:', error);
  }
}

/**
 * Fungsi untuk mencatat akses di spreadsheet
 * @param {Object} e - parameter event dari request
 */
function logAccess(e) {
  try {
    let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_LOG);
    if (!sheet) {
      // Jika sheet log belum ada, buat sheet baru
      const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      const newSheet = spreadsheet.insertSheet(SHEET_NAME_LOG);
      
      // Buat header untuk sheet log
      newSheet.appendRow([
        'Timestamp', 
        'IP Address', 
        'Action', 
        'Parameters', 
        'User-Agent'
      ]);
      
      sheet = newSheet;
    }
    
    // Dapatkan informasi request
    const timestamp = new Date();
    const ipAddress = e.parameter.ip || 'Unknown';
    const action = e.parameter.action || 'info';
    const parameters = JSON.stringify(e.parameters);
    const userAgent = e.parameter.userAgent || 'Unknown';
    
    // Catat di spreadsheet
    sheet.appendRow([
      timestamp, 
      ipAddress, 
      action, 
      parameters, 
      userAgent
    ]);
    
  } catch (error) {
    console.error('Error logging access:', error);
  }
}

/**
 * Fungsi untuk mengirim notifikasi ke Telegram
 * @param {Object} e - parameter event dari request
 * @param {Object} result - hasil yang akan dikirim
 */
function sendTelegramNotification(e, result) {
  try {
    const action = e.parameter.action || 'info';
    const timestamp = new Date().toLocaleString('id-ID');
    const ipAddress = e.parameter.ip || 'Unknown';
    
    let message = '';
    
    if (action === 'hadith') {
      const bookId = e.parameter.book || '';
      const range = e.parameter.range || '1-10';
      message = `🔔 *Notifikasi API Hadist*\n\n` +
                `📊 *Akses:* Get Hadith\n` +
                `📅 *Waktu:* ${timestamp}\n` +
                `🌐 *IP:* ${ipAddress}\n` +
                `📚 *Periwayat:* ${bookId}\n` +
                `📋 *Range:* ${range}\n` +
                `📈 *Jumlah Data:* ${result.data?.requested || 0} hadits`;
    } else if (action === 'random') {
      const count = e.parameter.count || '1';
      message = `🔔 *Notifikasi API Hadist*\n\n` +
                `🎲 *Akses:* Random Hadith\n` +
                `📅 *Waktu:* ${timestamp}\n` +
                `🌐 *IP:* ${ipAddress}\n` +
                `📈 *Jumlah Data:* ${count} hadits acak`;
    } else if (action === 'search') {
      const query = e.parameter.q || '';
      message = `🔔 *Notifikasi API Hadist*\n\n` +
                `🔍 *Akses:* Search Hadith\n` +
                `📅 *Waktu:* ${timestamp}\n` +
                `🌐 *IP:* ${ipAddress}\n` +
                `🔎 *Keyword:* "${query}"\n` +
                `📈 *Hasil:* ${result.count} hadits ditemukan`;
    } else if (action === 'books') {
      message = `🔔 *Notifikasi API Hadist*\n\n` +
                `📚 *Akses:* Get Books\n` +
                `📅 *Waktu:* ${timestamp}\n` +
                `🌐 *IP:* ${ipAddress}\n` +
                `📈 *Jumlah Buku:* ${result.data?.length || 0} buku`;
    }
    
    if (message) {
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
      const payload = {
        'chat_id': TELEGRAM_CHAT_ID,
        'text': message,
        'parse_mode': 'Markdown'
      };
      
      const options = {
        'method': 'post',
        'contentType': 'application/json',
        'payload': JSON.stringify(payload)
      };
      
      UrlFetchApp.fetch(telegramUrl, options);
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

/**
 * Fungsi untuk menghasilkan panel admin
 * @return {string} - HTML untuk panel admin
 */
function generateAdminPanel() {
  // Ambil data log akses terbaru
  const recentAccessLogs = getRecentAccessLogs(10);
  
  // Ambil data statistik 7 hari terakhir
  const dailyStats = getDailyStats();
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel Admin API Hadist</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
    body {
      font-family: 'Poppins', sans-serif;
    }
  </style>
</head>
<body class="bg-gray-100">
  <div class="min-h-screen">
    <!-- Header -->
    <header class="bg-green-700 text-white shadow-lg">
      <div class="container mx-auto px-4 py-6">
        <div class="flex flex-col md:flex-row md:justify-between md:items-center">
          <div class="text-center md:text-left mb-4 md:mb-0">
            <h1 class="text-3xl font-bold">Panel Admin API Hadist</h1>
            <p class="text-green-100 mt-1">Monitoring dan analisis penggunaan API</p>
          </div>
          <div class="flex justify-center">
            <div class="px-4 py-2 bg-white bg-opacity-20 rounded-lg">
              <span id="current-date" class="text-sm md:text-base font-medium"></span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <h3 class="text-gray-500 text-sm font-medium mb-1">Total Request</h3>
          <div class="flex items-center">
            <div class="text-2xl font-bold text-gray-800" id="total-requests">-</div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-amber-500">
          <h3 class="text-gray-500 text-sm font-medium mb-1">Pencarian</h3>
          <div class="flex items-center">
            <div class="text-2xl font-bold text-gray-800" id="search-requests">-</div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <h3 class="text-gray-500 text-sm font-medium mb-1">Hadist</h3>
          <div class="flex items-center">
            <div class="text-2xl font-bold text-gray-800" id="hadith-requests">-</div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <h3 class="text-gray-500 text-sm font-medium mb-1">Acak</h3>
          <div class="flex items-center">
            <div class="text-2xl font-bold text-gray-800" id="random-requests">-</div>
          </div>
        </div>
      </div>

      <!-- Access Log -->
      <div class="bg-white rounded-lg shadow-md mb-8">
        <div class="border-b border-gray-200 px-6 py-4">
          <h2 class="text-lg font-medium text-gray-800">Log Akses Terbaru</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parameter</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200" id="access-log">
              ${generateAccessLogRows(recentAccessLogs)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- API Stats Chart -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="bg-white rounded-lg shadow-md">
          <div class="border-b border-gray-200 px-6 py-4">
            <h2 class="text-lg font-medium text-gray-800">Statistik Endpoint</h2>
          </div>
          <div class="p-6">
            <canvas id="endpoint-chart" height="300"></canvas>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-md">
          <div class="border-b border-gray-200 px-6 py-4">
            <h2 class="text-lg font-medium text-gray-800">7 Hari Terakhir</h2>
          </div>
          <div class="p-6">
            <canvas id="daily-chart" height="300"></canvas>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-green-800 text-white py-6">
      <div class="container mx-auto px-4 text-center">
        <p>API Hadist &copy; <span id="current-year"></span> - Dibuat oleh Anthropic Claude</p>
      </div>
    </footer>
  </div>

  <!-- Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
  <script>
    // Tanggal saat ini
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Tahun saat ini untuk footer
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Data Statistik API
    const apiStats = ${JSON.stringify(getApiStats().data)};
    
    // Data Statistik Harian
    const dailyStats = ${JSON.stringify(dailyStats)};

    // Update kartu statistik
    document.getElementById('total-requests').textContent = apiStats.totalRequests || 0;
    document.getElementById('search-requests').textContent = apiStats.endpointStats.search || 0;
    document.getElementById('hadith-requests').textContent = apiStats.endpointStats.hadith || 0;
    document.getElementById('random-requests').textContent = apiStats.endpointStats.random || 0;

    // Endpoint Chart
    const endpointLabels = Object.keys(apiStats.endpointStats);
    const endpointData = endpointLabels.map(key => apiStats.endpointStats[key]);

    const endpointChart = new Chart(document.getElementById('endpoint-chart'), {
      type: 'bar',
      data: {
        labels: endpointLabels,
        datasets: [{
          label: 'Jumlah Request',
          data: endpointData,
          backgroundColor: [
            'rgba(76, 175, 80, 0.7)',
            'rgba(255, 193, 7, 0.7)',
            'rgba(33, 150, 243, 0.7)',
            'rgba(156, 39, 176, 0.7)',
            'rgba(244, 67, 54, 0.7)'
          ],
          borderColor: [
            'rgba(76, 175, 80, 1)',
            'rgba(255, 193, 7, 1)',
            'rgba(33, 150, 243, 1)',
            'rgba(156, 39, 176, 1)',
            'rgba(244, 67, 54, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });

    // Daily Chart
    const dailyChart = new Chart(document.getElementById('daily-chart'), {
      type: 'line',
      data: {
        labels: dailyStats.dates,
        datasets: [{
          label: 'Request per Hari',
          data: dailyStats.counts,
          fill: false,
          borderColor: 'rgba(76, 175, 80, 1)',
          tension: 0.3,
          pointBackgroundColor: 'rgba(76, 175, 80, 1)'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Fungsi untuk mendapatkan log akses terbaru
 * @param {number} limit - jumlah log yang diambil
 * @return {Array} - array log akses
 */
function getRecentAccessLogs(limit) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_LOG);
    if (!sheet) {
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length <= 1) {
      return []; // Hanya ada header
    }
    
    // Ambil data terbaru (tanpa header)
    const logs = values.slice(1).map(row => {
      return {
        timestamp: new Date(row[0]),
        ipAddress: row[1],
        action: row[2],
        parameters: row[3],
      };
    });
    
    // Urutkan berdasarkan timestamp terbaru
    logs.sort((a, b) => b.timestamp - a.timestamp);
    
    // Ambil sesuai limit
    return logs.slice(0, limit);
  } catch (error) {
    console.error('Error getting access logs:', error);
    return [];
  }
}

/**
 * Fungsi untuk mendapatkan statistik 7 hari terakhir
 * @return {Object} - objek dengan array dates dan counts
 */
function getDailyStats() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME_LOG);
    if (!sheet) {
      // Kembalikan data kosong jika sheet belum ada
      return generateEmptyDailyStats();
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length <= 1) {
      // Hanya ada header, kembalikan data kosong
      return generateEmptyDailyStats();
    }
    
    // Generate tanggal untuk 7 hari terakhir
    const dateLabels = [];
    const dateCounts = {};
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0); // Reset waktu ke awal hari
      
      const dateStr = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
      const displayDate = date.toLocaleDateString('id-ID', { weekday: 'short' });
      
      dateLabels.push(displayDate);
      dateCounts[dateStr] = 0;
    }
    
    // Hitung jumlah akses per hari
    for (let i = 1; i < values.length; i++) {
      const timestamp = new Date(values[i][0]);
      const dateStr = timestamp.toISOString().split('T')[0];
      
      if (dateCounts.hasOwnProperty(dateStr)) {
        dateCounts[dateStr]++;
      }
    }
    
    // Konversi ke array untuk chart
    const counts = Object.keys(dateCounts).map(key => dateCounts[key]);
    
    return {
      dates: dateLabels,
      counts: counts
    };
  } catch (error) {
    console.error('Error getting daily stats:', error);
    return generateEmptyDailyStats();
  }
}

/**
 * Fungsi untuk menghasilkan statistik harian kosong
 * @return {Object} - objek dengan array dates dan counts kosong
 */
function generateEmptyDailyStats() {
  const dateLabels = [];
  const counts = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    dateLabels.push(date.toLocaleDateString('id-ID', { weekday: 'short' }));
    counts.push(0);
  }
  
  return {
    dates: dateLabels,
    counts: counts
  };
}

/**
 * Fungsi untuk menghasilkan baris tabel log akses
 * @param {Array} logs - array log akses
 * @return {string} - HTML untuk baris tabel
 */
function generateAccessLogRows(logs) {
  if (logs.length === 0) {
    return '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Tidak ada data log akses</td></tr>';
  }
  
  let html = '';
  
  logs.forEach(log => {
    const parameters = JSON.parse(log.parameters || '{}');
    const formattedParams = Object.keys(parameters)
      .map(key => `${key}=${parameters[key]}`)
      .join('&');
      
    const endpoint = log.action;
    
    html += `<tr>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.timestamp.toLocaleString('id-ID')}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.ipAddress}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <span class="px-2 py-1 rounded-full text-xs ${
          endpoint === 'hadith' ? 'bg-blue-100 text-blue-800' :
          endpoint === 'search' ? 'bg-amber-100 text-amber-800' :
          endpoint === 'random' ? 'bg-purple-100 text-purple-800' :
          endpoint === 'books' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }">${endpoint}</span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedParams}</td>
    </tr>`;
  });
  
  return html;
}
