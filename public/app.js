// app.js
document.addEventListener('DOMContentLoaded', function() {
    // Elemen DOM
    const urlInput = document.getElementById('urlInput');
    const pasteBtn = document.getElementById('pasteBtn');
    const formatOptions = document.querySelectorAll('.format-option');
    const qualitySelector = document.getElementById('qualitySelector');
    const qualitySelect = document.getElementById('qualitySelect');
    const convertBtn = document.getElementById('convertBtn');
    const loading = document.getElementById('loading');
    const statusText = document.getElementById('statusText');
    const resultContainer = document.getElementById('resultContainer');
    const errorBox = document.getElementById('errorBox');
    
    // Data state
    let currentFormat = 'mp3';
    let currentQuality = 'best';
    
    // Format selection
    formatOptions.forEach(option => {
        option.addEventListener('click', function() {
            formatOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            currentFormat = this.dataset.format;
            
            // Show/hide quality selector for MP4
            if (currentFormat === 'mp4') {
                qualitySelector.style.display = 'block';
            } else {
                qualitySelector.style.display = 'none';
            }
        });
    });
    
    // Quality selection
    qualitySelect.addEventListener('change', function() {
        currentQuality = this.value;
    });
    
    // Paste button
    pasteBtn.addEventListener('click', async function() {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
        } catch (err) {
            showError('Gagal menempel dari clipboard');
        }
    });
    
    // Convert button
    convertBtn.addEventListener('click', async function() {
        const url = urlInput.value.trim();
        
        if (!url) {
            showError('Masukkan link YouTube terlebih dahulu');
            return;
        }
        
        // Validate YouTube URL
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        if (!youtubeRegex.test(url)) {
            showError('Link YouTube tidak valid');
            return;
        }
        
        // Start conversion
        startConversion(url);
    });
    
    // Function to show error
    function showError(message) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
        setTimeout(() => {
            errorBox.style.display = 'none';
        }, 5000);
    }
    
    // Start conversion process
    async function startConversion(url) {
        try {
            // Show loading
            loading.style.display = 'block';
            resultContainer.style.display = 'none';
            convertBtn.disabled = true;
            statusText.textContent = 'Mengambil metadata video...';
            
            // Extract video ID
            const videoId = extractVideoId(url);
            
            // Get video metadata
            const metadata = await getVideoMetadata(videoId);
            
            if (!metadata) {
                throw new Error('Gagal mengambil informasi video');
            }
            
            // Update UI with video info
            updateVideoInfo(metadata);
            
            // Get download token
            statusText.textContent = 'Menyiapkan download...';
            const token = await getDownloadToken(url, currentFormat);
            
            // Start conversion
            statusText.textContent = 'Memulai konversi...';
            const jobId = await startConversionJob(url, token, currentFormat);
            
            // Poll for completion
            statusText.textContent = 'Mengonversi...';
            const downloadUrl = await pollConversion(jobId, token, currentFormat);
            
            // Show download button
            showDownloadOption(downloadUrl, metadata);
            
        } catch (error) {
            showError(error.message || 'Terjadi kesalahan');
        } finally {
            loading.style.display = 'none';
            convertBtn.disabled = false;
        }
    }
    
    // Extract video ID from URL
    function extractVideoId(url) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    }
    
    // Get video metadata
    async function getVideoMetadata(videoId) {
        try {
            const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            if (!response.ok) throw new Error('Failed to fetch metadata');
            return await response.json();
        } catch (error) {
            console.error('Error fetching metadata:', error);
            return null;
        }
    }
    
    // Update video info in UI
    function updateVideoInfo(metadata) {
        document.getElementById('videoTitle').textContent = metadata.title;
        document.getElementById('videoAuthor').textContent = metadata.author_name;
        document.getElementById('videoThumbnail').src = metadata.thumbnail_url;
        
        // Note: We can't get duration from oEmbed, but you could add another API call if needed
        document.getElementById('videoDuration').textContent = 'Sedang memproses...';
    }
    
    // Get download token from backend
    async function getDownloadToken(url, format) {
        const endpoint = format === 'mp3' ? 'button' : 'vidbutton';
        
        const response = await fetch(`/api/get-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, format, page: endpoint })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Gagal mendapatkan token');
        }
        
        return data.token;
    }
    
    // Start conversion job
    async function startConversionJob(url, token, format) {
        const response = await fetch(`/api/start-convert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                token,
                format,
                quality: currentFormat === 'mp4' ? currentQuality : null
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Gagal memulai konversi');
        }
        
        return data.jobId;
    }
    
    // Poll for conversion completion
    async function pollConversion(jobId, token, format) {
        const maxAttempts = 30;
        
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            try {
                const response = await fetch(`/api/poll-convert`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ jobId, token, format })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                if (data.ready && data.dlUrl) {
                    return data.dlUrl;
                }
                
                statusText.textContent = `Mengonversi... (${i + 1}/${maxAttempts})`;
            } catch (error) {
                console.error('Poll error:', error);
            }
        }
        
        throw new Error('Konversi timeout');
    }
    
    // Show download option
    function showDownloadOption(downloadUrl, metadata) {
        const downloadOptions = document.getElementById('downloadOptions');
        
        let fileName = metadata.title.replace(/[^\w\s]/gi, '').substring(0, 50);
        fileName += currentFormat === 'mp3' ? '.mp3' : '.mp4';
        
        const downloadHTML = `
            <a href="${downloadUrl}" class="download-btn ${currentFormat === 'mp3' ? 'mp3' : ''}" download="${fileName}">
                <i class="fas fa-arrow-down"></i>
                Download ${currentFormat.toUpperCase()} 
                ${currentFormat === 'mp4' ? `(${currentQuality})` : ''}
            </a>
            <p style="text-align: center; color: #aaa; margin-top: 10px;">
                Klik untuk mendownload. File akan otomatis terdownload.
            </p>
        `;
        
        downloadOptions.innerHTML = downloadHTML;
        resultContainer.style.display = 'block';
        
        // Auto scroll to result
        resultContainer.scrollIntoView({ behavior: 'smooth' });
    }
});
