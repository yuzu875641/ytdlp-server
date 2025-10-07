# app.py (FINAL VERSION - Using /tmp for Writable Cookies File)

import os
from flask import Flask, jsonify, request
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError
import shutil # ファイルコピーのために追加

app = Flask(__name__)

# 1. 読み取り専用のオリジナルファイルのパス
ORIGINAL_COOKIES_FILE = os.path.join(os.path.dirname(__file__), 'cookies.txt')

# 2. 一時ファイルとして書き込み可能な /tmp ディレクトリに配置するパス
# Vercelでは/tmpディレクトリのみが書き込み可能
WRITABLE_COOKIES_FILE = '/tmp/cookies.txt'


@app.route('/')
def home():
    """ホームルート"""
    return "Welcome to the Python/Flask yt-dlp API server. Use GET /api/videos/<videoid>"

@app.route('/api/videos/<videoid>', methods=['GET'])
def get_stream_url(videoid):
    """
    動画IDを取得し、cookies.txtのコピーを使用してyt-dlpを実行
    """
    video_url = f"https://www.youtube.com/watch?v={videoid}"

    # --- クッキーファイルのコピー処理 ---
    try:
        if not os.path.exists(ORIGINAL_COOKIES_FILE):
             raise FileNotFoundError(f"Original cookies file not found at {ORIGINAL_COOKIES_FILE}")

        # 読み取り専用のファイルを/tmpにコピーし、yt-dlpが書き込めるようにする
        shutil.copyfile(ORIGINAL_COOKIES_FILE, WRITABLE_COOKIES_FILE)
        
    except FileNotFoundError:
        app.logger.error(f"Configuration Error: {ORIGINAL_COOKIES_FILE} not found.")
        return jsonify({
            "error": "Configuration Error: cookies.txt file not found.",
            "details": "Ensure cookies.txt is in the project root and pushed to GitHub."
        }), 500
    except Exception as e:
        app.logger.error(f"Error copying cookies file: {e}")
        return jsonify({
            "error": "File System Error: Could not prepare cookies file for writing.",
            "details": str(e)
        }), 500
    # -----------------------------------


    # yt-dlp オプションの設定
    ydl_opts = {
        'quiet': True,
        'simulate': True,
        'geturl': True,
        # ⚠️ 書き込み可能な一時ファイルのパスを指定 ⚠️
        'cookiefile': WRITABLE_COOKIES_FILE,
        'format': 'best', 
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            # ydl.extract_info()を実行
            info = ydl.extract_info(video_url, download=False)
            
            # 'best'フォーマットのURLを探すロジックはyt-dlpが処理します
            streaming_url = info.get('url')

            if not streaming_url:
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
