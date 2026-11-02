"""Client identity and bounded body handling shared by all HTTP endpoints."""
import ipaddress
import os
from starlette.responses import JSONResponse


def client_ip(scope):
    peer = (scope.get('client') or ('unknown', 0))[0]
    try:
        networks = [ipaddress.ip_network(x.strip()) for x in os.getenv('ZHIYI_TRUSTED_PROXIES', '').split(',') if x.strip()]
        trusted = any(ipaddress.ip_address(peer) in n for n in networks)
        if not trusted:
            return peer
        headers = dict(scope.get('headers') or [])
        chain = headers.get(b'x-forwarded-for', b'').decode('ascii').split(',')
        # Walk from the actual peer toward the client; ignore spoofed left entries.
        for raw in reversed(chain):
            candidate = str(ipaddress.ip_address(raw.strip()))
            if not any(ipaddress.ip_address(candidate) in n for n in networks):
                return candidate
        return peer
    except (ValueError, UnicodeError):
        return peer


class BodyLimitMiddleware:
    def __init__(self, app, max_bytes=10 * 1024 * 1024):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        headers = dict(scope.get('headers') or [])
        try:
            declared = int(headers.get(b'content-length', b'0'))
        except ValueError:
            return await JSONResponse({'ok': False, 'error': '请求长度无效'}, status_code=400)(scope, receive, send)
        if declared < 0 or declared > self.max_bytes:
            return await JSONResponse({'ok': False, 'error': '提交内容过大，请减少图片数量或压缩后重试'}, status_code=413)(scope, receive, send)
        body = bytearray()
        while True:
            msg = await receive()
            if msg['type'] == 'http.disconnect':
                return
            chunk = msg.get('body', b'')
            if len(body) + len(chunk) > self.max_bytes:
                return await JSONResponse({'ok': False, 'error': '提交内容过大，请减少图片数量或压缩后重试'}, status_code=413)(scope, receive, send)
            body.extend(chunk)
            if not msg.get('more_body'):
                break
        sent = False
        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()
        await self.app(scope, replay, send)
