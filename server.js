// server.js (Backend menggunakan Express)
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// User Agent untuk request
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Endpoint untuk mengambil token
app.post('/api/get-token', async (req, res) => {
    try {
        const { url, format, page } = req.body;
        
        const response = await fetch(`https://v2.ytmp3.wtf/${page}/?url=${encodeURIComponent(url)}`, {
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.6',
                'Referer': 'https://v2.ytmp3.wtf/',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Dest': 'document'
            }
        });

        const html = await response.text();
        const cookie = response.headers.get('set-cookie') || '';
        const phpsessid = cookie.match(/PHPSESSID=([^;]+)/)?.[1];
        const tokenId = html.match(/'token_id':\s*'([^']+)'/)?.[1];
        const validTo = html.match(/'token_validto':\s*'([^']+)'/)?.[1];

        if (!phpsessid || !tokenId || !validTo) {
            throw new Error('Gagal mengambil token');
        }

        res.json({
            success: true,
            token: { phpsessid, tokenId, validTo }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint untuk memulai konversi
app.post('/api/start-convert', async (req, res) => {
    try {
        const { url, token, format, quality } = req.body;
        const endpoint = format === 'mp3' ? 'convert' : 'vidconvert';
        
        const body = new URLSearchParams({
            url,
            convert: 'gogogo',
            token_id: token.tokenId,
            token_validto: token.validTo
        });

        if (format === 'mp4' && quality && quality !== 'best') {
            body.append('quality', quality);
        }

        const response = await fetch(`https://v2.ytmp3.wtf/${endpoint}/`, {
            method: 'POST',
            headers: {
                'User-Agent': UA,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Origin': 'https://v2.ytmp3.wtf',
                'Referer': `https://v2.ytmp3.wtf/${format === 'mp3' ? 'button' : 'vidbutton'}/?url=${encodeURIComponent(url)}`,
                'Cookie': `PHPSESSID=${token.phpsessid}`,
                'X-Requested-With': 'XMLHttpRequest',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty'
            },
            body: body.toString()
        });

        const text = await response.text();
        let json;
        
        try {
            json = JSON.parse(text);
        } catch {
            throw new Error('Response konversi bukan JSON');
        }

        if (!json.jobid) {
            throw new Error(json.error || 'Job ID tidak ditemukan');
        }

        res.json({
            success: true,
            jobId: json.jobid
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint untuk polling status konversi
app.post('/api/poll-convert', async (req, res) => {
    try {
        const { jobId, token, format } = req.body;
        const endpoint = format === 'mp3' ? 'convert' : 'vidconvert';
        
        const response = await fetch(`https://v2.ytmp3.wtf/${endpoint}/?jobid=${jobId}&time=${Date.now()}`, {
            headers: {
                'User-Agent': UA,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://v2.ytmp3.wtf/',
                'Cookie': `PHPSESSID=${token.phpsessid}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const text = await response.text();
        let json;
        
        try {
            json = JSON.parse(text);
        } catch {
            res.json({ error: 'Response polling bukan JSON' });
            return;
        }

        res.json(json);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Endpoint untuk proxy download (optional, untuk menghindari CORS)
app.get('/api/proxy-download', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: 'URL tidak diberikan' });
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': UA
            }
        });

        if (!response.ok) {
            throw new Error('Gagal mengunduh file');
        }

        // Set headers untuk download
        const contentType = response.headers.get('content-type');
        const contentDisposition = response.headers.get('content-disposition');
        
        res.setHeader('Content-Type', contentType || 'application/octet-stream');
        if (contentDisposition) {
            res.setHeader('Content-Disposition', contentDisposition);
        }

        // Stream response
        response.body.pipe(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route untuk halaman utama
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
