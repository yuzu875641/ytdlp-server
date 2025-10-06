// index.js (Vercelデプロイ用 Expressサーバー - ytdl-core版)

const express = require('express');
const ytdl = require('ytdl-core');

const app = express();

// ボディパーサーは不要になりましたが、ルートは残しておきます
// app.use(express.json());

// --- ルート定義 ---

// ホームルート
app.get('/', (req, res) => {
    res.send('Welcome to the ytdl-core Streaming URL Extractor API. Use GET /api/videos/:videoid');
});

// 新しいAPIエンドポイント: パスパラメータから動画IDを取得
// /api/videos/ の後に続く部分を :videoid として取得します
app.get('/api/videos/:videoid', async (req, res) => {
    // パスパラメータから動画IDを取得
    const videoId = req.params.videoid;
    
    // ytdl-coreは動画IDまたは完全なURLのいずれかを受け入れます
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // 動画IDが有効な形式かチェック (例として、長さ11文字の単純なチェック)
    if (!videoId || videoId.length !== 11) {
         return res.status(400).json({ error: 'Invalid or missing YouTube Video ID in the URL path.' });
    }

    try {
        // 動画のメタデータ全体を取得
        const info = await ytdl.getInfo(videoUrl);

        // 動画と音声が結合されている（combined）フォーマットの中から、
        // 最高品質のものを探します。
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
            video_id: videoId,
            url: format.url, 
            quality: format.qualityLabel,
            note: 'This URL points to the best available single stream (video and audio combined).'
        });

    } catch (error) {
        console.error(`ytdl-core error for ID ${videoId}: ${error.message}`);
        
        // 404エラー（動画が見つからない、非公開など）の場合は、エラーを返します
        const statusCode = error.message.includes('No video id found') ? 404 : 500;

        return res.status(statusCode).json({ 
            error: 'Failed to process video information.', 
            details: 'Ensure the video is publicly accessible, not geo-blocked, and the ID is correct.'
        });
    }
});

module.exports = app;
