import json
import urllib.request


def run(lang, code, stdin=""):
    req = urllib.request.Request(
        "http://localhost:3300/api/run",
        data=json.dumps({"language": lang, "code": code, "stdin": stdin}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


py = run("python", "print(1+2)")
print("python ok=", py.get("ok"), "| stdout=", repr(py.get("stdout")), "| err=", py.get("error", ""))

py2 = run("python", "n=int(input())\nprint(n*n)", "7")
print("python stdin ok=", py2.get("ok"), "| stdout=", repr(py2.get("stdout")))

c = run("c", "#include <stdio.h>\nint main(){printf(\"hi-ok\"); return 0;}")
print("c ok=", c.get("ok"), "| stdout=", repr(c.get("stdout")), "| err=", c.get("error", ""))

inf = run("python", "while True:\n    pass")
print("infinite loop ->", inf.get("ok"), "| err=", inf.get("error", ""))
