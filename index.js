// index.js (Vercelデプロイ用 Expressサーバー)

const express = require('express');
const { exec } = require('child_process');

const app = express();

// ボディパーサーを設定 (JSON形式のリクエストを受け取るため)
app.use(express.json());

// --- ルート定義 ---

// ホームルート
app.get('/', (req, res) => {
    res.send('Welcome to the yt-dlp Streaming URL Extractor API. Use POST /api/stream_url to get a URL.');
});

// APIエンドポイント: ストリーミングURLを抽出して返す
// 実行には、環境にyt-dlpバイナリがインストールされている必要があります。
app.post('/api/stream_url', (req, res) => {
    const videoUrl = req.body.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Video URL is required in the request body.' });
    }

    // yt-dlpコマンドの構築
    // -f best: 動画と音声が結合されたストリームの中で最高品質のものを選択
    // --get-url: ダウンロードせずにURLのみを出力する
    const command = `yt-dlp --get-url -f best "${videoUrl}"`;

    // 外部コマンドを実行 (タイムアウト15秒を設定)
    exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`yt-dlp exec error: ${error.message}`);
            return res.status(500).json({ 
                error: 'Failed to extract streaming URL.', 
                details: error.message.substring(0, 200),
                stderr: stderr.substring(0, 200)
            });
        }
        
        // stdoutには、最高品質の単一のストリーミングURLが出力される
        const streamingUrl = stdout.trim();

        // レスポンスをJSONで返す
        res.json({
            message: 'Successfully extracted the best combined streaming URL.',
            url: streamingUrl, 
            note: 'This URL points to the best available single stream (video and audio combined).'
        });
    });
});

module.exports = app;
