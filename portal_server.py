#!/usr/bin/env python3
"""Loopback-only static server with an explicit runtime file allowlist."""
import argparse
import http.server
import json
import os
from pathlib import Path
import stat
from urllib.parse import unquote, urlsplit, urlparse
import xml.etree.ElementTree as ET

RUNTIME_FILES = ('index.html', 'bootstrap.js', 'config.js', 'services.js', 'shares.js',
                 'visuals.js', 'card-media.js', 'card-media.css', 'card-media.json', 'instance.json', 'services.json', 'shares.json', 'artwork.json')


def read_runtime_file(root, name):
    if name not in RUNTIME_FILES:
        raise ValueError('不允许读取此文件')
    # Reject symbolic links, including links to files inside the project.
    if (root / name).is_symlink() or (root / name).resolve().parent != root.resolve():
        raise ValueError('运行文件不允许符号链接')
    with os.fdopen(os.open(root / name, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0)), 'rb') as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError(f'{name} 不是普通文件')
        data = stream.read()
    if not data.strip():
        raise ValueError(f'{name} 为空')
    return data


def runtime_snapshot(root):
    result = {name: read_runtime_file(root, name) for name in RUNTIME_FILES}
    data = {name: json.loads(result[name]) for name in RUNTIME_FILES if name.endswith('.json')}
    site, services, shares, artwork = (data[n] for n in ('instance.json', 'services.json', 'shares.json', 'artwork.json'))
    if not all(isinstance(value, dict) for value in data.values()):
        raise ValueError('配置文件的顶层必须是对象')
    storage = site.get('storage', {})
    if not isinstance(storage, dict) or site.get('schemaVersion') != 1 or not all(isinstance(storage.get(k), str) and storage[k].strip() for k in ('services', 'shares')) or storage['services'] == storage['shares']:
        raise ValueError('实例版本或存储键无效')
    for key in ('serviceCategories', 'shareCategories'):
        if not isinstance(site.get(key), dict):
            raise ValueError('缺少分类主题配置')
    if not isinstance(shares.get('categories'), list) or not all(isinstance(c, str) and c.strip() for c in shares['categories']):
        raise ValueError('分享分类必须是文本数组')
    for name, config in (('services', services), ('shares', shares)):
        if not isinstance(config.get(name), list):
            raise ValueError(f'{name} 必须是数组')
        ids, urls = set(), set()
        for item in config[name]:
            if not isinstance(item, dict) or not all(isinstance(item.get(k), str) and item[k].strip() for k in ('name', 'url', 'category')):
                raise ValueError(f'{name} 条目缺少名称、地址或分类')
            scheme = urlparse(item['url']).scheme.lower()
            if not scheme or scheme in ('javascript', 'data', 'file', 'vbscript') or (not item.get('nonWeb') or name == 'shares') and scheme not in ('http', 'https'):
                raise ValueError(f'{name} 条目地址无效')
            if item.get('id') is not None and (not isinstance(item['id'], str) or item['id'] in ids):
                raise ValueError('条目 ID 无效或重复')
            if item['url'] in urls:
                raise ValueError('条目 URL 重复')
            ids.add(item.get('id')); urls.add(item['url'])
            if 'artwork' in item and (not isinstance(item['artwork'], str) or item['artwork'] not in artwork):
                raise ValueError('配图引用不存在')
    tags = {'path','rect','circle','ellipse','line','polyline','polygon','g'}
    attrs = {'d','x','y','x1','x2','y1','y2','width','height','rx','ry','r','cx','cy','points','class','fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','transform'}
    for drawing in artwork.values():
        if not isinstance(drawing, str) or '<!' in drawing or '<?' in drawing:
            raise ValueError('配图必须是静态 SVG 片段')
        svg = ET.fromstring('<svg>' + drawing + '</svg>')
        for el in list(svg.iter())[1:]:
            if el.tag not in tags or any(k not in attrs or 'url' in v.lower() for k,v in el.attrib.items()):
                raise ValueError('配图包含不允许的元素或属性')
    return result


def make_server(root, port):
    root = Path(root).resolve()
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.respond(False)

        def do_HEAD(self):
            self.respond(True)

        def respond(self, head):
            try:
                path = unquote(urlsplit(self.path).path, errors='strict')
                name = 'index.html' if path == '/' else path[1:] if path.startswith('/') else ''
                if name not in RUNTIME_FILES:
                    self.send_error(404); return
                body = read_runtime_file(root, name)
            except (OSError, ValueError, UnicodeError):
                self.send_error(404); return
            mime = 'text/html' if name.endswith('.html') else 'text/javascript' if name.endswith('.js') else 'text/css' if name.endswith('.css') else 'application/json'
            self.send_response(200)
            self.send_header('Content-Type', mime + '; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            if not head:
                self.wfile.write(body)
    return http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)


def main():
    parser = argparse.ArgumentParser(description='只提供导航运行文件，不提供 Git、文档、脚本、目录列表或其他文件')
    parser.add_argument('--port', type=int, default=7576)
    parser.add_argument('--bind', choices=['127.0.0.1'], default='127.0.0.1')
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('端口范围为 1024–65535')
    try:
        runtime_snapshot(args.directory.resolve())
        with make_server(args.directory, args.port) as server:
            print(f'导航已启动：http://127.0.0.1:{args.port}', flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    except (OSError, ValueError, ET.ParseError) as error:
        parser.exit(1, f'启动失败：{error}\n')


if __name__ == '__main__':
    main()
