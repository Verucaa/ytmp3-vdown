// app.js - Full Code for Vercel Deployment
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
    const downloadOptions = document.getElementById('downloadOptions');
    const videoTitle = document.getElementById('videoTitle');
    const videoAuthor = document.getElementById('videoAuthor');
    const videoThumbnail = document.getElementById('videoThumbnail');
    const videoDuration = document.getElementById('videoDuration');
    
    // State variables
    let currentFormat = 'mp3';
    let currentQuality = 'best';
    let currentVideoInfo = null;
    
    // Initialize format selection
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
    
    // Quality selection change
    qualitySelect.addEventListener('change', function() {
        currentQuality = this.value;
    });
    
    // Paste button functionality
    pasteBtn.addEventListener('click', async function() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text;
                
                // Auto-extract YouTube URL if it's in text
                const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/|playlist\?|.*[?&]v=)?([^"&?\/\s]{11})/;
                const match = text.match(youtubeRegex);
                if (match) {
                    urlInput.value = `https://youtu.be/${match[1]}`;
                }
                
                // Auto-get video info
                setTimeout(() => getVideoInfo(urlInput.value), 500);
            }
        } catch (err) {
            console.log('Clipboard permission denied or not available');
            // Fallback: Try execCommand for older browsers
            urlInput.select();
            document.execCommand('paste');
        }
    });
    
    // URL input change detection
    let urlInputTimeout;
    urlInput.addEventListener('input', function() {
        clearTimeout(urlInputTimeout);
        const url = this.value.trim();
        
        if (url) {
            urlInputTimeout = setTimeout(() => {
                if (isValidYouTubeUrl(url)) {
                    getVideoInfo(url);
                }
            }, 1000);
        }
    });
    
    // Convert button click
    convertBtn.addEventListener('click', async function() {
        const url = urlInput.value.trim();
        
        if (!url) {
            showError('Masukkan link YouTube terlebih dahulu');
            urlInput.focus();
            return;
        }
        
        if (!isValidYouTubeUrl(url)) {
            showError('Link YouTube tidak valid. Contoh: https://youtu.be/VIDEO_ID');
            return;
        }
        
        await startConversion(url);
    });
    
    // Enter key support
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            convertBtn.click();
        }
    });
    
    // Function to show error message
    function showError(message, duration = 5000) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
        errorBox.style.animation = 'slideDown 0.5s ease';
        
        if (duration > 0) {
            setTimeout(() => {
                errorBox.style.animation = 'fadeOut 0.5s ease';
                setTimeout(() => {
                    errorBox.style.display = 'none';
                }, 500);
            }, duration);
        }
    }
    
    // Function to validate YouTube URL
    function isValidYouTubeUrl(url) {
        const patterns = [
            /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=)([^"&?\/\s]{11})/,
            /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/embed\/)([^"&?\/\s]{11})/,
            /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/v\/)([^"&?\/\s]{11})/,
            /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/shorts\/)([^"&?\/\s]{11})/,
            /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/)([^"&?\/\s]{11})/,
            /^(?:https?:\/\/)?(?:music\.youtube\.com\/watch\?v=)([^"&?\/\s]{11})/
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }
    
    // Function to extract video ID
    function extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtu\.be\/|music\.youtube\.com\/watch\?v=)([^"&?\/\s]{11})/,
            /^([^"&?\/\s]{11})$/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }
    
    // Function to get video information
    async function getVideoInfo(url) {
        const videoId = extractVideoId(url);
        if (!videoId) return;
        
        try {
            // Show loading for video info
            convertBtn.disabled = true;
            convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa video...';
            
            // Try multiple methods to get video info
            const info = await getVideoMetadata(videoId);
            
            if (info) {
                currentVideoInfo = info;
                updateVideoInfoUI(info);
                
                // Update convert button text
                convertBtn.innerHTML = `<i class="fas fa-download"></i> Download ${currentFormat.toUpperCase()}`;
                
                // Auto-select format based on video length
                if (info.duration > 600) { // If video > 10 minutes
                    const mp4Option = document.querySelector('.format-option[data-format="mp4"]');
                    if (mp4Option && !mp4Option.classList.contains('active')) {
                        mp4Option.click();
                        showError('Video panjang terdeteksi, disarankan download MP4', 3000);
                    }
                }
            }
        } catch (error) {
            console.error('Error getting video info:', error);
        } finally {
            convertBtn.disabled = false;
        }
    }
    
    // Function to get video metadata
    async function getVideoMetadata(videoId) {
        try {
            // Method 1: Try oEmbed API
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
            const response = await fetch(oembedUrl);
            
            if (response.ok) {
                const data = await response.json();
                return {
                    title: data.title,
                    author: data.author_name,
                    thumbnail: data.thumbnail_url,
                    duration: 0 // oEmbed doesn't provide duration
                };
            }
            
            // Method 2: Try YouTube iFrame API
            return await getVideoInfoViaIframe(videoId);
            
        } catch (error) {
            console.error('Error fetching metadata:', error);
            return null;
        }
    }
    
    // Fallback method for video info
    function getVideoInfoViaIframe(videoId) {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
            document.body.appendChild(iframe);
            
            const timer = setTimeout(() => {
                resolve({
                    title: `Video YouTube (${videoId})`,
                    author: 'YouTube',
                    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    duration: 0
                });
                document.body.removeChild(iframe);
            }, 2000);
            
            // Note: In practice, you'd need to use YouTube IFrame API properly
            // This is a simplified version
        });
    }
    
    // Update video info in UI
    function updateVideoInfoUI(info) {
        if (info.title) {
            videoTitle.textContent = info.title;
        }
        
        if (info.author) {
            videoAuthor.textContent = `Channel: ${info.author}`;
        }
        
        if (info.thumbnail) {
            videoThumbnail.src = info.thumbnail;
            videoThumbnail.onerror = function() {
                this.src = `https://img.youtube.com/vi/${extractVideoId(urlInput.value)}/hqdefault.jpg`;
            };
        }
        
        if (info.duration > 0) {
            const minutes = Math.floor(info.duration / 60);
            const seconds = info.duration % 60;
            videoDuration.textContent = `Durasi: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            videoDuration.textContent = 'Durasi: Tidak diketahui';
        }
        
        // Pre-show result container with info only
        resultContainer.style.display = 'block';
        downloadOptions.innerHTML = '<p class="info-message">Pilih format dan klik "Konversi Sekarang"</p>';
    }
    
    // Main conversion function
    async function startConversion(url) {
        try {
            // Show loading
            loading.style.display = 'block';
            resultContainer.style.display = 'block';
            convertBtn.disabled = true;
            statusText.textContent = 'Mengambil metadata video...';
            
            // Get video ID for reference
            const videoId = extractVideoId(url);
            
            // Step 1: Get download token
            statusText.textContent = 'Menyiapkan download...';
            const token = await getDownloadToken(url, currentFormat);
            
            if (!token) {
                throw new Error('Gagal mendapatkan token download');
            }
            
            // Step 2: Start conversion job
            statusText.textContent = 'Memulai konversi...';
            const jobId = await startConversionJob(url, token, currentFormat, currentQuality);
            
            if (!jobId) {
                throw new Error('Gagal memulai proses konversi');
            }
            
            // Step 3: Poll for completion
            statusText.textContent = 'Mengonversi... (0/30)';
            const result = await pollConversionJob(jobId, token, currentFormat);
            
            if (result.ready && result.dlurl) {
                // Success! Show download button
                showDownloadButton(result.dlurl);
            } else if (result.error) {
                throw new Error(result.error);
            } else {
                throw new Error('Konversi gagal atau timeout');
            }
            
        } catch (error) {
            console.error('Conversion error:', error);
            showError(`Error: ${error.message}`);
        } finally {
            loading.style.display = 'none';
            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i class="fas fa-download"></i> Konversi Sekarang';
        }
    }
    
    // API Function: Get download token
    async function getDownloadToken(url, format) {
        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'get-token',
                    url: url,
                    format: format
                })
            });
            
            const data = await response.json();
            
            if (data.success && data.token) {
                return data.token;
            } else {
                throw new Error(data.error || 'Failed to get token');
            }
        } catch (error) {
            console.error('Token error:', error);
            throw error;
        }
    }
    
    // API Function: Start conversion job
    async function startConversionJob(url, token, format, quality) {
        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'start-convert',
                    url: url,
                    token: token,
                    format: format,
                    quality: quality
                })
            });
            
            const data = await response.json();
            
            if (data.success && data.jobId) {
                return data.jobId;
            } else {
                throw new Error(data.error || 'Failed to start conversion');
            }
        } catch (error) {
            console.error('Start conversion error:', error);
            throw error;
        }
    }
    
    // API Function: Poll conversion status
    async function pollConversionJob(jobId, token, format) {
        const maxAttempts = 30;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Update status text
                statusText.textContent = `Mengonversi... (${attempt}/${maxAttempts})`;
                
                // Wait before polling
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Make poll request
                const response = await fetch('/api/download', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'poll-convert',
                        jobId: jobId,
                        token: token,
                        format: format
                    })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                if (data.ready && data.dlurl) {
                    statusText.textContent = 'Konversi selesai!';
                    return data;
                }
                
                // If not ready but has progress
                if (data.progress) {
                    statusText.textContent = `Mengonversi... ${data.progress}%`;
                }
                
            } catch (error) {
                console.error(`Poll attempt ${attempt} failed:`, error);
                
                // If it's not the last attempt, continue
                if (attempt < maxAttempts) {
                    continue;
                } else {
                    throw new Error('Polling timeout: ' + error.message);
                }
            }
        }
        
        throw new Error('Konversi timeout setelah 30 percobaan');
    }
    
    // Function to show download button
    function showDownloadButton(downloadUrl) {
        const videoId = extractVideoId(urlInput.value);
        let fileName = 'youtube_video';
        
        if (currentVideoInfo && currentVideoInfo.title) {
            fileName = currentVideoInfo.title
                .replace(/[^\w\s]/gi, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
        } else if (videoId) {
            fileName = videoId;
        }
        
        fileName += currentFormat === 'mp3' ? '.mp3' : '.mp4';
        
        const downloadHTML = `
            <div class="download-success">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h3>Konversi Berhasil!</h3>
                <p>File siap diunduh</p>
                
                <a href="${downloadUrl}" class="download-btn ${currentFormat === 'mp3' ? 'mp3' : 'mp4'}" 
                   download="${fileName}" id="directDownloadBtn">
                    <i class="fas fa-arrow-down"></i>
                    Download ${currentFormat.toUpperCase()} 
                    ${currentFormat === 'mp4' ? `(${currentQuality})` : ''}
                    <span class="file-size" id="fileSize">Mendapatkan ukuran file...</span>
                </a>
                
                <div class="additional-options">
                    <button class="secondary-btn" id="copyLinkBtn">
                        <i class="fas fa-link"></i> Salin Link Download
                    </button>
                    <button class="secondary-btn" id="newConversionBtn">
                        <i class="fas fa-redo"></i> Konversi Lain
                    </button>
                </div>
                
                <div class="download-info">
                    <p><i class="fas fa-info-circle"></i> Klik tombol di atas untuk mengunduh. 
                    Jika download tidak dimulai, klik kanan dan pilih "Save link as..."</p>
                </div>
            </div>
        `;
        
        downloadOptions.innerHTML = downloadHTML;
        
        // Get file size
        getFileSize(downloadUrl);
        
        // Add event listeners for new buttons
        document.getElementById('copyLinkBtn').addEventListener('click', function() {
            navigator.clipboard.writeText(downloadUrl)
                .then(() => {
                    const originalText = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-check"></i> Link Disalin!';
                    setTimeout(() => {
                        this.innerHTML = originalText;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                    showError('Gagal menyalin link');
                });
        });
        
        document.getElementById('newConversionBtn').addEventListener('click', function() {
            urlInput.value = '';
            urlInput.focus();
            resultContainer.style.display = 'none';
            convertBtn.innerHTML = '<i class="fas fa-download"></i> Konversi Sekarang';
        });
        
        // Auto-click download button after 1 second (optional)
        setTimeout(() => {
            // Uncomment below line for auto-download
            // document.getElementById('directDownloadBtn').click();
        }, 1000);
        
        // Scroll to result
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Function to get file size
    async function getFileSize(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            const contentLength = response.headers.get('content-length');
            
            if (contentLength) {
                const sizeInMB = (contentLength / (1024 * 1024)).toFixed(2);
                document.getElementById('fileSize').textContent = `(${sizeInMB} MB)`;
            } else {
                document.getElementById('fileSize').textContent = '';
            }
        } catch (error) {
            console.error('Error getting file size:', error);
            document.getElementById('fileSize').textContent = '';
        }
    }
    
    // Initialize YouTube URL detection from current URL
    function initFromUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const ytUrl = urlParams.get('url');
        
        if (ytUrl && isValidYouTubeUrl(ytUrl)) {
            urlInput.value = ytUrl;
            setTimeout(() => getVideoInfo(ytUrl), 500);
        }
    }
    
    // Share functionality
    function initShareButton() {
        const shareBtn = document.createElement('button');
        shareBtn.className = 'share-btn';
        shareBtn.innerHTML = '<i class="fas fa-share-alt"></i> Bagikan';
        shareBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 50px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(255, 0, 0, 0.3);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        shareBtn.addEventListener('click', function() {
            const currentUrl = window.location.href;
            const videoUrl = urlInput.value;
            
            if (videoUrl && isValidYouTubeUrl(videoUrl)) {
                const shareUrl = `${window.location.origin}?url=${encodeURIComponent(videoUrl)}`;
                navigator.clipboard.writeText(shareUrl)
                    .then(() => {
                        const originalText = this.innerHTML;
                        this.innerHTML = '<i class="fas fa-check"></i> Link Disalin!';
                        setTimeout(() => {
                            this.innerHTML = originalText;
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Failed to copy:', err);
                        showError('Gagal menyalin link');
                    });
            } else {
                navigator.clipboard.writeText(currentUrl)
                    .then(() => {
                        const originalText = this.innerHTML;
                        this.innerHTML = '<i class="fas fa-check"></i> URL Disalin!';
                        setTimeout(() => {
                            this.innerHTML = originalText;
                        }, 2000);
                    });
            }
        });
        
        document.body.appendChild(shareBtn);
    }
    
    // Initialize the application
    function init() {
        // Check for YouTube URL in clipboard on load
        checkClipboardForYouTubeUrl();
        
        // Initialize from URL parameters
        initFromUrlParams();
        
        // Add share button
        initShareButton();
        
        // Add CSS for animations
        addCustomStyles();
    }
    
    // Check clipboard for YouTube URL on page load
    async function checkClipboardForYouTubeUrl() {
        try {
            const text = await navigator.clipboard.readText();
            if (text && isValidYouTubeUrl(text)) {
                // Show a suggestion
                setTimeout(() => {
                    if (!urlInput.value) {
                        showError(`URL YouTube ditemukan di clipboard. Klik tombol paste untuk mengisi.`, 3000);
                    }
                }, 1000);
            }
        } catch (err) {
            // Clipboard permission not granted, ignore
        }
    }
    
    // Add custom CSS styles
    function addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            .info-message {
                text-align: center;
                color: #aaa;
                padding: 20px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
                border: 1px dashed rgba(255, 255, 255, 0.1);
            }
            
            .download-success {
                text-align: center;
            }
            
            .success-icon {
                font-size: 4rem;
                color: #28a745;
                margin-bottom: 1rem;
                animation: bounce 1s ease;
            }
            
            @keyframes bounce {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2); }
            }
            
            .download-success h3 {
                color: #28a745;
                margin-bottom: 0.5rem;
            }
            
            .download-success p {
                color: #aaa;
                margin-bottom: 1.5rem;
            }
            
            .file-size {
                font-size: 0.8rem;
                opacity: 0.8;
                display: block;
                margin-top: 5px;
            }
            
            .additional-options {
                display: flex;
                gap: 10px;
                margin-top: 1rem;
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .secondary-btn {
                padding: 10px 20px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.9rem;
            }
            
            .secondary-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .download-info {
                margin-top: 1.5rem;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                border-left: 4px solid var(--primary);
                text-align: left;
            }
            
            .download-info i {
                color: var(--primary);
                margin-right: 8px;
            }
            
            @media (max-width: 768px) {
                .additional-options {
                    flex-direction: column;
                }
                
                .secondary-btn {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Initialize the app
    init();
});
