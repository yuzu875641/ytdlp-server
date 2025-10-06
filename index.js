// index.js (yt-dlpに戻し、cookies.txtを利用するバージョン)

const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

// --- ルート定義 ---

// ホームルート
app.get('/', (req, res) => {
    res.send('Welcome to the yt-dlp API server with cookies. Use GET /api/videos/:videoid');
});

// APIエンドポイント: パスパラメータから動画IDを取得し、yt-dlpを実行
app.get('/api/videos/:videoid', (req, res) => {
    const videoId = req.params.videoid;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // index.jsと同じディレクトリにある cookies.txt の絶対パス
    const cookiesPath = path.join(__dirname, 'cookies.txt');

    if (!videoId || videoId.length !== 11) {
         return res.status(400).json({ error: 'Invalid or missing YouTube Video ID in the URL path.' });
    }
    
    // cookies.txtの存在チェック (念のため)
    if (!fs.existsSync(cookiesPath)) {
        return res.status(500).json({ error: 'Configuration Error: cookies.txt file not found in the project root.' });
    }

    // yt-dlpコマンドの構築
    // -f best: 動画と音声が結合されたストリームの中で最高品質のものを選択
    // --get-url: ダウンロードせずにURLのみを出力する
    // --cookies: cookies.txtのパスを指定
    const command = `yt-dlp --get-url -f best --cookies "${cookiesPath}" "${videoUrl}"`;

    // 外部コマンドを実行 (タイムアウト15秒を設定)
    // ⚠️ このコマンドは、デプロイ環境にyt-dlpバイナリが存在することを要求します。
    exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`yt-dlp exec error for ID ${videoId}: ${error.message}`);
            return res.status(500).json({ 
                error: 'Failed to extract streaming URL. (Check yt-dlp installation)', 
                details: error.message.substring(0, 200)
            });
        }
        
        const streamingUrl = stdout.trim();

        res.json({
            message: 'Successfully extracted the best combined streaming URL using yt-dlp (with cookies).',
            video_id: videoId,
            url: streamingUrl, 
            note: 'URL extracted with session/preference data from cookies.'
        });
    });
});

module.exports = app;
