// index.js (ytdl-coreを使用し、yt-dlpに依存しないコード)

const express = require('express');
const ytdl = require('ytdl-core');

const app = express();
// ボディパーサーはGETメソッドでは不要ですが、GETエンドポイントとして修正します
// app.use(express.json()); 

// 新しいAPIエンドポイント: パスパラメータから動画IDを取得 (GETメソッド)
app.get('/api/videos/:videoid', async (req, res) => {
    const videoId = req.params.videoid;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    if (!videoId || videoId.length !== 11) {
         return res.status(400).json({ error: 'Invalid or missing YouTube Video ID in the URL path.' });
    }

    try {
        const info = await ytdl.getInfo(videoUrl);

        // 動画と音声が結合されたストリームの中で最高品質のものを選択
        const format = ytdl.chooseFormat(info.formats, { 
            quality: 'highest', 
            filter: 'audioandvideo' 
        });

        if (!format || !format.url) {
            return res.status(404).json({ error: 'No combined high-quality streaming format found for this video.' });
        }

        res.json({
            message: 'Successfully extracted the best combined streaming URL using ytdl-core.',
            video_id: videoId,
            url: format.url, 
            quality: format.qualityLabel,
            note: 'URL extracted without external binaries.'
        });

    } catch (error) {
        console.error(`ytdl-core error for ID ${videoId}: ${error.message}`);
        const statusCode = error.message.includes('No video id found') ? 404 : 500;

        return res.status(statusCode).json({ 
            error: 'Failed to process video information.', 
            details: 'Ensure the video is publicly accessible and the ID is correct.'
        });
    }
});

module.exports = app;
