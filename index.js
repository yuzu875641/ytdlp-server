// index.js (Vercelデプロイ用 Expressサーバー - ytdl-core版)

const express = require('express');
const ytdl = require('ytdl-core');

const app = express();

// ボディパーサーを設定
app.use(express.json());

// --- ルート定義 ---

// ホームルート
app.get('/', (req, res) => {
    res.send('Welcome to the ytdl-core Streaming URL Extractor API. Use POST /api/stream_url.');
});

// APIエンドポイント: ストリーミングURLを抽出して返す
app.post('/api/stream_url', async (req, res) => {
    const videoUrl = req.body.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Video URL is required in the request body.' });
    }

    // URLが有効なYouTube形式かチェック
    if (!ytdl.validateURL(videoUrl)) {
        return res.status(400).json({ error: 'Invalid YouTube URL provided.' });
    }

    try {
        // 動画のメタデータ全体を取得
        const info = await ytdl.getInfo(videoUrl);

        // 動画と音声が結合されている（itagで音声が存在しない）フォーマットの中から、
        // 最高品質（最も高い resolution または fps）のものを探します。
        // ytdl-coreの仕様では、`quality: 'highest'` を指定すると最高品質の結合フォーマットが取得できます。
        const format = ytdl.chooseFormat(info.formats, { 
            quality: 'highest', // 'highest' は結合されたストリームの中での最高品質
            filter: 'audioandvideo' // 動画と音声が結合されているもののみ
        });

        if (!format || !format.url) {
            return res.status(404).json({ error: 'No combined high-quality streaming format found for this video.' });
        }

        // レスポンスをJSONで返す
        res.json({
            message: 'Successfully extracted the best combined streaming URL using ytdl-core.',
            url: format.url, 
            quality: format.qualityLabel,
            note: 'This URL points to the best available single stream (video and audio combined).'
        });

    } catch (error) {
        console.error(`ytdl-core error: ${error.message}`);
        
        // エラー詳細をクライアントに返さないようにし、一般的なエラーメッセージにする
        return res.status(500).json({ 
            error: 'Failed to process video information.', 
            details: 'Ensure the video is publicly accessible and not geo-blocked.'
        });
    }
});

module.exports = app;
