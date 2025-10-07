# app.py (Final Version - Using Environment Variables for Login)

import os
from flask import Flask, jsonify, request
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError
import shutil
import time # sleepや時間関連の処理に備えて追加

app = Flask(__name__)

# --- 環境変数から認証情報を取得 ---
YT_USERNAME = os.environ.get('YT_USERNAME')
YT_PASSWORD = os.environ.get('YT_PASSWORD')

# 読み取り専用のオリジナルファイルパス (cookies.txtはそのまま残します)
ORIGINAL_COOKIES_FILE = os.path.join(os.path.dirname(__file__), 'cookies.txt')

# 一時ファイルとして書き込み可能な /tmp ディレクトリに配置するパス
WRITABLE_COOKIES_FILE = '/tmp/cookies.txt'


@app.route('/')
def home():
    return "Welcome to the Python/Flask yt-dlp API server. Use GET /api/videos/<videoid>"

@app.route('/api/videos/<videoid>', methods=['GET'])
def get_stream_url(videoid):
    video_url = f"https://www.youtube.com/watch?v={videoid}"

    # 必須の認証情報チェック
    if not YT_USERNAME or not YT_PASSWORD:
        return jsonify({
            "error": "Configuration Error: YouTube credentials are not set.",
            "details": "Set YT_USERNAME and YT_PASSWORD environment variables in Vercel."
        }), 500
    
    # 既存のcookies.txtの内容を/tmpにコピーする処理は残します。
    # これは、サインイン処理が失敗した場合のフォールバックとして、またはログイン後のクッキー保存先として機能します。
    try:
        shutil.copyfile(ORIGINAL_COOKIES_FILE, WRITABLE_COOKIES_FILE)
    except FileNotFoundError:
        # cookies.txtがなくても、今回はユーザー名/パスワードでログインを試みるため、警告のみに留めます。
        app.logger.warn(f"Warning: Original cookies.txt not found, proceeding with username/password login.")
    except Exception as e:
        app.logger.error(f"Error copying cookies file: {e}")
        return jsonify({
            "error": "File System Error: Could not prepare cookies file.",
            "details": str(e)
        }), 500

    # yt-dlp オプションの設定
    ydl_opts = {
        'quiet': True,
        'simulate': True,
        'geturl': True,
        'format': 'best',
        
        # 💡 ここでユーザー名とパスワードを設定 💡
        'username': YT_USERNAME,
        'password': YT_PASSWORD,
        
        # ログイン成功後、セッションクッキーがこのファイルに保存されます。
        'cookiefile': WRITABLE_COOKIES_FILE,
        # ログイン処理が完了するまで待機（二要素認証回避のため）
        'sleep_requests': 1 
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            
            # ... (URL抽出ロジックは省略) ...
            if 'url' in info:
                streaming_url = info['url']
            else:
                best_format = ydl.get_format_with_quality(info['formats'], 'best')
                if best_format and 'url' in best_format:
                    streaming_url = best_format['url']
                else:
                    raise DownloadError("Could not find best combined streaming URL.")

        return jsonify({
            "message": "Successfully extracted streaming URL using yt-dlp login.",
            "video_id": videoid,
            "url": streaming_url,
            "note": "Login successful using provided credentials."
        })

    except DownloadError as e:
        app.logger.error(f"yt-dlp error for ID {videoid}: {e}")
        return jsonify({
            "error": "Failed to extract streaming URL.",
            "details": str(e).split('\n')[0],
            "note": "Login may have failed, or video is restricted."
        }), 404
    except Exception as e:
        app.logger.error(f"General error for ID {videoid}: {e}")
        return jsonify({
            "error": "An unexpected server error occurred.",
            "details": str(e)
        }), 500
