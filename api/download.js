// api/download.js (Vercel Serverless Function)
import fetch from 'node-fetch';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, url, format, quality, jobId, token } = req.body;

  try {
    switch (action) {
      case 'get-token':
        const tokenData = await getToken(url, format);
        res.json({ success: true, token: tokenData });
        break;

      case 'start-convert':
        const jobData = await startConvert(url, token, format, quality);
        res.json({ success: true, jobId: jobData });
        break;

      case 'poll-convert':
        const pollData = await pollStatus(jobId, token, format);
        res.json(pollData);
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

// Fungsi-fungsi helper tetap sama seperti sebelumnya
async function getToken(url, format) {
  const page = format === 'mp3' ? 'button' : 'vidbutton';
  const response = await fetch(`https://v2.ytmp3.wtf/${page}/?url=${encodeURIComponent(url)}`, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.6',
      'Referer': 'https://v2.ytmp3.wtf/',
      'Upgrade-Insecure-Requests': '1',
    }
  });

  const html = await response.text();
  const cookie = response.headers.get('set-cookie') || '';
  const phpsessid = cookie.match(/PHPSESSID=([^;]+)/)?.[1];
  const tokenId = html.match(/'token_id':\s*'([^']+)'/)?.[1];
  const validTo = html.match(/'token_validto':\s*'([^']+)'/)?.[1];

  if (!phpsessid || !tokenId || !validTo) {
    throw new Error('Failed to get token');
  }

  return { phpsessid, tokenId, validTo };
}

async function startConvert(url, token, format, quality = 'best') {
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
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: body.toString()
  });

  const text = await response.text();
  let json;
  
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response');
  }

  if (!json.jobid) {
    throw new Error(json.error || 'Job ID not found');
  }

  return json.jobid;
}

async function pollStatus(jobId, token, format) {
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
  
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from poll');
  }
}
