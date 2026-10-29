#!/usr/bin/env python3
"""Install/remove this checkout's macOS user LaunchAgent. No sudo required."""
import argparse
import hashlib
import os
from pathlib import Path
import plistlib
import socket
import subprocess
import sys
import time
import urllib.request


def identity(root):
    return 'org.personalportal.autostart.' + hashlib.sha256(str(root.resolve()).encode()).hexdigest()[:16]


def port_number(value):
    try:
        port = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError('端口必须是整数')
    if not 1024 <= port <= 65535:
        raise argparse.ArgumentTypeError('端口范围为 1024–65535')
    return port


def configuration(root, port, python, home):
    label = identity(root)
    logs = home / 'Library' / 'Logs' / 'PersonalPortal' / label
    return {
        'Label': label,
        'ProgramArguments': [str(python), '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(root)],
        'RunAtLoad': True,
        'KeepAlive': True,
        'ThrottleInterval': 5,
        'StandardOutPath': str(logs / 'stdout.log'),
        'StandardErrorPath': str(logs / 'stderr.log'),
        'PortalManagedRoot': str(root),
    }


def launchctl(*args):
    return subprocess.run(['/bin/launchctl', *args], capture_output=True, text=True)


def owned(config, root):
    return config.get('Label') == identity(root) and config.get('PortalManagedRoot') == str(root)


def free_port(port):
    with socket.socket() as listener:
        try:
            listener.bind(('127.0.0.1', port))
        except OSError as exc:
            raise RuntimeError(f'端口 {port} 不可用；请选择其他 --port，不会停止占用它的服务') from exc


def install(root, port, dry_run):
    for name in ('index.html', 'instance.json', 'services.json', 'shares.json', 'artwork.json'):
        if not (root / name).is_file():
            raise RuntimeError(f'项目缺少 {name}')
    # Resolve the interpreter now: launchd does not inherit the interactive shell PATH.
    python = Path(sys.executable).resolve()
    config = configuration(root, port, python, Path.home())
    if dry_run:
        sys.stdout.buffer.write(plistlib.dumps(config))
        return
    target = f'gui/{os.getuid()}/{config["Label"]}'
    dest = Path.home() / 'Library' / 'LaunchAgents' / (config['Label'] + '.plist')
    if dest.exists() or dest.is_symlink() or launchctl('print', target).returncode == 0:
        raise RuntimeError('此目录已有自启动配置或已加载的任务；先运行本项目卸载脚本，再重新安装')
    free_port(port)
    logs = Path(config['StandardOutPath']).parent
    logs.mkdir(parents=True, exist_ok=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation: do not overwrite another configuration, even in a race.
    with dest.open('xb') as file:
        file.write(plistlib.dumps(config))
    dest.chmod(0o600)
    try:
        result = launchctl('bootstrap', f'gui/{os.getuid()}', str(dest))
        if result.returncode:
            raise RuntimeError('加载自启动失败：' + result.stderr.strip())
        expected = (root / 'index.html').read_bytes()
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for _ in range(40):
            state = launchctl('print', target)
            if state.returncode == 0 and 'state = running' in state.stdout:
                try:
                    with opener.open(f'http://127.0.0.1:{port}/index.html', timeout=1) as response:
                        if response.read() == expected:
                            print(f'已安装并验证：http://127.0.0.1:{port}\n服务标识：{config["Label"]}\n配置：{dest}\n日志：{logs}')
                            return
                except OSError:
                    pass
            time.sleep(0.25)
        raise RuntimeError('启动后未能验证项目页面；请检查日志')
    except Exception:
        # Only roll back the file created by this installation.
        stop = launchctl('bootout', target)
        if stop.returncode and launchctl('print', target).returncode == 0:
            raise RuntimeError(f'启动失败且任务未能停止；保留配置以便卸载：{dest}')
        dest.unlink()
        raise


def uninstall(root):
    label = identity(root)
    dest = Path.home() / 'Library' / 'LaunchAgents' / (label + '.plist')
    target = f'gui/{os.getuid()}/{label}'
    if not dest.exists():
        if launchctl('print', target).returncode == 0:
            raise RuntimeError('发现已加载任务但缺少归属配置，未做修改；请先人工核对')
        print('此项目未安装自启动，无需卸载')
        return
    if dest.is_symlink():
        raise RuntimeError('配置是符号链接，拒绝修改')
    with dest.open('rb') as file:
        config = plistlib.load(file)
    if not owned(config, root):
        raise RuntimeError('配置归属不符，拒绝卸载')
    if launchctl('print', target).returncode == 0:
        result = launchctl('bootout', target)
        if result.returncode:
            raise RuntimeError('停止任务失败，配置未删除：' + result.stderr.strip())
    if launchctl('print', target).returncode == 0:
        raise RuntimeError('任务仍在运行，配置未删除')
    dest.unlink()
    print('已卸载此项目自启动；项目文件、浏览器收藏和日志均保留')


def main():
    parser = argparse.ArgumentParser(description='本项目的 macOS 登录自启动管理；默认仅监听本机')
    sub = parser.add_subparsers(dest='action', required=True)
    add = sub.add_parser('install')
    add.add_argument('--port', type=port_number, default=7576)
    add.add_argument('--dry-run', action='store_true', help='仅输出配置，不安装、不创建文件')
    sub.add_parser('uninstall')
    args = parser.parse_args()
    if sys.platform != 'darwin':
        parser.error('自启动脚本仅支持 macOS；其他平台请按 README 手动启动')
    if os.getuid() == 0:
        parser.error('请以当前登录用户运行，不要使用 sudo')
    root = Path(__file__).resolve().parent
    try:
        if args.action == 'install':
            install(root, args.port, args.dry_run)
        else:
            uninstall(root)
    except (OSError, ValueError, RuntimeError, plistlib.InvalidFileException) as exc:
        print(f'失败：{exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
