// index.js (ytdl-coreでcookies.txtを利用する修正版)

const express = require('express');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

const app = express();

// --- クッキーファイル解析関数 ---
const getCookieString = (filePath) => {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        const cookies = [];

        for (const line of lines) {
            // コメント行 (#) や空行をスキップ
            if (line.startsWith('#') || line.trim() === '') continue;

            const parts = line.split('\t');
            // Netscape形式: [Domain, Flag, Path, Secure, Expiration, Name, Value]
            if (parts.length >= 7) {
                const name = parts[5];
                const value = parts[6].trim();
                // クッキー名と値のペアを作成 (例: "PREF=hl=en&tz=UTC")
                cookies.push(`${name}=${value}`);
            }
        }
        // HTTPヘッダー形式に結合 (例: "PREF=value; SOCS=value; ...")
        return cookies.join('; ');
    } catch (error) {
        console.error("Failed to read or parse cookies.txt:", error);
        return null;
    }
};

// cookies.txtの絶対パスとクッキー文字列の取得
const cookiesPath = path.join(__dirname, 'cookies.txt');
const cookieString = getCookieString(cookiesPath);

if (!cookieString) {
    console.warn("⚠️ WARNING: Cookies file could not be loaded or parsed. Login-required videos may fail.");
}

// APIエンドポイント: パスパラメータから動画IDを取得 (GETメソッド)
app.get('/api/videos/:videoid', async (req, res) => {
    const videoId = req.params.videoid;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    if (!videoId || videoId.length !== 11) {
         return res.status(400).json({ error: 'Invalid or missing YouTube Video ID.' });
    }

    // クッキー文字列が取得できていない場合はエラーとする
    if (!cookieString) {
        return res.status(500).json({ error: 'Configuration Error: Failed to load cookies for authentication.' });
    }
    
    try {
        // ytdl.getInfoにリクエストヘッダーオプションを渡す
        const info = await ytdl.getInfo(videoUrl, {
            requestOptions: {
                headers: {
                    'Cookie': cookieString // ここでクッキー情報を渡す
                }
            }
        });

        const format = ytdl.chooseFormat(info.formats, { 
            quality: 'highest', 
            filter: 'audioandvideo' 
        });

        if (!format || !format.url) {
            return res.status(404).json({ error: 'No combined high-quality streaming format found for this video.' });
        }

        res.json({
            message: 'Successfully extracted streaming URL using ytdl-core and cookies.',
            video_id: videoId,
            url: format.url, 
            quality: format.qualityLabel,
        });

    } catch (error) {
        console.error(`ytdl-core error for ID ${videoId}: ${error.message}`);
        const statusCode = error.message.includes('No video id found') ? 404 : 500;

        return res.status(statusCode).json({ 
            error: 'Failed to process video information.', 
            details: 'Ensure the video is accessible with the provided cookies.'
        });
    }
});

module.exports = app;
