# app.py

import os
from flask import Flask, jsonify, request
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

app = Flask(__name__)

# cookies.txt ファイルのパスを設定
# Vercelでは、プロジェクトのルートが/var/task/になります。
COOKIES_FILE = os.path.join(os.path.dirname(__file__), 'cookies.txt')

# --- ルート定義 ---

@app.route('/')
def home():
    """ホームルート"""
    return "Welcome to the Python/Flask yt-dlp API server. Use GET /api/videos/<videoid>"

@app.route('/api/videos/<videoid>', methods=['GET'])
def get_stream_url(videoid):
    """
    パスパラメータから動画IDを取得し、yt-dlpとcookies.txtを使用してストリーミングURLを抽出
    """
    video_url = f"https://www.youtube.com/watch?v={videoid}"

    # cookies.txt の存在チェック
    if not os.path.exists(COOKIES_FILE):
        app.logger.error(f"Configuration Error: {COOKIES_FILE} not found.")
        return jsonify({
            "error": "Configuration Error: cookies.txt file not found.",
            "details": "Ensure cookies.txt is in the project root and pushed to GitHub."
        }), 500

    # yt-dlp オプションの設定
    ydl_opts = {
        # ログを非表示にする
        'quiet': True,
        # ダウンロードはせず、情報を抽出する
        'simulate': True,
        # URLのみを抽出する
        'geturl': True,
        # cookies.txtのパスを指定
        'cookiefile': COOKIES_FILE,
        # 動画と音声が結合された最高品質のフォーマットを選択
        'format': 'best', 
    }

    try:
        # yt-dlpをライブラリとして実行し、情報を抽出
        with YoutubeDL(ydl_opts) as ydl:
            # yt-dlpは、URL抽出時、情報を辞書として返さず、標準出力にURLを出力します。
            # 'geturl': True が設定されているため、info_dictにはURLは含まれませんが、
            # ydl.extract_info()が内部でストリーミングURLを取得します。
            # しかし、APIで利用しやすくするため、標準的な抽出方法を使います。
            info = ydl.extract_info(video_url, download=False)
            
            # 'url'キーが存在するか、あるいは最高品質の結合フォーマットを探す
            if 'url' in info:
                streaming_url = info['url']
            else:
                # 'best'フォーマットのURLを手動で探す
                best_format = ydl.get_format_with_quality(info['formats'], 'best')
                if best_format and 'url' in best_format:
                    streaming_url = best_format['url']
                else:
                    raise DownloadError("Could not find best combined streaming URL.")

        return jsonify({
            "message": "Successfully extracted streaming URL using yt-dlp (Python library) and cookies.",
            "video_id": videoid,
            "url": streaming_url,
            "note": "Extracted with session/preference data from cookies."
        })

    except DownloadError as e:
        # 動画が見つからない、認証失敗、地域制限などのエラー
        app.logger.error(f"yt-dlp error for ID {videoid}: {e}")
        return jsonify({
            "error": "Failed to extract streaming URL.",
            "details": str(e).split('\n')[0],
            "note": "Ensure the video is accessible with the provided cookies."
        }), 404
    except Exception as e:
        app.logger.error(f"General error for ID {videoid}: {e}")
        return jsonify({
            "error": "An unexpected server error occurred.",
            "details": str(e)
        }), 500

# Vercelが動作させるためのエントリポイント (本番環境での実行は不要ですが、慣習として残します)
if __name__ == '__main__':
    app.run(debug=True)
