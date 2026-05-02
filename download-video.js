const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');

const streamPipeline = promisify(pipeline);

// ============================================
// HARDCODE YOUR VIDEO LINK HERE
// ============================================
const VIDEO_URL = 'https://cdn4.telesco.pe/file/f420f32a63.mp4?token=gs_cWKIVmWQPG0dr6REVZcaHV08_NhpOYR_o2XY-u0LzKTMrNPsUVDo96PmfxsoFMXw4AXgFmhU3nmB4JptunDjHzkVB97AGOQ7asbasv4i-xr4jXrFaoRRP_8YF8i4u1Ch5MQI1eKK5UUlMHRNfpUzOzK_vsDQN-M56HULcwZIGgNpfo6mQMsV2VGQq4ci8Dm10BPx1mFnt3nvvGdIAhXgT6k-KdOM6-gtxAaPwKjdbOr46yiOqn6jkntDBuyoiqPDxbvFrgIAOGIHFcLeN_KXzLUauTcbW7ck4J6FImCIr2jTU9ci0z5SiS0pODXPsi6yCui8nWRUoex8F4rvVVw';
// ============================================

// Optional: Custom filename (leave empty to auto-detect)
const CUSTOM_FILENAME = ''; // e.g., 'my_video.mp4'

async function downloadVideo() {
    const outputDir = './downloads';
    
    try {
        if (!VIDEO_URL || VIDEO_URL === 'https://example.com/path/to/your/video.mp4') {
            throw new Error('Please set a valid VIDEO_URL in the script');
        }

        console.log('='.repeat(50));
        console.log('🎬 Video Downloader Started');
        console.log('='.repeat(50));
        console.log(`📥 Source URL: ${VIDEO_URL}`);
        
        // Send GET request with stream
        const response = await axios({
            method: 'GET',
            url: VIDEO_URL,
            responseType: 'stream',
            timeout: 300000, // 5 minutes timeout
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Range': 'bytes=0-' // Try to get full file
            }
        });

        // Determine filename
        let filename = CUSTOM_FILENAME;
        
        if (!filename) {
            // Try to get from Content-Disposition header
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    filename = match[1].replace(/['"]/g, '');
                }
            }
            
            // If no filename yet, extract from URL
            if (!filename) {
                const urlPath = new URL(VIDEO_URL).pathname;
                const urlFilename = path.basename(urlPath);
                if (urlFilename && urlFilename.includes('.')) {
                    filename = urlFilename;
                } else {
                    filename = `video_${Date.now()}.mp4`;
                }
            }
        }

        // Ensure filename has extension
        if (!filename.match(/\.(mp4|webm|avi|mov|mkv|flv|wmv|m4v|mpg|mpeg)$/i)) {
            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('mp4')) {
                filename += '.mp4';
            } else if (contentType && contentType.includes('webm')) {
                filename += '.webm';
            } else {
                filename += '.mp4'; // Default to mp4
            }
        }

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`📁 Created directory: ${outputDir}`);
        }

        const fullOutputPath = path.join(outputDir, filename);
        
        console.log(`💾 Saving as: ${filename}`);
        console.log('⏳ Downloading...');
        
        // Download the file with progress tracking
        let downloadedBytes = 0;
        const totalBytes = parseInt(response.headers['content-length'], 10);
        
        response.data.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes) {
                const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
                const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
                process.stdout.write(`\r📊 Progress: ${percent}% (${downloadedMB} MB / ${totalMB} MB)`);
            } else {
                const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
                process.stdout.write(`\r📊 Downloaded: ${downloadedMB} MB`);
            }
        });

        // Write file
        const writer = fs.createWriteStream(fullOutputPath);
        await streamPipeline(response.data, writer);
        
        console.log('\n'); // New line after progress
        const stats = fs.statSync(fullOutputPath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        console.log('='.repeat(50));
        console.log('✅ DOWNLOAD COMPLETE!');
        console.log('='.repeat(50));
        console.log(`📁 File path: ${fullOutputPath}`);
        console.log(`📄 File name: ${filename}`);
        console.log(`📊 File size: ${fileSizeInMB.toFixed(2)} MB`);
        console.log(`🔗 Source: ${VIDEO_URL}`);
        
        return fullOutputPath;
        
    } catch (error) {
        console.error('\n❌ Download failed!');
        console.error('='.repeat(50));
        console.error(`Error: ${error.message}`);
        
        if (error.response) {
            console.error(`HTTP Status: ${error.response.status}`);
            console.error(`Status Text: ${error.response.statusText}`);
        }
        
        if (error.code === 'ECONNABORTED') {
            console.error('Connection timed out. The video might be too large or the server is slow.');
        }
        
        throw error;
    }
}

// Run the download
if (require.main === module) {
    downloadVideo()
        .then(() => {
            console.log('\n🎉 Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Fatal error:', error.message);
            process.exit(1);
        });
}

module.exports = { downloadVideo };
