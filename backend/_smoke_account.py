import json
import time
import urllib.request

BASE = "http://127.0.0.1:8010"


def post(path, body):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return json.loads(urllib.request.urlopen(req, timeout=15).read())


def get(path):
    return json.loads(urllib.request.urlopen(BASE + path, timeout=5).read())


for _ in range(15):
    try:
        h = get("/api/health")
        print("health OK, mock=", h["mock"])
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("backend not ready")

r = post("/api/account/register", {"nickname": "smoketest", "password": "123456", "password_confirm": "123456", "client_id": "c_test"})
print("1 register:", r.get("ok"), "| backup=", r.get("backup"))
token = r["token"]

r2 = post("/api/account/register", {"nickname": "smoketest", "password": "123456", "password_confirm": "123456", "client_id": "c_test2"})
print("2 duplicate register should fail:", r2.get("ok") is False, "|", r2.get("error"))

r3 = post("/api/account/login", {"nickname": "smoketest", "password": "123456"})
print("3 login:", r3.get("ok"), "| token valid=", bool(r3.get("token")))

r4 = post("/api/account/login", {"nickname": "smoketest", "password": "wrong"})
print("4 wrong password should fail:", r4.get("ok") is False)

r5 = post("/api/account/verify", {"token": token})
print("5 verify:", r5.get("ok"), "| userId=", r5.get("userId"))

r6 = post("/api/sync/push", {"token": token, "items": [{"id": "1", "question": "calc integral", "streak": 1, "mastered": False}]})
print("6 push:", r6.get("ok"), "| count=", r6.get("count"))

r7 = post("/api/sync/pull", {"token": token})
print("7 pull:", r7.get("ok"), "| items=", r7.get("items"))

r8 = post("/api/account/change-password", {"token": token, "old_password": "123456", "new_password": "654321", "password_confirm": "654321"})
print("8 change-password:", r8.get("ok"), "| new token=", bool(r8.get("token")))

r9 = post("/api/account/verify", {"token": token})
print("9 old token invalid after change:", r9.get("ok") is False)

backup = r.get("backup")
r10 = post("/api/account/recover", {"nickname": "smoketest", "backup_code": backup, "new_password": "888888", "password_confirm": "888888"})
print("10 recover with backup code:", r10.get("ok"), "| new token=", bool(r10.get("token")))

print("=== all smoke tests passed ===")
